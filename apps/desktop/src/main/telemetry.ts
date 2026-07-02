import os from "node:os";
import path from "node:path";
import { app } from "electron";
import chokidar, { type FSWatcher } from "chokidar";

import type {
  ConfigArtifact,
  HarnessKind,
  IngestStatus,
  LiveMetricDetail,
  LiveTelemetrySnapshot,
  LiveTelemetrySource,
} from "../shared/types";
import {
  buildMetricDetail,
  buildTelemetrySnapshot,
  type TelemetryDetailInput,
} from "./telemetryAnalytics";
import {
  discoverTelemetryFiles,
  ingestTelemetryFiles,
  type TelemetryDiscoveryProgress,
  type IngestResult,
  type TelemetryFileRef,
} from "./telemetryConnectors";
import { scanHarnessConfig } from "./harnessConfigScanner";
import { getConfig, onConfigChange } from "./store";
import { openTelemetryStore, type TelemetryStore } from "./telemetryStore";

type SnapshotListener = (snapshot: LiveTelemetrySnapshot) => void;
type StatusListener = (status: IngestStatus) => void;

const DAY = 24 * 60 * 60 * 1000;
const WATCH_REFRESH_DELAY_MS = 1_500;
const SNAPSHOT_LOOKBACK_MS = 15 * DAY;
const CONFIG_SCAN_CACHE_MS = 60_000;
const REFRESH_CHANGED_FILE_LIMIT = 50;
const BACKFILL_DELAY_MS = 2_000;
const STARTUP_DISCOVERY_BATCH_SIZE = 200;
const BACKGROUND_DISCOVERY_BATCH_SIZE = 500;

let store: TelemetryStore | null = null;
let watcher: FSWatcher | null = null;
let snapshot: LiveTelemetrySnapshot | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let backfillTimer: ReturnType<typeof setTimeout> | null = null;
let refreshing = false;
let pendingRefresh = false;
let status: IngestStatus = idleStatus("idle", "Telemetry has not started.");
let unsubscribeConfig: (() => void) | null = null;
let lastDiscoveredFiles: TelemetryFileRef[] = [];
let telemetryConfigSignature = "";
let configArtifactCache: {
  scannedAt: number;
  artifacts: ConfigArtifact[];
} | null = null;
let configArtifactRefresh: Promise<void> | null = null;

const snapshotListeners = new Set<SnapshotListener>();
const statusListeners = new Set<StatusListener>();

function idleStatus(
  state: IngestStatus["state"],
  message: string,
  patch: Partial<IngestStatus> = {}
): IngestStatus {
  return {
    state,
    message,
    startedAt: null,
    finishedAt: null,
    filesDiscovered: 0,
    filesChanged: 0,
    eventsIngested: 0,
    cursorsUpdated: 0,
    ...patch,
  };
}

function emitStatus(next: IngestStatus): void {
  status = next;
  for (const listener of statusListeners) listener(status);
}

function emitSnapshot(next: LiveTelemetrySnapshot): void {
  snapshot = next;
  for (const listener of snapshotListeners) listener(snapshot);
}

function enabledSources(): HarnessKind[] {
  const config = getConfig();
  const sources: HarnessKind[] = [];
  if (config.connectors.claudeCode) sources.push("claude-code");
  if (config.connectors.codex) sources.push("codex");
  return sources;
}

function watchedRoots(homeDir = os.homedir()): string[] {
  const config = getConfig();
  const roots: string[] = [];
  if (config.connectors.claudeCode) {
    roots.push(path.join(homeDir, ".claude", "projects"));
  }
  if (config.connectors.codex) {
    roots.push(path.join(homeDir, ".codex", "sessions"));
    roots.push(path.join(homeDir, ".codex", "archived_sessions"));
  }
  return roots;
}

function sourceLabel(source: HarnessKind): string {
  switch (source) {
    case "claude-code":
      return "Claude Code";
    case "codex":
      return "Codex";
    case "cursor":
      return "Cursor";
    case "code":
      return "Code";
  }
}

function filesBySource(files: TelemetryFileRef[]): Map<HarnessKind, number> {
  const counts = new Map<HarnessKind, number>();
  for (const file of files) {
    counts.set(file.source, (counts.get(file.source) ?? 0) + 1);
  }
  return counts;
}

function mergeSources(
  summaries: LiveTelemetrySource[],
  files: TelemetryFileRef[]
): LiveTelemetrySource[] {
  const bySource = new Map(summaries.map((item) => [item.source, item]));
  const fileCounts = filesBySource(files);
  return enabledSources().map((source) => {
    const existing = bySource.get(source);
    const filesForSource = fileCounts.get(source) ?? existing?.files ?? 0;
    if (!existing) {
      return {
        source,
        label: sourceLabel(source),
        status: filesForSource > 0 ? "watching" : "missing",
        files: filesForSource,
        events: 0,
        sessions: 0,
        lastActivityAt: null,
        message:
          filesForSource > 0
            ? "Waiting for new normalized rows."
            : "No local session files found.",
      };
    }
    return {
      ...existing,
      label: sourceLabel(source),
      status: status.state === "scanning" ? "scanning" : "watching",
      files: Math.max(existing.files, filesForSource),
    };
  });
}

function enabledProjectPaths(): string[] {
  const projectPaths = getConfig()
    .projects.filter((project) => project.enabled)
    .map((project) => project.path);
  return projectPaths.length > 0 ? projectPaths : [process.cwd()];
}

function telemetryRelevantConfigSignature(): string {
  const config = getConfig();
  return JSON.stringify({
    connectors: {
      claudeCode: config.connectors.claudeCode,
      codex: config.connectors.codex,
    },
    telemetry: {
      enabled: config.telemetry.enabled,
      watch: config.telemetry.watch,
      retentionDays: config.telemetry.retentionDays,
      rawTextRetention: config.telemetry.rawTextRetention,
      priceTable: config.telemetry.priceTable,
    },
    projects: config.projects
      .filter((project) => project.enabled)
      .map((project) => project.path)
      .sort(),
  });
}

function refreshConfigArtifactsInBackground(now: number): void {
  if (configArtifactRefresh) return;
  configArtifactRefresh = scanHarnessConfig({
    projectPaths: enabledProjectPaths(),
    workspacePath: process.cwd(),
    homeDir: os.homedir(),
    now,
  })
    .then((artifacts) => {
      configArtifactCache = { scannedAt: Date.now(), artifacts };
      if (!store || !snapshot) return;
      return rebuildSnapshot(lastDiscoveredFiles, {
        allowStaleConfig: true,
      }).then(emitSnapshot);
    })
    .catch((err) => {
      console.warn("[telemetry] config artifact scan failed", err);
    })
    .finally(() => {
      configArtifactRefresh = null;
    });
}

async function configArtifacts(
  now: number,
  allowStale: boolean
): Promise<ConfigArtifact[]> {
  if (
    configArtifactCache &&
    now - configArtifactCache.scannedAt < CONFIG_SCAN_CACHE_MS
  ) {
    return configArtifactCache.artifacts;
  }
  if (allowStale) {
    refreshConfigArtifactsInBackground(now);
    return configArtifactCache?.artifacts ?? [];
  }
  const artifacts = await scanHarnessConfig({
    projectPaths: enabledProjectPaths(),
    workspacePath: process.cwd(),
    homeDir: os.homedir(),
    now,
  });
  configArtifactCache = { scannedAt: now, artifacts };
  return artifacts;
}

async function rebuildSnapshot(
  files: TelemetryFileRef[],
  options: { allowStaleConfig?: boolean } = {}
): Promise<LiveTelemetrySnapshot> {
  if (!store) return emptySnapshot(status);
  const now = Date.now();
  const [events, summaries, artifacts] = await Promise.all([
    store.eventsSince(now - SNAPSHOT_LOOKBACK_MS),
    store.sourceSummaries(),
    configArtifacts(now, options.allowStaleConfig ?? false),
  ]);
  return buildTelemetrySnapshot({
    events,
    sources: mergeSources(summaries, files),
    configArtifacts: artifacts,
    status,
    now,
  });
}

function ingestMessage(
  result: IngestResult,
  archivedBackfillQueued = false
): string {
  const archivedSuffix = archivedBackfillQueued
    ? " Archived sessions are queued for background backfill."
    : "";
  if (result.filesDiscovered === 0)
    return `No local harness session files found.${archivedSuffix}`;
  if (result.filesPending > 0 && result.filesChanged === 0) {
    return `${result.filesPending} historical file${result.filesPending === 1 ? "" : "s"} queued for background backfill.${archivedSuffix}`;
  }
  if (result.filesChanged === 0)
    return `No new harness activity since last scan.${archivedSuffix}`;
  const suffix =
    result.filesPending > 0
      ? ` ${result.filesPending} older changed file${result.filesPending === 1 ? "" : "s"} queued.${archivedSuffix}`
      : archivedSuffix;
  return `Ingested ${result.eventsIngested} event${result.eventsIngested === 1 ? "" : "s"} from ${result.filesChanged} changed file${result.filesChanged === 1 ? "" : "s"}.${suffix}`;
}

export async function initTelemetryService(): Promise<LiveTelemetrySnapshot> {
  if (store) return getTelemetrySnapshot();
  const dataDir = path.join(app.getPath("userData"), "harness-health-pglite");
  store = await openTelemetryStore(dataDir);
  telemetryConfigSignature = telemetryRelevantConfigSignature();
  unsubscribeConfig = onConfigChange(() => {
    const nextSignature = telemetryRelevantConfigSignature();
    if (nextSignature === telemetryConfigSignature) return;
    telemetryConfigSignature = nextSignature;
    configArtifactCache = null;
    lastDiscoveredFiles = [];
    void restartWatcher();
    scheduleTelemetryRefresh("config");
  });
  await restartWatcher();
  return refreshTelemetry("startup");
}

export async function shutdownTelemetryService(): Promise<void> {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (backfillTimer) clearTimeout(backfillTimer);
  refreshTimer = null;
  backfillTimer = null;
  unsubscribeConfig?.();
  unsubscribeConfig = null;
  if (watcher) await watcher.close();
  watcher = null;
  if (store) await store.close();
  store = null;
}

async function restartWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
  if (!getConfig().telemetry.enabled || !getConfig().telemetry.watch) return;
  const roots = watchedRoots().filter((root) => root.length > 0);
  if (roots.length === 0) return;
  watcher = chokidar.watch(roots, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 600, pollInterval: 100 },
    depth: 12,
    ignored: (candidate, stats) =>
      Boolean(stats?.isFile()) && !candidate.endsWith(".jsonl"),
  });
  watcher.on("add", () => scheduleTelemetryRefresh("watch:add"));
  watcher.on("change", () => scheduleTelemetryRefresh("watch:change"));
  watcher.on("error", (err) => {
    emitStatus(
      idleStatus("error", "Telemetry watcher failed.", {
        lastError: err instanceof Error ? err.message : String(err),
      })
    );
  });
}

export function scheduleTelemetryRefresh(reason = "watch"): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refreshTelemetry(reason);
  }, WATCH_REFRESH_DELAY_MS);
}

function scheduleBackfill(): void {
  if (backfillTimer) return;
  backfillTimer = setTimeout(() => {
    backfillTimer = null;
    void refreshTelemetry("background-backfill");
  }, BACKFILL_DELAY_MS);
}

function shouldDeferArchivedSessions(reason: string): boolean {
  return reason === "startup" || reason === "snapshot";
}

function discoveryBatchSize(reason: string): number {
  return shouldDeferArchivedSessions(reason)
    ? STARTUP_DISCOVERY_BATCH_SIZE
    : BACKGROUND_DISCOVERY_BATCH_SIZE;
}

function discoveryProgressMessage(
  progress: TelemetryDiscoveryProgress,
  reason: string
): string {
  const phase =
    progress.phase === "root-complete"
      ? `${progress.rootsScanned}/${progress.rootsTotal} roots`
      : "listing";
  const scope = shouldDeferArchivedSessions(reason)
    ? "active session files"
    : "local harness files";
  return `Scanning ${scope} (${phase}) - ${progress.filesDiscovered.toLocaleString()} found.`;
}

async function discoverFilesForRefresh(
  reason: string,
  startedAt: number
): Promise<TelemetryFileRef[]> {
  const includeArchived = !shouldDeferArchivedSessions(reason);
  const sources = enabledSources();
  const files = (
    await discoverTelemetryFiles({
      sources,
      includeArchived,
      useWorker: true,
      batchSize: discoveryBatchSize(reason),
      onProgress: (progress) => {
        emitStatus(
          idleStatus("scanning", discoveryProgressMessage(progress, reason), {
            startedAt,
            filesDiscovered: progress.filesDiscovered,
          })
        );
      },
    })
  ).filter((file) => sources.includes(file.source));
  lastDiscoveredFiles = files;
  if (!includeArchived && getConfig().connectors.codex) scheduleBackfill();
  return files;
}

export async function refreshTelemetry(
  reason = "manual"
): Promise<LiveTelemetrySnapshot> {
  if (!store) {
    return emptySnapshot(status);
  }
  if (!getConfig().telemetry.enabled) {
    emitStatus(idleStatus("idle", "Realtime telemetry is disabled."));
    const disabled = emptySnapshot(status);
    emitSnapshot(disabled);
    return disabled;
  }
  if (refreshing) {
    if (
      reason === "background-backfill" ||
      reason === "config" ||
      reason.startsWith("watch:")
    ) {
      pendingRefresh = true;
    }
    return snapshot ?? emptySnapshot(status);
  }

  refreshing = true;
  const startedAt = Date.now();
  emitStatus(
    idleStatus("scanning", `Scanning harness telemetry (${reason}).`, {
      startedAt,
    })
  );

  try {
    const files = await discoverFilesForRefresh(reason, startedAt);
    emitStatus(
      idleStatus(
        "scanning",
        `Ingesting recent telemetry from ${files.length.toLocaleString()} file${files.length === 1 ? "" : "s"}.`,
        {
          startedAt,
          filesDiscovered: files.length,
        }
      )
    );
    const result = await ingestTelemetryFiles(store, {
      files,
      now: Date.now(),
      maxChangedFiles: REFRESH_CHANGED_FILE_LIMIT,
      prioritizeRecent: true,
    });
    emitStatus(
      idleStatus(
        "watching",
        ingestMessage(
          result,
          shouldDeferArchivedSessions(reason) && getConfig().connectors.codex
        ),
        {
          startedAt,
          finishedAt: Date.now(),
          filesDiscovered: result.filesDiscovered,
          filesChanged: result.filesChanged,
          eventsIngested: result.eventsIngested,
          cursorsUpdated: result.cursorsUpdated,
        }
      )
    );
    if (result.filesPending > 0) scheduleBackfill();
    const next = await rebuildSnapshot(files, { allowStaleConfig: true });
    emitSnapshot(next);
    return next;
  } catch (err) {
    emitStatus(
      idleStatus("error", "Telemetry scan failed.", {
        startedAt,
        finishedAt: Date.now(),
        lastError: err instanceof Error ? err.message : String(err),
      })
    );
    const next = await rebuildSnapshot(lastDiscoveredFiles, {
      allowStaleConfig: true,
    });
    emitSnapshot(next);
    return next;
  } finally {
    refreshing = false;
    if (pendingRefresh) {
      pendingRefresh = false;
      scheduleTelemetryRefresh("pending");
    }
  }
}

export async function getTelemetrySnapshot(): Promise<LiveTelemetrySnapshot> {
  if (!store) return snapshot ?? emptySnapshot(status);
  if (snapshot) return snapshot;
  const next = await rebuildSnapshot(lastDiscoveredFiles, {
    allowStaleConfig: true,
  });
  emitSnapshot(next);
  if (!refreshing && !refreshTimer) scheduleTelemetryRefresh("snapshot");
  return next;
}

export async function getTelemetryMetricDetail(
  input: TelemetryDetailInput
): Promise<LiveMetricDetail> {
  const now = Date.now();
  const rangeDays =
    input.range === "90d"
      ? 180
      : input.range === "30d"
        ? 60
        : input.range === "7d"
          ? 14
          : 2;
  const filter = input.filters
    ? {
        source: input.filters.source,
        projectPath: input.filters.projectPath,
        model: input.filters.model,
      }
    : undefined;
  const events = store
    ? await store.eventsSince(now - rangeDays * DAY, filter)
    : [];
  const sources = store ? await store.sourceSummaries() : [];
  return buildMetricDetail(input, events, sources, now);
}

export function getTelemetryIngestStatus(): IngestStatus {
  return status;
}

export function onTelemetrySnapshot(listener: SnapshotListener): () => void {
  snapshotListeners.add(listener);
  return () => snapshotListeners.delete(listener);
}

export function onTelemetryIngestStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export function emptySnapshot(ingestStatus = status): LiveTelemetrySnapshot {
  const now = Date.now();
  return {
    generatedAt: now,
    window: { start: now - DAY, end: now, label: "Last 24 hours" },
    baselineWindow: {
      start: now - 15 * DAY,
      end: now - DAY,
      label: "Previous 14 days",
    },
    rings: [
      {
        key: "efficiency",
        label: "Efficiency",
        score: 0,
        delta: 0,
        hint: "No normalized telemetry yet.",
      },
      {
        key: "effectiveness",
        label: "Effectiveness",
        score: 0,
        delta: 0,
        hint: "No normalized telemetry yet.",
      },
      {
        key: "alignment",
        label: "Alignment",
        score: 0,
        delta: 0,
        hint: "No normalized telemetry yet.",
      },
    ],
    metrics: [],
    insights: [],
    sources: enabledSources().map((source) => ({
      source,
      label: sourceLabel(source),
      status: "missing",
      files: 0,
      events: 0,
      sessions: 0,
      lastActivityAt: null,
    })),
    activeProjects: [],
    modelMix: [],
    trendSeries: [],
    configArtifacts: [],
    status: ingestStatus,
  };
}
