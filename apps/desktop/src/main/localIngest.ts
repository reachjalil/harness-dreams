import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type {
  AnalysisProject,
  AnalysisSource,
  DiscoveredProject,
} from "../shared/types";

export type Role = "user" | "assistant";

/**
 * Claude Code stores tool *results* as `user`-role messages, so a raw role is
 * not a reliable signal of who spoke. `kind` separates real human/agent turns
 * from tool-result turns, which carry file dumps and command output rather than
 * conversation.
 */
export type TurnKind = "user" | "assistant" | "tool_result";

export interface LocalTurn {
  kind: TurnKind;
  content: string;
  timestamp: number;
  /** An assistant turn that invoked a tool. */
  hasToolCall: boolean;
  /** A tool-result turn that reported an error. */
  toolError: boolean;
}

export interface LocalSession {
  id: string;
  source: AnalysisSource;
  projectPath: string;
  projectName: string;
  startedAt: number;
  endedAt: number;
  turns: LocalTurn[];
  rawPath: string;
}

const HOME = os.homedir();
const MAX_CODEX_FILES = 900;
const MAX_CLAUDE_FILES_PER_PROJECT = 80;
const MAX_CONTENT = 2000;

function truncate(text: string): string {
  return text.length > MAX_CONTENT
    ? `${text.slice(0, MAX_CONTENT)}... [truncated ${text.length - MAX_CONTENT} chars]`
    : text;
}

function safeReadDir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function safeStat(file: string): ReturnType<typeof statSync> | null {
  try {
    return statSync(file);
  } catch {
    return null;
  }
}

function mtimeMs(file: string): number | null {
  const value = safeStat(file)?.mtimeMs;
  return typeof value === "number"
    ? value
    : value == null
      ? null
      : Number(value);
}

function parseJsonLine(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function readJsonl(file: string, maxLines = 8_000): Record<string, unknown>[] {
  try {
    return readFileSync(file, "utf8")
      .split(/\r?\n/)
      .slice(0, maxLines)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseJsonLine)
      .filter((item): item is Record<string, unknown> => Boolean(item));
  } catch {
    return [];
  }
}

function timestamp(value: unknown, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function basename(projectPath: string): string {
  return path.basename(projectPath) || projectPath;
}

function addProject(
  projects: Map<string, DiscoveredProject>,
  projectPath: string,
  source: AnalysisSource,
  sessionCount: number,
  lastActivityAt: number | null
): void {
  if (!projectPath) return;
  const existing = projects.get(projectPath);
  if (existing) {
    if (!existing.sources.includes(source)) existing.sources.push(source);
    existing.sessionCount += sessionCount;
    existing.lastActivityAt =
      existing.lastActivityAt == null
        ? lastActivityAt
        : lastActivityAt == null
          ? existing.lastActivityAt
          : Math.max(existing.lastActivityAt, lastActivityAt);
    return;
  }
  projects.set(projectPath, {
    path: projectPath,
    name: basename(projectPath),
    sources: [source],
    sessionCount,
    lastActivityAt,
  });
}

function decodeClaudeProject(encoded: string): string {
  return `/${encoded.replace(/^-+/, "").replaceAll("-", "/")}`;
}

function claudeProjectPath(dir: string, files: string[]): string {
  for (const file of files.slice(0, 4)) {
    for (const event of readJsonl(file, 120)) {
      if (typeof event.cwd === "string" && event.cwd) return event.cwd;
    }
  }
  return decodeClaudeProject(path.basename(dir));
}

function claudeProjectDirs(): string[] {
  const root = path.join(HOME, ".claude", "projects");
  if (!existsSync(root)) return [];
  return safeReadDir(root)
    .map((name) => path.join(root, name))
    .filter((item) => safeStat(item)?.isDirectory());
}

function recentJsonlFiles(dir: string, limit: number): string[] {
  return safeReadDir(dir)
    .map((name) => path.join(dir, name))
    .filter((item) => item.endsWith(".jsonl") && safeStat(item)?.isFile())
    .sort((a, b) => (mtimeMs(b) ?? 0) - (mtimeMs(a) ?? 0))
    .slice(0, limit);
}

function walkJsonl(root: string, limit: number): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0 && out.length < limit) {
    const dir = stack.pop();
    if (!dir) continue;
    for (const name of safeReadDir(dir)) {
      const item = path.join(dir, name);
      const st = safeStat(item);
      if (!st) continue;
      if (st.isDirectory()) stack.push(item);
      else if (item.endsWith(".jsonl")) out.push(item);
      if (out.length >= limit) break;
    }
  }
  return out.sort((a, b) => (mtimeMs(b) ?? 0) - (mtimeMs(a) ?? 0));
}

interface ClaudeContent {
  text: string;
  isToolResult: boolean;
  toolError: boolean;
  hasToolUse: boolean;
}

function blockText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) =>
      block &&
      typeof block === "object" &&
      typeof (block as Record<string, unknown>).text === "string"
        ? ((block as Record<string, unknown>).text as string)
        : ""
    )
    .filter(Boolean)
    .join(" ");
}

function extractClaudeContent(content: unknown): ClaudeContent {
  if (typeof content === "string") {
    return {
      text: content,
      isToolResult: false,
      toolError: false,
      hasToolUse: false,
    };
  }
  if (!Array.isArray(content)) {
    return { text: "", isToolResult: false, toolError: false, hasToolUse: false };
  }
  const parts: string[] = [];
  let isToolResult = false;
  let toolError = false;
  let hasToolUse = false;
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const item = block as Record<string, unknown>;
    if (item.type === "text" && typeof item.text === "string") {
      parts.push(item.text);
    } else if (item.type === "tool_use") {
      hasToolUse = true;
    } else if (item.type === "tool_result") {
      isToolResult = true;
      if (item.is_error === true) toolError = true;
      const text = blockText(item.content);
      if (text) parts.push(text);
    }
  }
  return { text: parts.join("\n"), isToolResult, toolError, hasToolUse };
}

function parseClaudeSession(
  file: string,
  projectPath: string
): LocalSession | null {
  const turns: LocalTurn[] = [];
  for (const event of readJsonl(file)) {
    if (typeof event.message !== "object" || event.message == null) continue;
    const message = event.message as Record<string, unknown>;
    const role = message.role;
    if (role !== "user" && role !== "assistant") continue;
    const parsed = extractClaudeContent(message.content);
    const content = truncate(parsed.text);
    const kind: TurnKind = parsed.isToolResult ? "tool_result" : role;
    // Drop empty conversational turns, but keep tool-only assistant turns (they
    // carry a tool call) and every tool-result turn (timing + error signal).
    if (kind === "user" && !content.trim()) continue;
    if (kind === "assistant" && !content.trim() && !parsed.hasToolUse) continue;
    turns.push({
      kind,
      content,
      timestamp: timestamp(event.timestamp, mtimeMs(file) ?? Date.now()),
      hasToolCall: parsed.hasToolUse,
      toolError: parsed.toolError,
    });
  }
  if (turns.length === 0) return null;
  turns.sort((a, b) => a.timestamp - b.timestamp);
  return {
    id: `claude-code:${projectPath}:${path.basename(file, ".jsonl")}`,
    source: "claude-code",
    projectPath,
    projectName: basename(projectPath),
    startedAt: turns[0]?.timestamp ?? Date.now(),
    endedAt: turns.at(-1)?.timestamp ?? Date.now(),
    turns,
    rawPath: file,
  };
}

function parseCodexProject(file: string): string | null {
  for (const event of readJsonl(file, 200)) {
    if (event.type !== "session_meta") continue;
    const payload = event.payload;
    if (payload && typeof payload === "object") {
      const cwd = (payload as Record<string, unknown>).cwd;
      if (typeof cwd === "string" && cwd) return cwd;
    }
  }
  return null;
}

function extractCodexText(payload: Record<string, unknown>): string {
  if (typeof payload.message === "string") return payload.message;
  const content = payload.content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const item = block as Record<string, unknown>;
      return typeof item.text === "string" ? item.text : "";
    })
    .filter(Boolean)
    .join(" ");
}

function parseCodexSession(file: string): LocalSession | null {
  const events = readJsonl(file);
  const projectPath =
    events
      .map((event) =>
        event.type === "session_meta" &&
        event.payload &&
        typeof event.payload === "object"
          ? ((event.payload as Record<string, unknown>).cwd as
              | string
              | undefined)
          : undefined
      )
      .find(Boolean) ?? "";
  if (!projectPath) return null;

  const turns: LocalTurn[] = [];
  for (const event of events) {
    const payload =
      event.payload && typeof event.payload === "object"
        ? (event.payload as Record<string, unknown>)
        : {};
    if (event.type === "response_item") {
      const role = payload.role;
      if (role !== "user" && role !== "assistant") continue;
      const content = truncate(extractCodexText(payload));
      if (!content.trim() || content.startsWith("<environment_context>"))
        continue;
      turns.push({
        kind: role,
        content,
        timestamp: timestamp(event.timestamp, mtimeMs(file) ?? Date.now()),
        hasToolCall: false,
        toolError: false,
      });
    } else if (event.type === "event_msg" && payload.type === "user_message") {
      const content = truncate(extractCodexText(payload));
      if (!content.trim()) continue;
      turns.push({
        kind: "user",
        content,
        timestamp: timestamp(event.timestamp, mtimeMs(file) ?? Date.now()),
        hasToolCall: false,
        toolError: false,
      });
    }
  }
  if (turns.length === 0) return null;
  turns.sort((a, b) => a.timestamp - b.timestamp);
  return {
    id: `codex:${projectPath}:${path.basename(file, ".jsonl")}`,
    source: "codex",
    projectPath,
    projectName: basename(projectPath),
    startedAt: turns[0]?.timestamp ?? Date.now(),
    endedAt: turns.at(-1)?.timestamp ?? Date.now(),
    turns,
    rawPath: file,
  };
}

export function discoverAnalysisProjects(): DiscoveredProject[] {
  const projects = new Map<string, DiscoveredProject>();

  for (const dir of claudeProjectDirs()) {
    const files = recentJsonlFiles(dir, MAX_CLAUDE_FILES_PER_PROJECT);
    const projectPath = claudeProjectPath(dir, files);
    const lastActivityAt = files.reduce<number | null>((latest, file) => {
      const mtime = mtimeMs(file);
      return latest == null
        ? mtime
        : mtime == null
          ? latest
          : Math.max(latest, mtime);
    }, null);
    addProject(
      projects,
      projectPath,
      "claude-code",
      files.length,
      lastActivityAt
    );
  }

  const codexRoot = path.join(HOME, ".codex");
  if (existsSync(codexRoot)) {
    for (const file of walkJsonl(codexRoot, MAX_CODEX_FILES)) {
      const projectPath = parseCodexProject(file);
      if (projectPath) {
        addProject(projects, projectPath, "codex", 1, mtimeMs(file));
      }
    }
  }

  const codeRoot = path.join(HOME, ".code");
  if (existsSync(codeRoot)) {
    addProject(projects, codeRoot, "code", 0, mtimeMs(codeRoot));
  }

  return [...projects.values()].sort(
    (a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0)
  );
}

function enabledPaths(projects: AnalysisProject[]): Set<string> {
  return new Set(
    projects.filter((project) => project.enabled).map((project) => project.path)
  );
}

/**
 * Ingest the enabled projects' sessions, optionally limited to those with
 * activity at or after `sinceMs`. A file untouched since the window start is
 * skipped cheaply via mtime before it's ever parsed.
 */
export function ingestSelectedSessions(
  projects: AnalysisProject[],
  sinceMs = 0,
  untilMs = Number.POSITIVE_INFINITY
): LocalSession[] {
  const selected = enabledPaths(projects);
  if (selected.size === 0) return [];
  const sessions: LocalSession[] = [];

  for (const dir of claudeProjectDirs()) {
    const files = recentJsonlFiles(dir, MAX_CLAUDE_FILES_PER_PROJECT);
    const projectPath = claudeProjectPath(dir, files);
    if (!selected.has(projectPath)) continue;
    for (const file of files) {
      if (sinceMs > 0 && (mtimeMs(file) ?? 0) < sinceMs) continue;
      const session = parseClaudeSession(file, projectPath);
      if (
        session &&
        session.endedAt >= sinceMs &&
        session.startedAt <= untilMs
      ) {
        sessions.push(session);
      }
    }
  }

  const codexRoot = path.join(HOME, ".codex");
  if (existsSync(codexRoot)) {
    for (const file of walkJsonl(codexRoot, MAX_CODEX_FILES)) {
      if (sinceMs > 0 && (mtimeMs(file) ?? 0) < sinceMs) continue;
      const session = parseCodexSession(file);
      if (
        session &&
        selected.has(session.projectPath) &&
        session.endedAt >= sinceMs &&
        session.startedAt <= untilMs
      ) {
        sessions.push(session);
      }
    }
  }

  return sessions.sort((a, b) => b.endedAt - a.endedAt);
}
