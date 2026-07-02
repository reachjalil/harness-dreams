import { randomBytes, randomUUID } from "node:crypto";

import {
  encryptSnapshotBackupPackage,
  peerReviewDecisionBatchV1Schema,
  sha256Base64Url,
  snapshotBackupApiUrl,
  snapshotBackupAuthToken,
  type PeerReviewDecisionBatchV1,
  type SnapshotBackupPayloadV1,
} from "@harness-health/core";

import { Send } from "../shared/channels";
import type {
  ActionState,
  CloudSyncConfig,
  CloudSyncStatus,
  HealthReport,
  PeerHostConnectionUpdate,
  PeerHostDevice,
  PeerHostPairingAccepted,
  PeerHostPairingSession,
  PeerHostState,
  SyncedReviewDecision,
} from "../shared/types";
import {
  getReports,
  mergeRemoteReviewDecisions,
  onReportsChange,
} from "./reports";
import { getConfig, onConfigChange, setConfig } from "./store";
import {
  broadcastToPeerHost,
  closePeerHost,
  getOrCreatePeerHost,
} from "./windows";
import { protectLocalSecret, revealLocalSecret } from "./localSecrets";
import { sanitizeReportForCloud } from "./cloudRedaction";

type Listener = (status: CloudSyncStatus) => void;

const listeners = new Set<Listener>();
const pairingSessions = new Map<string, PeerHostPairingSession>();
const activeConnections = new Set<string>();
const MAX_BACKUP_UPLOAD_ATTEMPTS = 5;
const MAX_BACKUP_RETRY_DELAY_MS = 2 * 60 * 1000;
const BASE_BACKUP_RETRY_DELAY_MS = 5 * 1000;
const RETAINED_BACKUP_KEY_COUNT = 5;

let initialized = false;
let iceMode: CloudSyncStatus["iceMode"] = "unknown";
let backupUploadInFlight = false;
let backupUploadAgain = false;
let backupRetryTimer: ReturnType<typeof setTimeout> | null = null;
let status: CloudSyncStatus = makeStatus(resolveConfig());

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function resolveConfig(): CloudSyncConfig {
  const config = getConfig().cloudSync;
  return {
    ...config,
    cloudApiBaseUrl:
      config.cloudApiBaseUrl ||
      env("HARNESS_HEALTH_CLOUD_API_BASE_URL") ||
      env("HARNESS_HEALTH_SIGNAL_API_BASE_URL") ||
      "http://127.0.0.1:8787",
    cloudUserId: config.cloudUserId,
  };
}

function planAllowsPrivateSync(config: CloudSyncConfig): boolean {
  return config.paidPlan || config.devBypassPaidPlan;
}

function isConfigured(config: CloudSyncConfig): boolean {
  return Boolean(
    config.enabled &&
      planAllowsPrivateSync(config) &&
      config.cloudApiBaseUrl &&
      config.cloudUserId &&
      config.deviceId
  );
}

function backupConfigured(config: CloudSyncConfig): boolean {
  return Boolean(
    config.backupEnabled &&
      config.cloudApiBaseUrl &&
      config.cloudUserId &&
      config.deviceId &&
      config.backupKey &&
      config.backupEpochId
  );
}

function generateBackupKey(): string {
  return randomBytes(32).toString("base64url");
}

function generateBackupKeyId(): string {
  return `snapshot-${randomUUID()}`;
}

function activeBackupKeyId(config: CloudSyncConfig): string {
  return config.backupKeyId || "snapshot-v1";
}

function clearBackupRetryTimer(): void {
  if (backupRetryTimer) clearTimeout(backupRetryTimer);
  backupRetryTimer = null;
}

function scheduleBackupRetryTimer(
  nextRetryAt: number | null | undefined
): void {
  clearBackupRetryTimer();
  if (!nextRetryAt) return;
  const delay = Math.max(0, nextRetryAt - Date.now());
  backupRetryTimer = setTimeout(() => {
    backupRetryTimer = null;
    void pushEncryptedSnapshotBackup("retry");
  }, delay);
}

function retryDelayMs(attempt: number): number {
  const base = Math.min(
    BASE_BACKUP_RETRY_DELAY_MS * 2 ** Math.max(0, attempt - 1),
    MAX_BACKUP_RETRY_DELAY_MS
  );
  return Math.min(
    MAX_BACKUP_RETRY_DELAY_MS,
    Math.round(base * (0.75 + Math.random() * 0.5))
  );
}

function retryGateBypassed(reason: string): boolean {
  return (
    reason === "manual-sync" || reason === "retry" || reason === "key-rotation"
  );
}

function reportUpdatedAt(report: HealthReport): number {
  const decisionTimes =
    report.reviewDecisions?.map(
      (entry) => entry.decidedAt ?? report.reviewedAt ?? report.timestamp
    ) ?? [];
  return Math.max(report.timestamp, report.reviewedAt ?? 0, ...decisionTimes);
}

function currentRevision(): number {
  return getReports().reduce(
    (revision, report) => Math.max(revision, reportUpdatedAt(report)),
    0
  );
}

function buildSnapshotBackupPayload(
  config: CloudSyncConfig
): SnapshotBackupPayloadV1 {
  const reports = getReports();
  const revision = currentRevision();
  return {
    schemaVersion: 1,
    cloudUserId: config.cloudUserId,
    epochId: config.backupEpochId,
    revision,
    desktopDeviceId: config.deviceId,
    desktopDeviceName: config.deviceName,
    ops: [
      {
        op: "replaceTable",
        table: "reports",
        rows: reports.map((report) => ({
          id: report.id,
          updatedAt: reportUpdatedAt(report),
          json: JSON.stringify(sanitizeReportForCloud(report)),
        })),
      },
      {
        op: "setMeta",
        key: "revision",
        value: String(revision),
      },
      {
        op: "setMeta",
        key: "desktopDeviceName",
        value: config.deviceName,
      },
      {
        op: "setMeta",
        key: "backupKeyId",
        value: activeBackupKeyId(config),
      },
    ],
    createdAt: Date.now(),
  };
}

function persistBackupFailure(input: {
  config: CloudSyncConfig;
  revision: number;
  reason: string;
  error: string;
}): void {
  const now = Date.now();
  const sameRevision =
    input.config.lastBackupFailureRevision === input.revision &&
    input.reason !== "manual-sync" &&
    input.reason !== "key-rotation";
  const priorAttempt = sameRevision
    ? (input.config.backupRetryAttempt ?? 0)
    : 0;
  const attempt = Math.min(priorAttempt + 1, MAX_BACKUP_UPLOAD_ATTEMPTS);
  const exhausted = attempt >= MAX_BACKUP_UPLOAD_ATTEMPTS;
  const nextRetryAt = exhausted ? 0 : now + retryDelayMs(attempt);
  setConfig({
    cloudSync: {
      lastBackupFailureAt: now,
      lastBackupFailureRevision: input.revision,
      backupRetryAttempt: attempt,
      nextBackupRetryAt: nextRetryAt,
      lastBackupError: input.error,
    },
  });
  scheduleBackupRetryTimer(nextRetryAt || null);
  updateStatus({
    state: "offline",
    message: exhausted
      ? "Encrypted backup fallback failed after retries. Manual sync can try again."
      : "Encrypted backup fallback could not be updated; retry scheduled.",
    lastError: input.error,
    lastBackupFailureAt: now,
    nextBackupRetryAt: nextRetryAt || null,
    backupRetryAttempt: attempt,
  });
}

async function pushEncryptedSnapshotBackup(reason: string): Promise<void> {
  const config = resolveConfig();
  if (!backupConfigured(config)) {
    updateStatus({
      backupEnabled: config.backupEnabled,
      backupConfigured: false,
    });
    return;
  }
  if (
    config.nextBackupRetryAt &&
    config.nextBackupRetryAt > Date.now() &&
    !retryGateBypassed(reason)
  ) {
    scheduleBackupRetryTimer(config.nextBackupRetryAt);
    updateStatus({
      message: "Encrypted backup fallback retry is scheduled.",
      nextBackupRetryAt: config.nextBackupRetryAt,
      backupRetryAttempt: config.backupRetryAttempt ?? 0,
      lastBackupFailureAt: config.lastBackupFailureAt ?? null,
      lastError: config.lastBackupError,
    });
    return;
  }
  if (backupUploadInFlight) {
    backupUploadAgain = true;
    return;
  }
  backupUploadInFlight = true;
  let attemptedRevision = currentRevision();
  try {
    const payload = buildSnapshotBackupPayload(config);
    attemptedRevision = payload.revision;
    if (
      config.lastBackupRevision &&
      config.lastBackupRevision >= payload.revision &&
      reason !== "manual-sync"
    ) {
      return;
    }
    const authToken = await snapshotBackupAuthToken({
      backupKey: config.backupKey,
      cloudUserId: config.cloudUserId,
    });
    const pkg = await encryptSnapshotBackupPackage({
      backupKey: config.backupKey,
      cloudUserId: config.cloudUserId,
      epochId: config.backupEpochId,
      revision: payload.revision,
      authorDeviceId: config.deviceId,
      payload,
      keyId: activeBackupKeyId(config),
      expiresAt: Date.now() + config.backupRetentionDays * 24 * 60 * 60 * 1000,
    });
    const response = await fetch(
      snapshotBackupApiUrl(
        config.cloudApiBaseUrl,
        `/backup/users/${encodeURIComponent(config.cloudUserId)}/snapshots`
      ),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pkg),
      }
    );
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Backup failed: ${response.status}`);
    }
    const now = Date.now();
    setConfig({
      cloudSync: {
        lastBackupAt: now,
        lastBackupRevision: payload.revision,
        lastBackupFailureAt: 0,
        lastBackupFailureRevision: 0,
        backupRetryAttempt: 0,
        nextBackupRetryAt: 0,
        lastBackupError: "",
      },
    });
    clearBackupRetryTimer();
    updateStatus({
      message:
        activeConnections.size > 0
          ? status.message
          : "Encrypted cloud fallback snapshot is current.",
      lastBackedUpAt: now,
      backupRevision: payload.revision,
      lastBackupFailureAt: null,
      nextBackupRetryAt: null,
      backupRetryAttempt: 0,
      lastError: undefined,
    });
  } catch (error) {
    persistBackupFailure({
      config,
      revision: attemptedRevision,
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    backupUploadInFlight = false;
    if (backupUploadAgain) {
      backupUploadAgain = false;
      void pushEncryptedSnapshotBackup("queued");
    }
  }
}

async function clearEncryptedSnapshotBackup(
  config: CloudSyncConfig
): Promise<void> {
  if (!config.backupKey || !config.cloudApiBaseUrl || !config.cloudUserId)
    return;
  try {
    const authToken = await snapshotBackupAuthToken({
      backupKey: config.backupKey,
      cloudUserId: config.cloudUserId,
    });
    await fetch(
      snapshotBackupApiUrl(
        config.cloudApiBaseUrl,
        `/backup/users/${encodeURIComponent(config.cloudUserId)}`
      ),
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      }
    ).catch(() => undefined);
  } finally {
    setConfig({
      cloudSync: {
        backupKey: "",
        backupKeyId: "",
        backupRetainedKeys: [],
        backupEpochId: "",
        lastBackupAt: 0,
        lastBackupRevision: 0,
        lastBackupFailureAt: 0,
        lastBackupFailureRevision: 0,
        backupRetryAttempt: 0,
        nextBackupRetryAt: 0,
        lastBackupError: "",
      },
    });
    clearBackupRetryTimer();
    updateStatus({
      backupEnabled: false,
      backupConfigured: false,
      backupRevision: 0,
      lastBackedUpAt: null,
      backupKeyId: "",
      lastBackupFailureAt: null,
      nextBackupRetryAt: null,
      backupRetryAttempt: 0,
    });
  }
}

function makeStatus(config: CloudSyncConfig): CloudSyncStatus {
  const configured = isConfigured(config);
  const allowedByPlan = planAllowsPrivateSync(config);
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
        ? "Private Device Sync is part of the paid plan. Dev bypass is off."
        : configured
          ? "Private Device Sync is ready for WebRTC pairing."
          : "Private Device Sync needs a signaling URL and local device id."
      : "Private Device Sync is off.",
    cloudUserId: config.cloudUserId,
    deviceId: config.deviceId,
    cloudApiBaseUrl: config.cloudApiBaseUrl,
    lastSyncedAt: null,
    lastPulledAt: null,
    lastPushedAt: null,
    nextSyncAt: null,
    reviewsPushed: 0,
    decisionsPushed: 0,
    remoteDecisionsApplied: 0,
    activeConnections: activeConnections.size,
    pairingActive: pairingSessions.size > 0,
    iceMode,
    revision: currentRevision(),
    backupEnabled: config.backupEnabled,
    backupConfigured: backupConfigured(config),
    backupRevision: config.lastBackupRevision ?? 0,
    backupKeyId: activeBackupKeyId(config),
    lastBackedUpAt: config.lastBackupAt ?? null,
    lastBackupFailureAt: config.lastBackupFailureAt || null,
    nextBackupRetryAt: config.nextBackupRetryAt || null,
    backupRetryAttempt: config.backupRetryAttempt ?? 0,
    lastError: config.lastBackupError || undefined,
  };
}

function updateStatus(patch: Partial<CloudSyncStatus>): CloudSyncStatus {
  const config = resolveConfig();
  const connected = activeConnections.size;
  status = {
    ...status,
    enabled: config.enabled,
    paidPlan: config.paidPlan,
    devBypassPaidPlan: config.devBypassPaidPlan,
    allowedByPlan: planAllowsPrivateSync(config),
    configured: isConfigured(config),
    cloudUserId: config.cloudUserId,
    deviceId: config.deviceId,
    cloudApiBaseUrl: config.cloudApiBaseUrl,
    activeConnections: connected,
    pairingActive: pairingSessions.size > 0,
    iceMode,
    revision: currentRevision(),
    backupEnabled: config.backupEnabled,
    backupConfigured: backupConfigured(config),
    backupRevision: config.lastBackupRevision ?? status.backupRevision ?? 0,
    backupKeyId: activeBackupKeyId(config),
    lastBackedUpAt: config.lastBackupAt ?? status.lastBackedUpAt ?? null,
    lastBackupFailureAt:
      config.lastBackupFailureAt || status.lastBackupFailureAt || null,
    nextBackupRetryAt:
      config.nextBackupRetryAt || status.nextBackupRetryAt || null,
    backupRetryAttempt:
      config.backupRetryAttempt ?? status.backupRetryAttempt ?? 0,
    lastError: config.lastBackupError || status.lastError,
    ...patch,
  };
  for (const listener of listeners) listener(status);
  return status;
}

function resetStatusForConfig(): void {
  status = makeStatus(resolveConfig());
  for (const listener of listeners) listener(status);
}

function ensurePeerHost(): void {
  if (!isConfigured(resolveConfig())) return;
  getOrCreatePeerHost();
}

function broadcastPeerHostRefresh(reason: string): void {
  broadcastToPeerHost(Send.PeerHostRefresh, { reason, at: Date.now() });
}

function decryptPairedDevices(config: CloudSyncConfig): PeerHostDevice[] {
  const devices: PeerHostDevice[] = [];
  for (const device of config.devices) {
    if (device.status !== "active" || !device.secretCiphertext) continue;
    const sharedSecret = revealLocalSecret(device.secretCiphertext);
    if (!sharedSecret) continue;
    devices.push({
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      kind: device.kind,
      status: device.status,
      sharedSecret,
      lastSeenAt: device.lastSeenAt,
      lastAckedRevision: device.lastAckedRevision,
    });
  }
  return devices;
}

export function getPeerHostState(): PeerHostState {
  const config = resolveConfig();
  return {
    enabled: config.enabled,
    allowedByPlan: planAllowsPrivateSync(config),
    signalUrl: config.cloudApiBaseUrl,
    cloudUserId: config.cloudUserId,
    desktopDeviceId: config.deviceId,
    desktopDeviceName: config.deviceName,
    devices: decryptPairedDevices(config),
    pairingSessions: [...pairingSessions.values()].filter(
      (session) => session.expiresAt > Date.now()
    ),
    reports: getReports(),
    revision: currentRevision(),
    backupEnabled: config.backupEnabled,
    backupEpochId: config.backupEpochId,
    backupKey: config.backupEnabled ? config.backupKey : "",
    backupKeyId: config.backupEnabled ? activeBackupKeyId(config) : "",
  };
}

export function registerPeerPairingSession(
  session: PeerHostPairingSession
): void {
  pairingSessions.set(session.pairingId, session);
  ensurePeerHost();
  broadcastToPeerHost(Send.PeerHostPairingSession, session);
  updateStatus({
    state: "watching",
    message: "Pairing QR is active. Waiting for the device camera scan.",
    nextSyncAt: session.expiresAt,
  });
}

export async function acceptPeerHostPairing(
  input: PeerHostPairingAccepted
): Promise<CloudSyncConfig["devices"]> {
  const session = pairingSessions.get(input.pairingId);
  if (!session || session.expiresAt <= Date.now()) {
    throw new Error("Pairing session expired.");
  }
  const now = Date.now();
  const nextDevice = {
    ...session.device,
    deviceId: input.deviceId,
    deviceName: input.deviceName,
    kind: input.kind,
    status: "active" as const,
    secretHash: await sha256Base64Url(input.pairedDeviceSecret),
    secretCiphertext: protectLocalSecret(input.pairedDeviceSecret),
    secretIssuedAt: now,
    lastSeenAt: now,
    revokedAt: undefined,
  };
  const config = getConfig().cloudSync;
  const devices = [
    nextDevice,
    ...config.devices.filter((device) => device.deviceId !== input.deviceId),
  ];
  pairingSessions.delete(input.pairingId);
  setConfig({
    cloudSync: { enabled: true, devices },
    companionSyncInterest: true,
  });
  broadcastPeerHostRefresh("pairing-accepted");
  updateStatus({
    state: "watching",
    message: `${input.deviceName} is paired. Establishing private WebRTC sync.`,
    lastSyncedAt: now,
    lastError: undefined,
  });
  return devices;
}

function decisionsFromBatch(
  batch: PeerReviewDecisionBatchV1
): SyncedReviewDecision[] {
  return batch.decisions.map((decision) => ({
    reportId: decision.reportId,
    findingId: decision.findingId,
    state: decision.state as Exclude<ActionState, "open">,
    updatedAt: decision.updatedAt,
    sourceDeviceId: decision.sourceDeviceId,
    sourceDeviceName: decision.sourceDeviceName ?? batch.sourceDeviceName,
  }));
}

export function applyPeerReviewDecisionBatch(input: unknown): {
  applied: number;
  revision: number;
} {
  const batch = peerReviewDecisionBatchV1Schema.parse(input);
  const { applied } = mergeRemoteReviewDecisions(decisionsFromBatch(batch));
  const now = Date.now();
  updateStatus({
    state: activeConnections.size > 0 ? "watching" : "connecting",
    message:
      applied > 0
        ? "Applied private device decisions on this Mac."
        : "Private device decisions were already current.",
    lastPulledAt: now,
    remoteDecisionsApplied: applied,
    lastSyncedAt: now,
    lastError: undefined,
  });
  broadcastPeerHostRefresh("decisions-applied");
  return { applied, revision: currentRevision() };
}

export function updatePeerHostConnection(
  update: PeerHostConnectionUpdate
): CloudSyncStatus {
  if (update.connected) activeConnections.add(update.deviceId);
  else activeConnections.delete(update.deviceId);
  if (update.iceMode) iceMode = update.iceMode;

  const config = getConfig().cloudSync;
  const devices = config.devices.map((device) =>
    device.deviceId === update.deviceId
      ? {
          ...device,
          status: update.connected ? ("active" as const) : device.status,
          lastSeenAt: update.lastSeenAt ?? device.lastSeenAt,
          lastAckedRevision:
            update.lastAckedRevision ?? device.lastAckedRevision,
        }
      : device
  );
  setConfig({ cloudSync: { devices } });
  return updateStatus({
    state: update.connected
      ? "watching"
      : isConfigured(resolveConfig())
        ? "connecting"
        : status.state,
    message: update.connected
      ? "Private WebRTC device sync is connected."
      : "No private devices are connected right now.",
    lastSyncedAt: update.connected ? Date.now() : status.lastSyncedAt,
    lastError: update.error,
  });
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
  if (!config.enabled || !isConfigured(config)) {
    closePeerHost();
    activeConnections.clear();
    resetStatusForConfig();
    return status;
  }
  ensurePeerHost();
  broadcastPeerHostRefresh("manual-sync");
  void pushEncryptedSnapshotBackup("manual-sync");
  return updateStatus({
    state: activeConnections.size > 0 ? "watching" : "connecting",
    message:
      activeConnections.size > 0
        ? "Sent the latest Mac snapshot over private WebRTC."
        : "Private Device Sync is waiting for paired devices to reconnect.",
    lastPushedAt: activeConnections.size > 0 ? Date.now() : status.lastPushedAt,
    reviewsPushed: getReports().length,
    nextSyncAt: null,
    lastError: undefined,
  });
}

export function rotateCloudBackupKey(): CloudSyncStatus {
  const config = resolveConfig();
  const now = Date.now();
  const retained = config.backupKey
    ? [
        {
          keyId: activeBackupKeyId(config),
          backupKey: config.backupKey,
          backupEpochId: config.backupEpochId || "snapshot-v1",
          retiredAt: now,
        },
        ...config.backupRetainedKeys,
      ].slice(0, RETAINED_BACKUP_KEY_COUNT)
    : config.backupRetainedKeys;
  setConfig({
    cloudSync: {
      enabled: true,
      backupEnabled: true,
      backupKey: generateBackupKey(),
      backupKeyId: generateBackupKeyId(),
      backupRetainedKeys: retained,
      backupEpochId: randomUUID(),
      lastBackupAt: 0,
      lastBackupRevision: 0,
      lastBackupFailureAt: 0,
      lastBackupFailureRevision: 0,
      backupRetryAttempt: 0,
      nextBackupRetryAt: 0,
      lastBackupError: "",
    },
    companionSyncInterest: true,
  });
  clearBackupRetryTimer();
  void pushEncryptedSnapshotBackup("key-rotation");
  return updateStatus({
    state: "syncing",
    message: "Backup key rotated. Re-uploading the latest encrypted snapshot.",
    backupRevision: 0,
    lastBackedUpAt: null,
    lastBackupFailureAt: null,
    nextBackupRetryAt: null,
    backupRetryAttempt: 0,
    lastError: undefined,
  });
}

function reconfigureCloudSync(): void {
  const config = resolveConfig();
  resetStatusForConfig();
  if (isConfigured(config)) {
    ensurePeerHost();
    broadcastPeerHostRefresh("config");
  } else {
    closePeerHost();
  }
  if (config.backupEnabled) {
    if (config.nextBackupRetryAt && config.nextBackupRetryAt > Date.now()) {
      scheduleBackupRetryTimer(config.nextBackupRetryAt);
    }
    void pushEncryptedSnapshotBackup("config");
  } else if (config.backupKey) {
    void clearEncryptedSnapshotBackup(config);
  }
}

export function initCloudSync(): void {
  if (initialized) return;
  initialized = true;
  onConfigChange(() => reconfigureCloudSync());
  onReportsChange(() => {
    updateStatus({
      revision: currentRevision(),
      lastSyncedAt: Date.now(),
      reviewsPushed: getReports().length,
    });
    broadcastPeerHostRefresh("reports");
    void pushEncryptedSnapshotBackup("reports");
  });
  reconfigureCloudSync();
  void pushEncryptedSnapshotBackup("startup");
}

export async function shutdownCloudSync(): Promise<void> {
  clearBackupRetryTimer();
  closePeerHost();
  activeConnections.clear();
  pairingSessions.clear();
  resetStatusForConfig();
}
