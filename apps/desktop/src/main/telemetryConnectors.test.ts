import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  discoverTelemetryFiles,
  ingestTelemetryFiles,
} from "./telemetryConnectors";
import { openTelemetryStore, type TelemetryStore } from "./telemetryStore";

const now = 1_783_000_000_000;

let tempRoot = "";
let store: TelemetryStore;

async function writeJsonl(filePath: string, rows: unknown[], partial = "") {
  await mkdir(path.dirname(filePath), { recursive: true });
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  await writeFile(filePath, `${body}\n${partial}`, "utf8");
}

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "hd-telemetry-test-"));
  store = await openTelemetryStore(path.join(tempRoot, "pglite"));
});

afterEach(async () => {
  await store.close();
  await rm(tempRoot, { recursive: true, force: true });
});

describe("telemetry connectors", () => {
  test("discovers files in a worker and can defer archived sessions", async () => {
    const homeDir = path.join(tempRoot, "home-worker");
    const claudeFile = path.join(
      homeDir,
      ".claude",
      "projects",
      "-Users-test-worker",
      "session.jsonl"
    );
    const codexFile = path.join(
      homeDir,
      ".codex",
      "sessions",
      "2026",
      "06",
      "29",
      "rollout.jsonl"
    );
    const archivedCodexFile = path.join(
      homeDir,
      ".codex",
      "archived_sessions",
      "2026",
      "06",
      "28",
      "old.jsonl"
    );
    await writeJsonl(claudeFile, []);
    await writeJsonl(codexFile, []);
    await writeJsonl(archivedCodexFile, []);

    const progress: string[] = [];
    const activeFiles = await discoverTelemetryFiles({
      homeDir,
      includeArchived: false,
      useWorker: true,
      batchSize: 1,
      batchDelayMs: 0,
      onProgress: (event) => progress.push(event.phase),
    });
    const allFiles = await discoverTelemetryFiles({
      homeDir,
      useWorker: true,
      batchSize: 1,
      batchDelayMs: 0,
    });

    expect(activeFiles.map((file) => file.filePath).sort()).toEqual(
      [claudeFile, codexFile].sort()
    );
    expect(allFiles.map((file) => file.filePath).sort()).toEqual(
      [archivedCodexFile, claudeFile, codexFile].sort()
    );
    expect(progress).toContain("done");
  });

  test("ingests Claude flat/nested files, Codex files, corrupt lines, partial writes, and cursor resume", async () => {
    const homeDir = path.join(tempRoot, "home");
    const claudeRoot = path.join(homeDir, ".claude", "projects");
    const claudeFile = path.join(
      claudeRoot,
      "-Users-test-project",
      "session.jsonl"
    );
    const nestedClaudeFile = path.join(
      claudeRoot,
      "-Users-test-project",
      "session-id",
      "subagents",
      "workflows",
      "wf_1",
      "agent.jsonl"
    );
    const codexFile = path.join(
      homeDir,
      ".codex",
      "sessions",
      "2026",
      "06",
      "29",
      "rollout.jsonl"
    );

    await writeJsonl(
      claudeFile,
      [
        {
          type: "user",
          timestamp: new Date(now - 2_000).toISOString(),
          cwd: "/Users/test/project",
          sessionId: "claude-session",
          permissionMode: "default",
          message: { role: "user", content: "redacted by parser" },
        },
        {
          type: "assistant",
          timestamp: new Date(now - 1_500).toISOString(),
          cwd: "/Users/test/project",
          sessionId: "claude-session",
          message: {
            role: "assistant",
            model: "claude-sonnet",
            usage: {
              input_tokens: 120,
              output_tokens: 40,
              cache_read_input_tokens: 60,
              cache_creation_input_tokens: 12,
            },
            content: [{ type: "tool_use", name: "mcp__github__get_issue" }],
          },
        },
        {
          type: "user",
          timestamp: new Date(now - 1_000).toISOString(),
          cwd: "/Users/test/project",
          sessionId: "claude-session",
          message: {
            role: "user",
            content: [
              { type: "tool_result", tool_name: "Bash", is_error: true },
            ],
          },
        },
      ],
      '{"type":"attachment"'
    );

    await writeJsonl(nestedClaudeFile, [
      {
        type: "assistant",
        timestamp: new Date(now - 800).toISOString(),
        cwd: "/Users/test/project",
        sessionId: "nested-claude-session",
        message: {
          role: "assistant",
          model: "claude-haiku",
          usage: { input_tokens: 50, output_tokens: 20 },
          content: [],
        },
      },
    ]);

    await writeJsonl(codexFile, [
      {
        timestamp: new Date(now - 700).toISOString(),
        type: "session_meta",
        payload: {
          session_id: "codex-session",
          cwd: "/Users/test/project",
          model_provider: "openai",
        },
      },
      {
        timestamp: new Date(now - 600).toISOString(),
        type: "response_item",
        payload: { type: "message", role: "user", content: [] },
      },
      {
        timestamp: new Date(now - 500).toISOString(),
        type: "response_item",
        payload: { type: "message", role: "assistant", content: [] },
      },
      "not-json",
    ]);
    await appendFile(codexFile, "{bad json\n", "utf8");

    const files = await discoverTelemetryFiles(homeDir);
    expect(files).toHaveLength(3);

    const first = await ingestTelemetryFiles(store, { files, now });
    expect(first.filesDiscovered).toBe(3);
    expect(first.filesChanged).toBe(3);
    expect(first.eventsIngested).toBeGreaterThanOrEqual(8);

    const events = await store.eventsSince(now - 10_000);
    expect(events.some((event) => event.rawPath === nestedClaudeFile)).toBe(
      true
    );
    expect(events.find((event) => event.kind === "mcp_call")?.mcpServer).toBe(
      "github"
    );
    const modelCall = events.find(
      (event) => event.kind === "model_call" && event.model === "claude-sonnet"
    );
    expect(modelCall?.tokensIn).toBe(120);
    expect(modelCall?.cacheReadTokens).toBe(60);
    expect(events.some((event) => event.rawLine === 4)).toBe(false);

    const second = await ingestTelemetryFiles(store, { files, now: now + 1 });
    expect(second.filesChanged).toBe(0);
    expect(second.eventsIngested).toBe(0);

    await appendFile(
      claudeFile,
      `}\n${JSON.stringify({
        type: "assistant",
        timestamp: new Date(now).toISOString(),
        cwd: "/Users/test/project",
        sessionId: "claude-session",
        message: {
          role: "assistant",
          model: "claude-sonnet",
          usage: { input_tokens: 10, output_tokens: 5 },
          content: [],
        },
      })}\n`,
      "utf8"
    );

    const third = await ingestTelemetryFiles(store, { files, now: now + 2 });
    expect(third.filesChanged).toBe(1);
    expect(third.eventsIngested).toBe(2);
    const resumed = await store.eventsSince(now - 10_000, {
      projectPath: "/Users/test/project",
    });
    expect(
      resumed.filter((event) => event.sessionId === "claude-session").length
    ).toBeGreaterThan(0);
  });
});
