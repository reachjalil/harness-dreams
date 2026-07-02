import { Buffer } from "node:buffer";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertPairingSecretNotInUrl,
  decodePairingLink,
  decryptSnapshotBackupPackageWithKeys,
  encryptSnapshotBackupPackage,
  type SnapshotBackupPayloadV1,
} from "@harness-health/core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Finding, HealthReport } from "../shared/types";
import { sanitizeReportForCloud } from "./cloudRedaction";

let userData = "";
let oldPort: string | undefined;
let shutdownDeviceSync: (() => Promise<void>) | null = null;
let shutdownCloudSync: (() => Promise<void>) | null = null;

function mockElectron(): void {
  vi.doMock("electron", () => ({
    app: {
      getPath: (name: string) =>
        name === "logs" ? path.join(userData, "logs") : userData,
    },
    safeStorage: {
      isEncryptionAvailable: () => false,
      encryptString: (value: string) => Buffer.from(value, "utf8"),
      decryptString: (value: Buffer) => value.toString("utf8"),
    },
  }));
}

function mockWindowsAndTelemetry(): void {
  vi.doMock("./windows", () => ({
    broadcastToPeerHost: vi.fn(),
    closePeerHost: vi.fn(),
    getOrCreatePeerHost: vi.fn(),
  }));
  vi.doMock("./telemetry", () => ({
    getTelemetrySnapshot: vi.fn().mockResolvedValue(null),
  }));
}

function finding(id = "finding-1"): Finding {
  return {
    id,
    type: "risk",
    title: "Secret-bearing finding",
    body: "Mentions API_TOKEN=super-secret and /Users/test/project.",
    improvement: "Redact before cloud sync.",
    agentBenefit: "No secret leakage.",
    userBenefit: "Private sync stays private.",
    reflection: "Keep checking redaction.",
    confidence: "high",
    project: "Private Project",
    evidence: "Raw evidence in /Users/test/project/session.jsonl.",
    evidenceFile: "/Users/test/project/session.jsonl",
    action: "Add rule: Keep secrets out of cloud payloads.",
    projectPath: "/Users/test/project",
  };
}

function report(id: string, timestamp: number): HealthReport {
  return {
    id,
    timestamp,
    rangeLabel: "Last 24h",
    sessions: 1,
    projects: 1,
    harness: "Codex",
    digest: "Digest includes ghp_abcdefghijklmnopqrstuvwxyz123456.",
    rings: [],
    metrics: [],
    findings: [finding()],
    experiments: [],
  };
}

async function waitUntil(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 1_500
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for condition.");
}

async function setupMain(
  options: { port?: number; reports?: HealthReport[] } = {}
) {
  vi.resetModules();
  mockElectron();
  mockWindowsAndTelemetry();
  if (options.port) {
    process.env.HARNESS_HEALTH_DEV_SYNC_PORT = String(options.port);
  }
  const store = await import("./store");
  store.initStore();
  if (options.reports) {
    writeFileSync(
      path.join(userData, "harness-health-reports.json"),
      JSON.stringify(options.reports, null, 2),
      "utf8"
    );
  }
  const reports = await import("./reports");
  reports.initReports();
  return { store, reports };
}

beforeEach(() => {
  userData = mkdtempSync(path.join(os.tmpdir(), "hd-sync-test-"));
  oldPort = process.env.HARNESS_HEALTH_DEV_SYNC_PORT;
});

afterEach(async () => {
  if (shutdownDeviceSync) await shutdownDeviceSync();
  if (shutdownCloudSync) await shutdownCloudSync();
  shutdownDeviceSync = null;
  shutdownCloudSync = null;
  if (oldPort === undefined) delete process.env.HARNESS_HEALTH_DEV_SYNC_PORT;
  else process.env.HARNESS_HEALTH_DEV_SYNC_PORT = oldPort;
  vi.unstubAllGlobals();
  vi.doUnmock("electron");
  vi.doUnmock("./windows");
  vi.doUnmock("./telemetry");
  rmSync(userData, { recursive: true, force: true });
});

describe("sync hardening", () => {
  test("dev pairing handler emits fragment-only secrets and backup key metadata", async () => {
    const port = 39_391 + Math.floor(Math.random() * 1_000);
    const { store } = await setupMain({ port });
    store.setConfig({ cloudSync: { backupEnabled: true } });
    const deviceSync = await import("./deviceSync");
    shutdownDeviceSync = deviceSync.shutdownDeviceSyncServer;
    deviceSync.initDeviceSyncServer();

    await waitUntil(async () => {
      try {
        return (await fetch(`http://127.0.0.1:${port}/health`)).ok;
      } catch {
        return false;
      }
    });

    const response = await fetch(
      `http://127.0.0.1:${port}/v1/dev/pair?kind=watch&deviceName=Test%20Watch`
    );
    expect(response.ok).toBe(true);
    const body = (await response.json()) as { pairingUrl: string };
    const parsedUrl = new URL(body.pairingUrl);
    const decoded = decodePairingLink(body.pairingUrl);

    assertPairingSecretNotInUrl(body.pairingUrl);
    expect(parsedUrl.searchParams.has("backupKey")).toBe(false);
    expect(parsedUrl.hash).toContain("pairingSecret=");
    expect(parsedUrl.hash).toContain("backupKey=");
    expect(decoded.deviceName).toBe("Test Watch");
    expect(decoded.backupEnabled).toBe(true);
    expect(decoded.backupKey).toBe(store.getConfig().cloudSync.backupKey);
    expect(decoded.backupKeyId).toBe(store.getConfig().cloudSync.backupKeyId);
    expect(decoded.backupEpochId).toBe(
      store.getConfig().cloudSync.backupEpochId
    );
  });

  test("encrypted backup envelopes round-trip sanitized report payloads", async () => {
    const backupKey = "round-trip-backup-key";
    const sanitized = sanitizeReportForCloud(report("sensitive", 700));
    const payload: SnapshotBackupPayloadV1 = {
      schemaVersion: 1,
      cloudUserId: "user-1",
      epochId: "epoch-1",
      revision: 700,
      desktopDeviceId: "desktop-1",
      desktopDeviceName: "Mac",
      ops: [
        {
          op: "replaceTable",
          table: "reports",
          rows: [
            {
              id: "sensitive",
              updatedAt: 700,
              json: JSON.stringify(sanitized),
            },
          ],
        },
        { op: "setMeta", key: "revision", value: "700" },
      ],
      createdAt: Date.now(),
    };

    const pkg = await encryptSnapshotBackupPackage({
      backupKey,
      cloudUserId: "user-1",
      epochId: "epoch-1",
      revision: 700,
      authorDeviceId: "desktop-1",
      payload,
      keyId: "key-current",
    });
    const decrypted = await decryptSnapshotBackupPackageWithKeys({
      package: pkg,
      keys: [
        { keyId: "key-old", backupKey: "wrong-key" },
        { keyId: "key-current", backupKey },
      ],
    });
    const rows = decrypted.ops.find((op) => op.op === "replaceTable")?.rows;
    const json = rows?.[0]?.json ?? "";

    expect(decrypted.revision).toBe(700);
    expect(pkg.keyId).toBe("key-current");
    expect(json).not.toContain("/Users/test");
    expect(json).not.toContain("super-secret");
    expect(json).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz123456");
    expect(json).toContain("[redacted path]");
    expect(json).toContain("[redacted secret]");
  });

  test("backup key rotation retains the prior key and uploads with the new key id", async () => {
    const { store } = await setupMain({ reports: [report("current", 900)] });
    store.setConfig({
      cloudSync: {
        enabled: true,
        backupEnabled: true,
        cloudApiBaseUrl: "https://sync.example.test",
      },
    });
    const before = store.getConfig().cloudSync;
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(new Response("{}", { status: 200 }))
    );
    vi.stubGlobal("fetch", fetchMock);

    const cloudSync = await import("./cloudSync");
    shutdownCloudSync = cloudSync.shutdownCloudSync;
    const status = cloudSync.rotateCloudBackupKey();
    const after = store.getConfig().cloudSync;

    expect(status.state).toBe("syncing");
    expect(after.backupKey).not.toBe(before.backupKey);
    expect(after.backupKeyId).not.toBe(before.backupKeyId);
    expect(after.backupRetainedKeys[0]).toMatchObject({
      keyId: before.backupKeyId,
      backupKey: before.backupKey,
      backupEpochId: before.backupEpochId,
    });

    await waitUntil(() => fetchMock.mock.calls.length > 0);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) throw new Error("Expected backup upload fetch.");
    const [url, init] = firstCall;
    expect(String(url)).toContain(
      `/backup/users/${encodeURIComponent(after.cloudUserId)}/snapshots`
    );
    const body = JSON.parse(String(init?.body));
    expect(body.keyId).toBe(after.backupKeyId);
  });
});
