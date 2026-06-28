import Anthropic from "@anthropic-ai/sdk";

import { app } from "electron";
import type { WebContents } from "electron";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { Send } from "../shared/channels";
import { getReports } from "./reports";
import { getConfig } from "./store";

const SESSIONS_FILE = "harness-dreams-chat-sessions.json";
const MAX_SESSIONS = 100;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  at: number;
}

export interface ChatSession {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface SessionSummary {
  sessionId: string;
  updatedAt: number;
  preview: string;
}

type Sessions = Record<string, ChatSession>;

let sessions: Sessions = {};
let sessionsPath = "";
const activeStreams = new Map<string, AbortController>();

function persistSessions(): void {
  if (!sessionsPath) return;
  try {
    mkdirSync(path.dirname(sessionsPath), { recursive: true });
    const tmp = `${sessionsPath}.tmp`;
    writeFileSync(tmp, JSON.stringify(sessions, null, 2), "utf8");
    renameSync(tmp, sessionsPath);
  } catch (err) {
    console.error("[chat] failed to persist sessions", err);
  }
}

export function initChat(): void {
  sessionsPath = path.join(app.getPath("userData"), SESSIONS_FILE);
  try {
    if (existsSync(sessionsPath)) {
      sessions = JSON.parse(readFileSync(sessionsPath, "utf8")) as Sessions;
    }
  } catch (err) {
    console.error("[chat] failed to load sessions", err);
    sessions = {};
  }
}

export function listChatSessions(limit = 20): SessionSummary[] {
  return Object.values(sessions)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map((s) => {
      const first = s.messages.find((m) => m.role === "user");
      return {
        sessionId: s.sessionId,
        updatedAt: s.updatedAt,
        preview: first ? first.content.slice(0, 80) : "",
      };
    });
}

export function getChatSession(sessionId: string): ChatSession | null {
  return sessions[sessionId] ?? null;
}

function buildSystemPrompt(): string {
  const reports = getReports();
  const config = getConfig();
  const latest = reports[0] ?? null;

  let ctx =
    "You are Dream, an AI assistant built into Harness Dreams — a tool that analyzes coding agent session logs and surfaces insights about AI harness health, alignment, and effectiveness.\n\n" +
    "Help the user understand their AI coding harness activity: patterns, alignment scores, friction points, and what to improve next.";

  if (latest) {
    const date = new Date(latest.timestamp).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    ctx += `\n\nLatest dream cycle (${date}, ${latest.rangeLabel}):`;
    ctx += `\n- Sessions analyzed: ${latest.sessions}`;
    ctx += `\n- Projects: ${latest.projects}`;
    if (latest.rings?.length) {
      for (const ring of latest.rings) {
        ctx += `\n- ${ring.label}: ${ring.score}/100`;
      }
    }
    if (latest.digest) {
      ctx += `\n\nSummary: ${latest.digest}`;
    }
    if (latest.findings?.length) {
      ctx += `\n\nKey findings:`;
      for (const f of latest.findings.slice(0, 5)) {
        ctx += `\n- ${f.title}`;
        if (f.improvement) ctx += `: ${f.improvement}`;
      }
    }
    if (latest.projectInsights?.length) {
      ctx += `\n\nProject breakdown:`;
      for (const pi of latest.projectInsights.slice(0, 5)) {
        ctx += `\n- ${pi.name ?? pi.path} — alignment ${pi.alignment}/100`;
      }
    }
  }

  if (reports.length > 1) {
    ctx += `\n\n${reports.length} total dream cycles on record.`;
  }

  if (config.projects?.length) {
    const names = config.projects
      .map((p) =>
        "name" in p && p.name ? String(p.name) : path.basename(String(p.path))
      )
      .join(", ");
    ctx += `\n\nMonitored projects: ${names}.`;
  }

  return ctx;
}

export async function sendChatMessage(
  sender: WebContents,
  incomingMessages: Array<{ role: string; content: string }>,
  existingSessionId?: string
): Promise<string> {
  const now = Date.now();

  const sid =
    existingSessionId && sessions[existingSessionId]
      ? existingSessionId
      : randomUUID();

  if (!sessions[sid]) {
    sessions[sid] = {
      sessionId: sid,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
  }

  const userMsg = incomingMessages[incomingMessages.length - 1];
  if (userMsg?.role === "user") {
    sessions[sid].messages.push({
      role: "user",
      content: userMsg.content,
      at: now,
    });
    sessions[sid].updatedAt = now;
    persistSessions();
  }

  // Prune oldest sessions when over limit
  const allKeys = Object.keys(sessions);
  if (allKeys.length > MAX_SESSIONS) {
    const sorted = Object.values(sessions).sort(
      (a, b) => a.updatedAt - b.updatedAt
    );
    for (const old of sorted.slice(0, allKeys.length - MAX_SESSIONS)) {
      delete sessions[old.sessionId];
    }
  }

  const abort = new AbortController();
  activeStreams.set(sid, abort);

  const client = new Anthropic();
  const assistantTokens: string[] = [];

  try {
    const stream = await client.messages.stream(
      {
        model: "claude-opus-4-8",
        max_tokens: 4096,

        system: buildSystemPrompt(),
        messages: incomingMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      },
      { signal: abort.signal }
    );

    for await (const event of stream) {
      if (abort.signal.aborted) break;

      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        assistantTokens.push(event.delta.text);
        sender.send(Send.ChatChunk, { type: "token", data: event.delta.text });
      }
    }
  } catch (err) {
    if (!abort.signal.aborted) {
      const message = err instanceof Error ? err.message : "Chat error";
      sender.send(Send.ChatChunk, { type: "error", message });
    }
  } finally {
    activeStreams.delete(sid);

    const full = assistantTokens.join("");
    if (full) {
      sessions[sid].messages.push({
        role: "assistant",
        content: full,
        at: Date.now(),
      });
      sessions[sid].updatedAt = Date.now();
      persistSessions();
    }

    sender.send(Send.ChatChunk, { type: "done", sessionId: sid });
  }

  return sid;
}

export function abortChatStream(sessionId: string): void {
  activeStreams.get(sessionId)?.abort();
  activeStreams.delete(sessionId);
}
