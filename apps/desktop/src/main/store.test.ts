import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

let userData = "";

function mockElectron(): void {
  vi.doMock("electron", () => ({
    app: {
      getPath: (name: string) =>
        name === "logs" ? path.join(userData, "logs") : userData,
    },
  }));
}

beforeEach(() => {
  userData = mkdtempSync(path.join(os.tmpdir(), "hd-store-test-"));
  vi.resetModules();
  mockElectron();
});

afterEach(() => {
  vi.doUnmock("electron");
  rmSync(userData, { recursive: true, force: true });
});

describe("store", () => {
  test("persists config and fills runtime cloud sync defaults", async () => {
    const store = await import("./store");

    const initial = store.initStore();
    expect(initial.cloudSync.cloudUserId).toMatch(/[0-9a-f-]{36}/);
    expect(initial.cloudSync.deviceId).toMatch(/[0-9a-f-]{36}/);
    expect(initial.cloudSync.deviceName).not.toBe("");

    const updated = store.setConfig({ cloudSync: { backupEnabled: true } });
    expect(updated.cloudSync.backupKey).not.toBe("");
    expect(updated.cloudSync.backupKeyId).toMatch(/^snapshot-/);
    expect(updated.cloudSync.backupEpochId).toMatch(/[0-9a-f-]{36}/);

    const persisted = JSON.parse(readFileSync(store.getConfigPath(), "utf8"));
    expect(persisted.cloudSync.backupEnabled).toBe(true);
    expect(persisted.cloudSync.backupKey).toBe(updated.cloudSync.backupKey);
    expect(persisted.cloudSync.backupKeyId).toBe(updated.cloudSync.backupKeyId);
  });

  test("deep-merges nested patches without erasing sibling settings", async () => {
    const store = await import("./store");
    store.initStore();

    store.setConfig({
      telemetry: {
        rawTextRetention: true,
        priceTable: {
          "gpt-5.5": {
            inputPerMTok: 1.25,
            outputPerMTok: 10,
            cacheReadPerMTok: 0.1,
          },
        },
      },
      insightRunner: {
        model: "gpt-5.5",
        timeoutMs: 120_000,
      },
      projects: [
        {
          path: "/tmp/project-a",
          name: "Project A",
          sources: ["codex"],
          enabled: true,
          addedAt: 1,
        },
      ],
    });

    const merged = store.setConfig({
      telemetry: { enabled: false },
      insightRunner: { timeoutMs: 240_000 },
      connectors: { cursor: true },
    });

    expect(merged.telemetry.enabled).toBe(false);
    expect(merged.telemetry.rawTextRetention).toBe(true);
    expect(merged.telemetry.priceTable["gpt-5.5"]).toMatchObject({
      inputPerMTok: 1.25,
      outputPerMTok: 10,
      cacheReadPerMTok: 0.1,
    });
    expect(merged.insightRunner).toMatchObject({
      provider: "codex",
      model: "gpt-5.5",
      timeoutMs: 240_000,
    });
    expect(merged.connectors).toEqual({
      claudeCode: true,
      codex: true,
      cursor: true,
    });
    expect(merged.projects).toHaveLength(1);
  });
});
