import {
  type ChangeStream,
  type Collection,
  type Db,
  MongoClient,
} from "mongodb";

import type {
  ActionQueueEntry,
  ActionState,
  CloudSyncConfig,
  CloudSyncStatus,
  DreamReport,
  SyncedReviewDecision,
} from "../shared/types";
import {
  getReports,
  mergeRemoteReviewDecisions,
  onReportsChange,
} from "./reports";
import { getConfig, onConfigChange } from "./store";
import { getDeviceSyncUrl } from "./deviceSync";
import { sanitizeCloudText, sanitizeReportForCloud } from "./cloudRedaction";

const CYCLES_COLLECTION = "sleep_cycles";
const DECISIONS_COLLECTION = "sleep_cycle_decisions";
const DEVICES_COLLECTION = "sync_devices";
const SCHEMA_VERSION = 1;
const APP_NAME = "Harness Dreams Desktop";
const SYNC_DECISION_STATES = [
  "accepted",
  "rejected",
  "queued",
  "snoozed",
] as const satisfies readonly Exclude<ActionState, "open">[];
const NON_OPEN_STATES = new Set<ActionState>(SYNC_DECISION_STATES);

type Listener = (status: CloudSyncStatus) => void;

interface EffectiveCloudSyncConfig extends CloudSyncConfig {
  atlasUri: string;
  databaseName: string;
  userId: string;
}

interface CloudCycleDoc {
  schemaVersion: number;
  userId: string;
  reportId: string;
  sourceDeviceId: string;
  sourceDeviceName: string;
  timestamp: number;
  updatedAt: number;
  reviewStatus: DreamReport["reviewStatus"];
  reviewedAt: number | null;
  digest: string;
  cycle: unknown;
}

interface CloudDecisionDoc {
  schemaVersion: number;
  userId: string;
  reportId: string;
  findingId: string;
  state: Exclude<ActionState, "open">;
  updatedAt: number;
  sourceDeviceId: string;
  sourceDeviceName?: string;
  deviceTokenHash?: string;
}

let initialized = false;
let client: MongoClient | null = null;
let activeKey = "";
let changeStream: ChangeStream<CloudDecisionDoc> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;
let syncAgain = false;
const listeners = new Set<Listener>();

let status: CloudSyncStatus = makeStatus(resolveConfig());

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function resolveConfig(): EffectiveCloudSyncConfig {
  const config = getConfig().cloudSync;
  return {
    ...config,
    atlasUri:
      config.atlasUri ||
      env("HARNESS_DREAMS_MONGODB_URI") ||
      env("MONGODB_URI"),
    databaseName:
      config.databaseName ||
      env("HARNESS_DREAMS_MONGODB_DB") ||
      env("MONGODB_DB") ||
      "harness_dreams",
    userId: config.userId || env("HARNESS_DREAMS_CLOUD_USER_ID"),
  };
}

function isConfigured(config: EffectiveCloudSyncConfig): boolean {
  return Boolean(
    config.enabled &&
      planAllowsCloudSync(config) &&
      config.atlasUri &&
      config.userId
  );
}

function planAllowsCloudSync(config: EffectiveCloudSyncConfig): boolean {
  return config.paidPlan || config.devBypassPaidPlan;
}

function makeStatus(config: EffectiveCloudSyncConfig): CloudSyncStatus {
  const configured = isConfigured(config);
  const allowedByPlan = planAllowsCloudSync(config);
  const state = config.enabled
    ? !allowedByPlan
      ? "needs-setup"
      : configured
        ? "connecting"
        : "needs-setup"
    : "disabled";
  return {
    enabled: config.enabled,
    paidPlan: config.paidPlan,
    devBypassPaidPlan: config.devBypassPaidPlan,
    allowedByPlan,
    configured,
    state,
    message: config.enabled
      ? !allowedByPlan
        ? "Cloud Sync is part of the paid plan. Dev bypass is off."
        : configured
          ? "Cloud Sync is ready to connect."
          : "Add an Atlas URI and shared user id to start syncing."
      : "Cloud Sync is off.",
    userId: config.userId,
    deviceId: config.deviceId,
    databaseName: config.databaseName,
    collections: {
      cycles: CYCLES_COLLECTION,
      decisions: DECISIONS_COLLECTION,
      devices: DEVICES_COLLECTION,
    },
    lastSyncedAt: null,
    lastPulledAt: null,
    lastPushedAt: null,
    nextSyncAt: null,
    localSyncUrl: getDeviceSyncUrl(),
    cyclesPushed: 0,
    decisionsPushed: 0,
    remoteDecisionsApplied: 0,
  };
}

function updateStatus(patch: Partial<CloudSyncStatus>): CloudSyncStatus {
  const config = resolveConfig();
  status = {
    ...status,
    enabled: config.enabled,
    paidPlan: config.paidPlan,
    devBypassPaidPlan: config.devBypassPaidPlan,
    allowedByPlan: planAllowsCloudSync(config),
    configured: isConfigured(config),
    userId: config.userId,
    deviceId: config.deviceId,
    databaseName: config.databaseName,
    localSyncUrl: getDeviceSyncUrl(),
    ...patch,
  };
  for (const listener of listeners) listener(status);
  return status;
}

function resetStatusForConfig(): void {
  status = makeStatus(resolveConfig());
  for (const listener of listeners) listener(status);
}

function connectionKey(config: EffectiveCloudSyncConfig): string {
  return `${config.atlasUri}\n${config.databaseName}`;
}

async function closeClient(): Promise<void> {
  if (syncTimer) clearTimeout(syncTimer);
  if (debounceTimer) clearTimeout(debounceTimer);
  syncTimer = null;
  debounceTimer = null;
  if (changeStream) {
    const stream = changeStream;
    changeStream = null;
    await stream.close().catch(() => undefined);
  }
  if (client) {
    const current = client;
    client = null;
    activeKey = "";
    await current.close().catch(() => undefined);
  }
}

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db
      .collection<CloudCycleDoc>(CYCLES_COLLECTION)
      .createIndex({ userId: 1, reportId: 1 }, { unique: true }),
    db
      .collection<CloudCycleDoc>(CYCLES_COLLECTION)
      .createIndex({ userId: 1, timestamp: -1 }),
    db
      .collection<CloudDecisionDoc>(DECISIONS_COLLECTION)
      .createIndex({ userId: 1, reportId: 1, findingId: 1 }, { unique: true }),
    db
      .collection<CloudDecisionDoc>(DECISIONS_COLLECTION)
      .createIndex({ userId: 1, updatedAt: -1 }),
    db
      .collection(DEVICES_COLLECTION)
      .createIndex({ userId: 1, deviceId: 1 }, { unique: true }),
  ]);
}

async function ensureDb(config: EffectiveCloudSyncConfig): Promise<Db> {
  const key = connectionKey(config);
  if (!client || activeKey !== key) {
    await closeClient();
    updateStatus({
      state: "connecting",
      message: "Connecting to MongoDB Atlas...",
      nextSyncAt: null,
    });
    client = new MongoClient(config.atlasUri, { appName: APP_NAME });
    await client.connect();
    activeKey = key;
    await ensureIndexes(client.db(config.databaseName));
  }
  return client.db(config.databaseName);
}

function scheduleSync(delayMs = 500): void {
  const config = resolveConfig();
  if (!isConfigured(config)) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  const nextSyncAt = Date.now() + delayMs;
  updateStatus({ nextSyncAt });
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void syncCloudNow();
  }, delayMs);
}

function armPollingTimer(): void {
  const config = resolveConfig();
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
  if (!isConfigured(config)) return;
  const delay = Math.max(5_000, config.syncIntervalMs);
  const nextSyncAt = Date.now() + delay;
  updateStatus({ nextSyncAt });
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void syncCloudNow();
  }, delay);
}

function startDecisionWatch(
  collection: Collection<CloudDecisionDoc>,
  config: EffectiveCloudSyncConfig
): void {
  if (changeStream) return;
  try {
    changeStream = collection.watch(
      [
        {
          $match: {
            operationType: { $in: ["insert", "replace", "update"] },
            "fullDocument.userId": config.userId,
          },
        },
      ],
      { fullDocument: "updateLookup" }
    );
    changeStream.on("change", (change) => {
      const doc = "fullDocument" in change ? change.fullDocument : null;
      if (!doc || doc.sourceDeviceId === config.deviceId) return;
      scheduleSync(250);
    });
    changeStream.on("error", (err) => {
      changeStream = null;
      updateStatus({
        state: "watching",
        message: "Connected. Atlas watch paused; polling for changes.",
        lastError: err instanceof Error ? err.message : String(err),
      });
      armPollingTimer();
    });
  } catch (err) {
    updateStatus({
      state: "watching",
      message: "Connected. Atlas watch unavailable; polling for changes.",
      lastError: err instanceof Error ? err.message : String(err),
    });
  }
}

function reportUpdatedAt(report: DreamReport): number {
  const decisionTimes =
    report.reviewDecisions?.map(
      (entry) => entry.decidedAt ?? report.reviewedAt ?? report.timestamp
    ) ?? [];
  return Math.max(report.timestamp, report.reviewedAt ?? 0, ...decisionTimes);
}

function cycleDoc(
  report: DreamReport,
  config: EffectiveCloudSyncConfig
): CloudCycleDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    userId: config.userId,
    reportId: report.id,
    sourceDeviceId: config.deviceId,
    sourceDeviceName: config.deviceName,
    timestamp: report.timestamp,
    updatedAt: reportUpdatedAt(report),
    reviewStatus: report.reviewStatus,
    reviewedAt: report.reviewedAt ?? null,
    digest: sanitizeCloudText(report.digest),
    cycle: sanitizeReportForCloud(report),
  };
}

async function pushCycles(
  collection: Collection<CloudCycleDoc>,
  reports: DreamReport[],
  config: EffectiveCloudSyncConfig
): Promise<number> {
  let pushed = 0;
  for (const report of reports) {
    await collection.updateOne(
      { userId: config.userId, reportId: report.id },
      { $set: cycleDoc(report, config) },
      { upsert: true }
    );
    pushed += 1;
  }
  return pushed;
}

function localDecisionUpdatedAt(
  report: DreamReport,
  entry: ActionQueueEntry
): number {
  return entry.decidedAt ?? report.reviewedAt ?? report.timestamp;
}

function decisionDoc(
  report: DreamReport,
  entry: ActionQueueEntry,
  config: EffectiveCloudSyncConfig
): CloudDecisionDoc | null {
  if (!NON_OPEN_STATES.has(entry.state)) return null;
  return {
    schemaVersion: SCHEMA_VERSION,
    userId: config.userId,
    reportId: report.id,
    findingId: entry.findingId,
    state: entry.state as Exclude<ActionState, "open">,
    updatedAt: localDecisionUpdatedAt(report, entry),
    sourceDeviceId: entry.sourceDeviceId || config.deviceId,
    sourceDeviceName: entry.sourceDeviceName || config.deviceName,
  };
}

async function pushDecisions(
  collection: Collection<CloudDecisionDoc>,
  reports: DreamReport[],
  config: EffectiveCloudSyncConfig
): Promise<number> {
  let pushed = 0;
  for (const report of reports) {
    for (const entry of report.reviewDecisions ?? []) {
      const next = decisionDoc(report, entry, config);
      if (!next) continue;
      const current = await collection.findOne({
        userId: config.userId,
        reportId: report.id,
        findingId: entry.findingId,
      });
      if (current && current.updatedAt > next.updatedAt) continue;
      await collection.updateOne(
        {
          userId: config.userId,
          reportId: report.id,
          findingId: entry.findingId,
        },
        { $set: next },
        { upsert: true }
      );
      pushed += 1;
    }
  }
  return pushed;
}

async function pullRemoteDecisions(
  collection: Collection<CloudDecisionDoc>,
  reports: DreamReport[],
  config: EffectiveCloudSyncConfig
): Promise<SyncedReviewDecision[]> {
  const reportIds = reports.map((report) => report.id);
  if (reportIds.length === 0) return [];
  const docs = await collection
    .find({
      userId: config.userId,
      reportId: { $in: reportIds },
      state: { $in: SYNC_DECISION_STATES },
    })
    .toArray();
  const allowedDeviceHashes = new Map(
    config.devices
      .filter((device) => device.status !== "revoked")
      .map((device) => [device.deviceId, device.tokenHash])
  );
  return docs
    .filter((doc) => {
      if (doc.sourceDeviceId === config.deviceId) return true;
      const expectedHash = allowedDeviceHashes.get(doc.sourceDeviceId);
      return Boolean(expectedHash && doc.deviceTokenHash === expectedHash);
    })
    .map((doc) => ({
      reportId: doc.reportId,
      findingId: doc.findingId,
      state: doc.state,
      updatedAt: doc.updatedAt,
      sourceDeviceId: doc.sourceDeviceId,
      sourceDeviceName: doc.sourceDeviceName,
      deviceTokenHash: doc.deviceTokenHash,
    }));
}

async function upsertDevice(
  collection: Collection,
  config: EffectiveCloudSyncConfig
): Promise<void> {
  const now = Date.now();
  await collection.updateOne(
    { userId: config.userId, deviceId: config.deviceId },
    {
      $set: {
        schemaVersion: SCHEMA_VERSION,
        userId: config.userId,
        deviceId: config.deviceId,
        deviceName: config.deviceName,
        client: "desktop",
        appName: APP_NAME,
        lastSeenAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
}

export function getCloudSyncStatus(): CloudSyncStatus {
  return status;
}

export function onCloudSyncStatusChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function syncCloudNow(): Promise<CloudSyncStatus> {
  const config = resolveConfig();
  if (!config.enabled) {
    await closeClient();
    resetStatusForConfig();
    return status;
  }
  if (!isConfigured(config)) {
    await closeClient();
    resetStatusForConfig();
    return status;
  }
  if (syncing) {
    syncAgain = true;
    return status;
  }

  syncing = true;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
  updateStatus({
    state: "syncing",
    message: "Syncing cycle history and decisions...",
    nextSyncAt: null,
  });

  try {
    const db = await ensureDb(config);
    const cycles = db.collection<CloudCycleDoc>(CYCLES_COLLECTION);
    const decisions = db.collection<CloudDecisionDoc>(DECISIONS_COLLECTION);
    const devices = db.collection(DEVICES_COLLECTION);

    await upsertDevice(devices, config);
    const beforePull = getReports();
    const cyclesPushedBeforePull = await pushCycles(cycles, beforePull, config);
    const remote = await pullRemoteDecisions(decisions, beforePull, config);
    const { applied } = mergeRemoteReviewDecisions(remote);
    const afterPull = getReports();
    const cyclesPushedAfterPull =
      applied > 0 ? await pushCycles(cycles, afterPull, config) : 0;
    const decisionsPushed = await pushDecisions(decisions, afterPull, config);
    const now = Date.now();

    startDecisionWatch(decisions, config);
    updateStatus({
      state: "watching",
      message: changeStream
        ? "Connected. Watching Atlas for phone and watch changes."
        : "Connected. Polling Atlas for phone and watch changes.",
      lastSyncedAt: now,
      lastPulledAt: remote.length > 0 ? now : status.lastPulledAt,
      lastPushedAt:
        cyclesPushedBeforePull + cyclesPushedAfterPull + decisionsPushed > 0
          ? now
          : status.lastPushedAt,
      cyclesPushed: cyclesPushedBeforePull + cyclesPushedAfterPull,
      decisionsPushed,
      remoteDecisionsApplied: applied,
      lastError: undefined,
    });
  } catch (err) {
    await closeClient();
    updateStatus({
      state: "offline",
      message: "Atlas is unavailable. Cloud Sync will retry.",
      lastError: err instanceof Error ? err.message : String(err),
    });
  } finally {
    syncing = false;
    if (syncAgain) {
      syncAgain = false;
      scheduleSync(250);
    } else {
      armPollingTimer();
    }
  }

  return status;
}

async function reconfigureCloudSync(): Promise<void> {
  await closeClient();
  resetStatusForConfig();
  const config = resolveConfig();
  if (isConfigured(config)) scheduleSync(0);
}

export function initCloudSync(): void {
  if (initialized) return;
  initialized = true;
  onConfigChange(() => {
    void reconfigureCloudSync();
  });
  onReportsChange(() => scheduleSync());
  void reconfigureCloudSync();
}

export async function shutdownCloudSync(): Promise<void> {
  await closeClient();
}
