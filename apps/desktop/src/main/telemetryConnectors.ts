import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import type { Dirent, Stats } from "node:fs";
import { open, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";

import type {
  HarnessKind,
  IngestCursor,
  NormalizedEvent,
  NormalizedEventKind,
} from "../shared/types";
import { logger } from "./logger";
import type { TelemetryStore } from "./telemetryStore";

export const CONNECTOR_VERSION = "2026-06-29.realtime-v1";

export interface TelemetryFileRef {
  source: HarnessKind;
  filePath: string;
  root: string;
}

export interface IngestOptions {
  homeDir?: string;
  files?: TelemetryFileRef[];
  now?: number;
  maxChangedFiles?: number;
  prioritizeRecent?: boolean;
}

export interface TelemetryDiscoveryProgress {
  phase: "listing" | "root-complete" | "done";
  root: string | null;
  source: HarnessKind | null;
  rootsScanned: number;
  rootsTotal: number;
  filesDiscovered: number;
  directoriesScanned: number;
}

export interface DiscoverTelemetryFilesOptions {
  homeDir?: string;
  sources?: HarnessKind[];
  includeArchived?: boolean;
  useWorker?: boolean;
  batchSize?: number;
  batchDelayMs?: number;
  onProgress?: (progress: TelemetryDiscoveryProgress) => void;
}

export interface IngestResult {
  filesDiscovered: number;
  filesChanged: number;
  filesPending: number;
  eventsIngested: number;
  cursorsUpdated: number;
}

interface ParseContext {
  source: HarnessKind;
  filePath: string;
  root: string;
  size: number;
  mtimeMs: number;
}

interface FileState {
  sessionId: string;
  projectPath: string;
  projectName: string;
  model?: string;
  permissionMode?: string;
}

type JsonRecord = Record<string, unknown>;

const USER_MESSAGE_TYPES = new Set(["user", "user_message", "message"]);
const ASSISTANT_MESSAGE_TYPES = new Set(["assistant", "assistant_message"]);
const STAT_CONCURRENCY = 64;
const DISCOVERY_BATCH_SIZE = 250;
const DISCOVERY_BATCH_DELAY_MS = 6;
const TRANSIENT_READ_CODES = new Set([
  "EBUSY",
  "EAGAIN",
  "EMFILE",
  "ENFILE",
  "ENOENT",
  "EPERM",
]);
const TRANSIENT_READ_ATTEMPTS = 3;

const DISCOVERY_WORKER_SOURCE = `
const { existsSync } = require("node:fs");
const { readdir } = require("node:fs/promises");
const path = require("node:path");
const { parentPort, workerData } = require("node:worker_threads");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function postProgress(progress) {
  parentPort.postMessage({ type: "progress", progress });
}

async function walkJsonl(root, source, progressState) {
  const files = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    progressState.directoriesScanned += 1;
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push({ source, filePath: fullPath, root });
        progressState.filesDiscovered += 1;
      }
    }

    if (
      progressState.filesDiscovered >= progressState.nextFileProgress ||
      progressState.directoriesScanned >= progressState.nextDirectoryProgress
    ) {
      progressState.nextFileProgress =
        progressState.filesDiscovered + progressState.batchSize;
      progressState.nextDirectoryProgress =
        progressState.directoriesScanned + Math.max(32, Math.floor(progressState.batchSize / 4));
      postProgress({
        phase: "listing",
        root,
        source,
        rootsScanned: progressState.rootsScanned,
        rootsTotal: progressState.rootsTotal,
        filesDiscovered: progressState.filesDiscovered,
        directoriesScanned: progressState.directoriesScanned,
      });
      if (progressState.batchDelayMs > 0) {
        await delay(progressState.batchDelayMs);
      }
    }
  }

  return files;
}

(async () => {
  const roots = workerData.roots;
  const progressState = {
    rootsScanned: 0,
    rootsTotal: roots.length,
    filesDiscovered: 0,
    directoriesScanned: 0,
    nextFileProgress: workerData.batchSize,
    nextDirectoryProgress: 32,
    batchSize: workerData.batchSize,
    batchDelayMs: workerData.batchDelayMs,
  };
  const groups = [];

  for (const item of roots) {
    postProgress({
      phase: "listing",
      root: item.root,
      source: item.source,
      rootsScanned: progressState.rootsScanned,
      rootsTotal: progressState.rootsTotal,
      filesDiscovered: progressState.filesDiscovered,
      directoriesScanned: progressState.directoriesScanned,
    });

    if (existsSync(item.root)) {
      groups.push(await walkJsonl(item.root, item.source, progressState));
    }

    progressState.rootsScanned += 1;
    postProgress({
      phase: "root-complete",
      root: item.root,
      source: item.source,
      rootsScanned: progressState.rootsScanned,
      rootsTotal: progressState.rootsTotal,
      filesDiscovered: progressState.filesDiscovered,
      directoriesScanned: progressState.directoriesScanned,
    });

    if (progressState.batchDelayMs > 0) {
      await delay(progressState.batchDelayMs);
    }
  }

  const files = groups.flat().sort((a, b) => a.filePath.localeCompare(b.filePath));
  parentPort.postMessage({
    type: "done",
    progress: {
      phase: "done",
      root: null,
      source: null,
      rootsScanned: progressState.rootsTotal,
      rootsTotal: progressState.rootsTotal,
      filesDiscovered: files.length,
      directoriesScanned: progressState.directoriesScanned,
    },
    files,
  });
})().catch((err) => {
  parentPort.postMessage({
    type: "error",
    message: err instanceof Error ? err.message : String(err),
  });
});
`;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTransientReadRetry<T>(
  operation: () => Promise<T>
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < TRANSIENT_READ_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const finalAttempt = attempt === TRANSIENT_READ_ATTEMPTS - 1;
      const code = errorCode(error);
      if (finalAttempt || !code || !TRANSIENT_READ_CODES.has(code)) {
        throw error;
      }
      await delay(25 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Transient file read failed.");
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseTimestamp(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function stableId(parts: unknown[]): string {
  return createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 32);
}

function projectName(projectPath: string): string {
  return path.basename(projectPath) || projectPath;
}

function decodeClaudeProjectPath(filePath: string, root: string): string {
  const rel = path.relative(root, filePath);
  const first = rel.split(path.sep)[0] ?? "";
  if (!first.startsWith("-")) return first || "Unknown project";
  return first.replace(/^-/, path.sep).replace(/-/g, path.sep);
}

function fallbackSessionId(filePath: string): string {
  return path.basename(filePath, ".jsonl");
}

function initialState(context: ParseContext): FileState {
  const projectPath =
    context.source === "claude-code"
      ? decodeClaudeProjectPath(context.filePath, context.root)
      : "Unknown project";
  return {
    sessionId: fallbackSessionId(context.filePath),
    projectPath,
    projectName: projectName(projectPath),
  };
}

function eventBase(
  context: ParseContext,
  state: FileState,
  record: JsonRecord,
  rawLine: number,
  seq: number,
  kind: NormalizedEventKind
): NormalizedEvent {
  return {
    id: stableId([context.source, context.filePath, rawLine, seq, kind]),
    source: context.source,
    connectorVersion: CONNECTOR_VERSION,
    sessionId: state.sessionId,
    projectPath: state.projectPath,
    projectName: state.projectName,
    ts: parseTimestamp(record.timestamp, context.mtimeMs),
    seq,
    kind,
    model: state.model,
    permissionMode: state.permissionMode,
    rawPath: context.filePath,
    rawLine,
  };
}

function updateStateFromRecord(
  state: FileState,
  context: ParseContext,
  record: JsonRecord
): void {
  const payload = isRecord(record.payload) ? record.payload : undefined;
  const message = isRecord(record.message) ? record.message : undefined;
  const git = isRecord(record.git) ? record.git : undefined;
  const payloadGit = isRecord(payload?.git) ? payload.git : undefined;

  const sessionId =
    str(record.sessionId) ??
    str(record.session_id) ??
    str(payload?.session_id) ??
    str(payload?.id) ??
    str(record.id);
  if (sessionId) state.sessionId = sessionId;

  const cwd = str(record.cwd) ?? str(payload?.cwd);
  if (cwd) {
    state.projectPath = cwd;
    state.projectName = projectName(cwd);
  } else if (context.source === "codex") {
    const worktree =
      str(git?.repository_url) ??
      str(git?.cwd) ??
      str(payloadGit?.repository_url) ??
      str(payloadGit?.cwd);
    if (worktree && state.projectPath === "Unknown project") {
      state.projectPath = worktree;
      state.projectName = projectName(worktree);
    }
  }

  const model =
    str(message?.model) ??
    str(record.model) ??
    str(payload?.model) ??
    str(payload?.model_provider);
  if (model) state.model = model;

  const permissionMode =
    str(record.permissionMode) ?? str(payload?.permission_mode);
  if (permissionMode) state.permissionMode = permissionMode;
}

function usageFrom(value: unknown): {
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
} {
  const usage = isRecord(value) ? value : {};
  return {
    tokensIn: num(usage.input_tokens) ?? num(usage.inputTokens) ?? 0,
    tokensOut: num(usage.output_tokens) ?? num(usage.outputTokens) ?? 0,
    cacheReadTokens:
      num(usage.cache_read_input_tokens) ??
      num(usage.cacheReadInputTokens) ??
      0,
    cacheCreateTokens:
      num(usage.cache_creation_input_tokens) ??
      num(usage.cacheCreationInputTokens) ??
      0,
  };
}

function usageCandidate(record: JsonRecord, message?: JsonRecord): unknown {
  const payload = isRecord(record.payload) ? record.payload : undefined;
  const internal = isRecord(payload?.internal_chat_message_metadata_passthrough)
    ? payload.internal_chat_message_metadata_passthrough
    : undefined;
  return (
    message?.usage ??
    record.usage ??
    payload?.usage ??
    internal?.usage ??
    undefined
  );
}

function roleOf(
  record: JsonRecord,
  message?: JsonRecord
): NormalizedEvent["role"] {
  const role = str(message?.role) ?? str(record.role);
  if (role === "user" || role === "assistant" || role === "system") return role;
  return undefined;
}

function toolParts(toolName: string): {
  toolName: string;
  mcpServer?: string;
  mcpTool?: string;
} {
  const match = toolName.match(/^mcp__([^_]+(?:_[^_]+)*)__([^_].*)$/);
  if (!match) return { toolName };
  return {
    toolName,
    mcpServer: match[1],
    mcpTool: match[2],
  };
}

function contentItems(message?: JsonRecord): JsonRecord[] {
  return Array.isArray(message?.content)
    ? message.content.filter(isRecord)
    : [];
}

function toolOutcome(item: JsonRecord): NormalizedEvent["toolOutcome"] {
  if (item.is_error === true) return "error";
  if (item.error === true) return "error";
  if (str(item.type) === "permission_denied") return "denied";
  return "ok";
}

function parseClaudeRecord(
  context: ParseContext,
  state: FileState,
  record: JsonRecord,
  rawLine: number
): NormalizedEvent[] {
  updateStateFromRecord(state, context, record);
  const events: NormalizedEvent[] = [];
  const message = isRecord(record.message) ? record.message : undefined;
  const type = str(record.type);
  const role = roleOf(record, message);
  let seq = 0;

  if (type === "queue-operation") {
    events.push(eventBase(context, state, record, rawLine, seq++, "meta"));
    return events;
  }

  if (role === "user" || type === "user") {
    events.push({
      ...eventBase(context, state, record, rawLine, seq++, "user_prompt"),
      role: "user",
    });
  }

  if (role === "assistant" || type === "assistant") {
    events.push({
      ...eventBase(context, state, record, rawLine, seq++, "assistant_message"),
      role: "assistant",
    });
  }

  const usage = usageCandidate(record, message);
  if (usage != null) {
    events.push({
      ...eventBase(context, state, record, rawLine, seq++, "model_call"),
      role: "assistant",
      model: str(message?.model) ?? state.model,
      ...usageFrom(usage),
      speed: num(record.speed),
      iterations: num(record.iterations),
    });
  }

  for (const item of contentItems(message)) {
    const itemType = str(item.type);
    if (itemType === "tool_use") {
      const name = str(item.name) ?? "unknown-tool";
      const parts = toolParts(name);
      events.push({
        ...eventBase(
          context,
          state,
          record,
          rawLine,
          seq++,
          parts.mcpServer ? "mcp_call" : "tool_call"
        ),
        toolName: parts.toolName,
        mcpServer: parts.mcpServer,
        mcpTool: parts.mcpTool,
        toolOutcome: "ok",
      });
      if (/skill/i.test(name)) {
        events.push({
          ...eventBase(
            context,
            state,
            record,
            rawLine,
            seq++,
            "skill_invocation"
          ),
          toolName: name,
        });
      }
    } else if (itemType === "tool_result") {
      events.push({
        ...eventBase(context, state, record, rawLine, seq++, "tool_result"),
        toolName: str(item.name) ?? str(item.tool_name) ?? "tool-result",
        toolOutcome: toolOutcome(item),
      });
    }
  }

  if (type === "permission" || type === "permission_decision") {
    events.push(
      eventBase(context, state, record, rawLine, seq++, "permission_decision")
    );
  }

  return events;
}

function payloadRecord(record: JsonRecord): JsonRecord {
  return isRecord(record.payload) ? record.payload : record;
}

function parseCodexRecord(
  context: ParseContext,
  state: FileState,
  record: JsonRecord,
  rawLine: number
): NormalizedEvent[] {
  updateStateFromRecord(state, context, record);
  const events: NormalizedEvent[] = [];
  const payload = payloadRecord(record);
  const topType = str(record.type) ?? str(record.record_type);
  const payloadType = str(payload.type);
  const kind = topType ?? payloadType;
  let seq = 0;

  if (kind === "session_meta") {
    updateStateFromRecord(state, context, payload);
    events.push(eventBase(context, state, record, rawLine, seq++, "meta"));
    return events;
  }

  if (kind === "turn_context") {
    updateStateFromRecord(state, context, payload);
    if (str(payload.collaboration_mode)) {
      events.push(
        eventBase(context, state, record, rawLine, seq++, "mode_change")
      );
    } else {
      events.push(eventBase(context, state, record, rawLine, seq++, "meta"));
    }
    return events;
  }

  if (kind === "event_msg") {
    const eventType = str(payload.type);
    const eventKind: NormalizedEventKind =
      eventType === "user_message"
        ? "user_prompt"
        : eventType?.includes("permission")
          ? "permission_decision"
          : "meta";
    events.push(eventBase(context, state, record, rawLine, seq++, eventKind));
    return events;
  }

  if (kind === "response_item" || USER_MESSAGE_TYPES.has(kind ?? "")) {
    const itemType = payloadType ?? kind;
    const role = str(payload.role) ?? str(record.role);
    if (role === "user") {
      events.push({
        ...eventBase(context, state, record, rawLine, seq++, "user_prompt"),
        role: "user",
      });
    } else if (role === "assistant") {
      events.push({
        ...eventBase(
          context,
          state,
          record,
          rawLine,
          seq++,
          "assistant_message"
        ),
        role: "assistant",
      });
    } else if (
      itemType === "function_call" ||
      itemType === "custom_tool_call" ||
      itemType === "local_shell_call"
    ) {
      const name =
        str(payload.name) ??
        str(payload.tool_name) ??
        (itemType === "local_shell_call" ? "local_shell" : "tool");
      const parts = toolParts(name);
      events.push({
        ...eventBase(
          context,
          state,
          record,
          rawLine,
          seq++,
          parts.mcpServer ? "mcp_call" : "tool_call"
        ),
        toolName: parts.toolName,
        mcpServer: parts.mcpServer,
        mcpTool: parts.mcpTool,
        toolOutcome: "ok",
      });
    } else if (itemType === "function_call_output") {
      events.push({
        ...eventBase(context, state, record, rawLine, seq++, "tool_result"),
        toolName: str(payload.name) ?? "tool-result",
        toolOutcome: str(payload.error) ? "error" : "ok",
      });
    }
  } else if (ASSISTANT_MESSAGE_TYPES.has(kind ?? "")) {
    events.push({
      ...eventBase(context, state, record, rawLine, seq++, "assistant_message"),
      role: "assistant",
    });
  }

  const usage = usageCandidate(record);
  if (usage != null) {
    events.push({
      ...eventBase(context, state, record, rawLine, seq++, "model_call"),
      role: "assistant",
      ...usageFrom(usage),
    });
  }

  return events;
}

async function walkJsonl(
  root: string,
  source: HarnessKind
): Promise<TelemetryFileRef[]> {
  const files: TelemetryFileRef[] = [];
  async function walk(current: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push({ source, filePath: fullPath, root });
      }
    }
  }
  if (existsSync(root)) await walk(root);
  return files;
}

interface TelemetryDiscoveryRoot {
  source: HarnessKind;
  root: string;
}

type WorkerDiscoveryMessage =
  | { type: "progress"; progress: TelemetryDiscoveryProgress }
  | {
      type: "done";
      progress: TelemetryDiscoveryProgress;
      files: TelemetryFileRef[];
    }
  | { type: "error"; message: string };

function parseDiscoverOptions(
  input?: string | DiscoverTelemetryFilesOptions
): Required<
  Pick<
    DiscoverTelemetryFilesOptions,
    "homeDir" | "includeArchived" | "useWorker" | "batchSize" | "batchDelayMs"
  >
> &
  Pick<DiscoverTelemetryFilesOptions, "sources" | "onProgress"> {
  if (typeof input === "string") {
    return {
      homeDir: input,
      includeArchived: true,
      useWorker: false,
      batchSize: DISCOVERY_BATCH_SIZE,
      batchDelayMs: DISCOVERY_BATCH_DELAY_MS,
    };
  }
  return {
    homeDir: input?.homeDir ?? os.homedir(),
    sources: input?.sources,
    includeArchived: input?.includeArchived ?? true,
    useWorker: input?.useWorker ?? false,
    batchSize: input?.batchSize ?? DISCOVERY_BATCH_SIZE,
    batchDelayMs: input?.batchDelayMs ?? DISCOVERY_BATCH_DELAY_MS,
    onProgress: input?.onProgress,
  };
}

function telemetryDiscoveryRoots(
  homeDir: string,
  sources?: HarnessKind[],
  includeArchived = true
): TelemetryDiscoveryRoot[] {
  const enabled = new Set<HarnessKind>(
    sources && sources.length > 0 ? sources : ["claude-code", "codex"]
  );
  const roots: TelemetryDiscoveryRoot[] = [];
  if (enabled.has("claude-code")) {
    roots.push({
      source: "claude-code",
      root: path.join(homeDir, ".claude", "projects"),
    });
  }
  if (enabled.has("codex")) {
    roots.push({
      source: "codex",
      root: path.join(homeDir, ".codex", "sessions"),
    });
    if (includeArchived) {
      roots.push({
        source: "codex",
        root: path.join(homeDir, ".codex", "archived_sessions"),
      });
    }
  }
  return roots;
}

function discoverTelemetryFilesInWorker(
  roots: TelemetryDiscoveryRoot[],
  options: Required<
    Pick<DiscoverTelemetryFilesOptions, "batchSize" | "batchDelayMs">
  > &
    Pick<DiscoverTelemetryFilesOptions, "onProgress">
): Promise<TelemetryFileRef[]> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(DISCOVERY_WORKER_SOURCE, {
      eval: true,
      workerData: {
        roots,
        batchSize: options.batchSize,
        batchDelayMs: options.batchDelayMs,
      },
    });

    function finish(): boolean {
      if (settled) return false;
      settled = true;
      void worker.terminate();
      return true;
    }

    function resolveOnce(files: TelemetryFileRef[]): void {
      if (!finish()) return;
      resolve(files);
    }

    function rejectOnce(err: unknown): void {
      if (!finish()) return;
      reject(err instanceof Error ? err : new Error(String(err)));
    }

    worker.on("message", (message: WorkerDiscoveryMessage) => {
      if (message.type === "progress") {
        options.onProgress?.(message.progress);
        return;
      }
      if (message.type === "done") {
        options.onProgress?.(message.progress);
        resolveOnce(message.files);
        return;
      }
      rejectOnce(
        new Error(message.message || "Telemetry discovery worker failed.")
      );
    });
    worker.on("error", rejectOnce);
    worker.on("exit", (code) => {
      if (code !== 0 && !settled) {
        rejectOnce(
          new Error(`Telemetry discovery worker exited with code ${code}.`)
        );
      }
    });
  });
}

export async function discoverTelemetryFiles(
  input?: string | DiscoverTelemetryFilesOptions
): Promise<TelemetryFileRef[]> {
  const options = parseDiscoverOptions(input);
  const roots = telemetryDiscoveryRoots(
    options.homeDir,
    options.sources,
    options.includeArchived
  );
  if (options.useWorker) {
    return discoverTelemetryFilesInWorker(roots, {
      batchSize: options.batchSize,
      batchDelayMs: options.batchDelayMs,
      onProgress: options.onProgress,
    });
  }
  const groups = await Promise.all(
    roots.map(({ source, root }) => walkJsonl(root, source))
  );
  const files = groups
    .flat()
    .sort((a, b) => a.filePath.localeCompare(b.filePath));
  options.onProgress?.({
    phase: "done",
    root: null,
    source: null,
    rootsScanned: roots.length,
    rootsTotal: roots.length,
    filesDiscovered: files.length,
    directoriesScanned: 0,
  });
  return files;
}

function isCurrentCursor(
  cursor: IngestCursor | null | undefined,
  info: Stats
): cursor is IngestCursor {
  return Boolean(
    cursor &&
      cursor.connectorVersion === CONNECTOR_VERSION &&
      cursor.size === info.size &&
      Math.round(cursor.mtimeMs) === Math.round(info.mtimeMs)
  );
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index]);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

async function readFileSlice(
  filePath: string,
  start: number,
  end: number
): Promise<string> {
  const length = Math.max(0, end - start);
  if (length === 0) return "";

  return withTransientReadRetry(async () => {
    const handle = await open(filePath, "r");
    try {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, start);
      return buffer.subarray(0, bytesRead).toString("utf8");
    } finally {
      await handle.close();
    }
  });
}

function completeJsonlPrefix(raw: string): {
  text: string;
  lines: string[];
} {
  if (raw.length === 0) return { text: "", lines: [] };

  const complete = raw.endsWith("\n") || raw.endsWith("\r\n");
  const text = complete
    ? raw
    : raw.lastIndexOf("\n") >= 0
      ? raw.slice(0, raw.lastIndexOf("\n") + 1)
      : "";
  if (text.length === 0) return { text, lines: [] };

  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return { text, lines };
}

export async function parseTelemetryFile(
  file: TelemetryFileRef,
  cursor: IngestCursor | null,
  now = Date.now(),
  fileInfo?: Stats
): Promise<{
  cursor: IngestCursor;
  events: NormalizedEvent[];
  changed: boolean;
}> {
  const info =
    fileInfo ?? (await withTransientReadRetry(() => stat(file.filePath)));
  const canResume =
    cursor &&
    cursor.connectorVersion === CONNECTOR_VERSION &&
    cursor.size <= info.size &&
    cursor.byteOffset > 0;
  const lineStart = canResume ? cursor.lineOffset : 0;
  const readStart = canResume ? cursor.byteOffset : 0;
  const changed = !isCurrentCursor(cursor, info);

  if (!changed) {
    return {
      cursor: {
        filePath: file.filePath,
        source: file.source,
        connectorVersion: CONNECTOR_VERSION,
        size: info.size,
        mtimeMs: info.mtimeMs,
        lineOffset: cursor.lineOffset,
        byteOffset: cursor.byteOffset,
        updatedAt: now,
      },
      events: [],
      changed: false,
    };
  }

  const raw = await readFileSlice(file.filePath, readStart, info.size);
  const { text, lines } = completeJsonlPrefix(raw);

  const context: ParseContext = {
    source: file.source,
    filePath: file.filePath,
    root: file.root,
    size: info.size,
    mtimeMs: info.mtimeMs,
  };
  const state = initialState(context);
  const events: NormalizedEvent[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim();
    if (!line) continue;
    let record: JsonRecord;
    try {
      const parsed: unknown = JSON.parse(line);
      if (!isRecord(parsed)) continue;
      record = parsed;
    } catch {
      continue;
    }
    const parsedEvents =
      file.source === "claude-code"
        ? parseClaudeRecord(context, state, record, lineStart + index + 1)
        : parseCodexRecord(context, state, record, lineStart + index + 1);
    events.push(...parsedEvents);
  }

  return {
    cursor: {
      filePath: file.filePath,
      source: file.source,
      connectorVersion: CONNECTOR_VERSION,
      size: info.size,
      mtimeMs: info.mtimeMs,
      lineOffset: lineStart + lines.length,
      byteOffset: readStart + Buffer.byteLength(text, "utf8"),
      updatedAt: now,
    },
    events,
    changed,
  };
}

export async function ingestTelemetryFiles(
  store: TelemetryStore,
  options: IngestOptions = {}
): Promise<IngestResult> {
  const now = options.now ?? Date.now();
  const files =
    options.files ??
    (await discoverTelemetryFiles(options.homeDir ?? os.homedir()));
  let filesChanged = 0;
  let eventsIngested = 0;
  let cursorsUpdated = 0;
  const cursors = await store.getCursors(files.map((file) => file.filePath));
  const snapshots = (
    await mapConcurrent(files, STAT_CONCURRENCY, async (file) => {
      try {
        return {
          file,
          info: await withTransientReadRetry(() => stat(file.filePath)),
        };
      } catch (err) {
        logger.warn("[telemetry] failed to stat", file.filePath, err);
        return null;
      }
    })
  ).filter(
    (snapshot): snapshot is { file: TelemetryFileRef; info: Stats } =>
      snapshot != null
  );
  const changedSnapshots = snapshots.filter(
    ({ file, info }) => !isCurrentCursor(cursors.get(file.filePath), info)
  );
  const orderedSnapshots = options.prioritizeRecent
    ? [...changedSnapshots].sort((a, b) => b.info.mtimeMs - a.info.mtimeMs)
    : changedSnapshots;
  const selectedSnapshots =
    options.maxChangedFiles && options.maxChangedFiles > 0
      ? orderedSnapshots.slice(0, options.maxChangedFiles)
      : orderedSnapshots;
  const updatedCursors: IngestCursor[] = [];

  for (const { file, info } of selectedSnapshots) {
    try {
      const cursor = cursors.get(file.filePath) ?? null;
      const parsed = await parseTelemetryFile(file, cursor, now, info);
      if (!parsed.changed) continue;
      filesChanged += 1;
      eventsIngested += await store.upsertEvents(parsed.events);
      updatedCursors.push(parsed.cursor);
      cursorsUpdated += 1;
    } catch (err) {
      logger.warn("[telemetry] failed to ingest", file.filePath, err);
    }
  }
  await store.upsertCursors(updatedCursors);

  return {
    filesDiscovered: files.length,
    filesChanged,
    filesPending: Math.max(
      0,
      orderedSnapshots.length - selectedSnapshots.length
    ),
    eventsIngested,
    cursorsUpdated,
  };
}
