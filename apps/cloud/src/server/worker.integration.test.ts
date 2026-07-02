import { env, exports } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import {
  HARNESS_HEALTH_RTC_BASE_PATH,
  MAX_BACKUP_PACKAGE_BYTES,
  MAX_SIGNAL_FRAME_BYTES,
  RTC_PROTOCOL_VERSION,
  SIGNAL_REPLAY_WINDOW_MS,
  encryptSignalEnvelope,
  encryptSnapshotBackupPackage,
  generateSecret,
  snapshotBackupAuthToken,
  snapshotBackupPullResponseV1Schema,
  type EncryptedSnapshotPackageV1,
} from "@harness-health/core";
import { assert, describe, expect, it } from "vitest";

interface FetcherLike {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface CountRow {
  count: number | string;
}

const worker = exports.default as FetcherLike;

function apiUrl(path: string): string {
  return `https://worker.test${HARNESS_HEALTH_RTC_BASE_PATH}${path}`;
}

function dispatch(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(apiUrl(path), init);
}

async function openSocket(input: {
  cloudUserId: string;
  deviceId: string;
  role: "desktop" | "device";
  pairingId?: string;
}): Promise<WebSocket> {
  const params = new URLSearchParams({
    deviceId: input.deviceId,
    role: input.role,
  });
  if (input.pairingId) params.set("pairingId", input.pairingId);
  const response = await dispatch(
    `/users/${encodeURIComponent(input.cloudUserId)}/ws?${params.toString()}`,
    { headers: { Upgrade: "websocket" } }
  );
  expect(response.status).toBe(101);
  const socket = response.webSocket;
  assert(socket);
  socket.accept();
  return socket;
}

function onceMessage(socket: WebSocket): Promise<MessageEvent> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Timed out waiting for WebSocket message.")),
      1000
    );
    socket.addEventListener(
      "message",
      (event) => {
        clearTimeout(timeout);
        resolve(event);
      },
      { once: true }
    );
    socket.addEventListener(
      "close",
      () => {
        clearTimeout(timeout);
        reject(new Error("WebSocket closed before a message arrived."));
      },
      { once: true }
    );
  });
}

async function snapshotPackage(input: {
  cloudUserId: string;
  backupKey: string;
  revision: number;
  expiresAt?: number;
}): Promise<EncryptedSnapshotPackageV1> {
  return encryptSnapshotBackupPackage({
    backupKey: input.backupKey,
    cloudUserId: input.cloudUserId,
    epochId: "epoch-1",
    revision: input.revision,
    authorDeviceId: "desktop-1",
    keyId: "snapshot-key-1",
    expiresAt: input.expiresAt,
    payload: {
      schemaVersion: 1,
      cloudUserId: input.cloudUserId,
      epochId: "epoch-1",
      revision: input.revision,
      desktopDeviceId: "desktop-1",
      desktopDeviceName: "MacBook",
      ops: [
        {
          op: "replaceTable",
          table: "reports",
          rows: [
            {
              id: `report-${input.revision}`,
              updatedAt: input.revision,
              json: JSON.stringify({ id: `report-${input.revision}` }),
            },
          ],
        },
      ],
      createdAt: Date.now(),
    },
  });
}

async function backupHeaders(
  cloudUserId: string,
  backupKey: string
): Promise<HeadersInit> {
  return {
    Authorization: `Bearer ${await snapshotBackupAuthToken({
      cloudUserId,
      backupKey,
    })}`,
    "Content-Type": "application/json",
  };
}

describe("Worker /ice", () => {
  it("keeps the STUN fallback and appends TURN env servers", async () => {
    env.TURN_URL = "turn:turn.example.com:3478,turns:turn.example.com:5349";
    env.TURN_USERNAME = "turn-user";
    env.TURN_CREDENTIAL = "turn-pass";
    const response = await dispatch("/ice");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      version: RTC_PROTOCOL_VERSION,
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: ["turn:turn.example.com:3478", "turns:turn.example.com:5349"],
          username: "turn-user",
          credential: "turn-pass",
        },
      ],
    });
    env.TURN_URL = undefined;
    env.TURN_USERNAME = undefined;
    env.TURN_CREDENTIAL = undefined;
  });
});

describe("SignalRoom integration", () => {
  it("relays valid signaling frames to desktop sockets", async () => {
    const cloudUserId = "relay-user";
    const pairingId = "pair-1";
    const secret = generateSecret();
    const desktop = await openSocket({
      cloudUserId,
      deviceId: "desktop-1",
      role: "desktop",
    });
    const device = await openSocket({
      cloudUserId,
      deviceId: "device-1",
      role: "device",
      pairingId,
    });
    const envelope = await encryptSignalEnvelope({
      secret,
      cloudUserId,
      pairingId,
      fromDeviceId: "device-1",
      kind: "pair.request",
      payload: {
        version: RTC_PROTOCOL_VERSION,
        kind: "pair.request",
        deviceId: "device-1",
        deviceName: "iPhone",
        deviceKind: "iphone",
      },
    });
    const received = onceMessage(desktop);
    device.send(JSON.stringify(envelope));
    expect(JSON.parse(String((await received).data))).toMatchObject({
      cloudUserId,
      fromDeviceId: "device-1",
      kind: "pair.request",
    });
    desktop.close();
    device.close();
  });

  it("rejects stale replay-window frames", async () => {
    const cloudUserId = "stale-user";
    const socket = await openSocket({
      cloudUserId,
      deviceId: "device-1",
      role: "device",
    });
    const envelope = await encryptSignalEnvelope({
      secret: generateSecret(),
      cloudUserId,
      fromDeviceId: "device-1",
      kind: "peer.ice",
      createdAt: Date.now() - SIGNAL_REPLAY_WINDOW_MS - 1_000,
      payload: {
        version: RTC_PROTOCOL_VERSION,
        kind: "peer.ice",
        deviceId: "device-1",
        ice: { candidate: "candidate:1" },
      },
    });
    const received = onceMessage(socket);
    socket.send(JSON.stringify(envelope));
    expect(JSON.parse(String((await received).data))).toMatchObject({
      type: "error",
      message: "Signaling frame is outside the replay window.",
    });
    socket.close();
  });

  it("rejects oversized frames before routing", async () => {
    const socket = await openSocket({
      cloudUserId: "oversized-user",
      deviceId: "device-1",
      role: "device",
    });
    const received = onceMessage(socket);
    socket.send("x".repeat(MAX_SIGNAL_FRAME_BYTES + 1));
    expect(JSON.parse(String((await received).data))).toMatchObject({
      type: "error",
      message: "Signaling frame is too large.",
    });
    socket.close();
  });
});

describe("SnapshotBackupRoom integration", () => {
  it("stores, reads, authenticates, limits, prunes, and expires snapshots", async () => {
    const cloudUserId = "backup-user";
    const backupKey = generateSecret();
    const headers = await backupHeaders(cloudUserId, backupKey);

    const created = await dispatch(
      `/backup/users/${encodeURIComponent(cloudUserId)}/snapshots`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(
          await snapshotPackage({ cloudUserId, backupKey, revision: 1 })
        ),
      }
    );
    expect(created.status).toBe(200);

    const latest = await dispatch(
      `/backup/users/${encodeURIComponent(cloudUserId)}/latest`,
      { headers }
    );
    expect(latest.status).toBe(200);
    expect(
      snapshotBackupPullResponseV1Schema.parse(await latest.json()).package
        ?.revision
    ).toBe(1);

    const rejected = await dispatch(
      `/backup/users/${encodeURIComponent(cloudUserId)}/latest`,
      { headers: { Authorization: "Bearer wrong-token" } }
    );
    expect(rejected.status).toBe(403);

    const tooLarge = await dispatch(
      `/backup/users/${encodeURIComponent(cloudUserId)}/snapshots`,
      {
        method: "POST",
        headers,
        body: "x".repeat(MAX_BACKUP_PACKAGE_BYTES + 1),
      }
    );
    expect(tooLarge.status).toBe(413);

    for (let revision = 2; revision <= 22; revision += 1) {
      const response = await dispatch(
        `/backup/users/${encodeURIComponent(cloudUserId)}/snapshots`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(
            await snapshotPackage({ cloudUserId, backupKey, revision })
          ),
        }
      );
      expect(response.status).toBe(200);
    }
    const stub = env.SNAPSHOT_BACKUP.get(
      env.SNAPSHOT_BACKUP.idFromName(cloudUserId)
    );
    const count = await runInDurableObject(stub, (_instance, state) => {
      const row = state.storage.sql
        .exec("SELECT COUNT(*) AS count FROM snapshots")
        .toArray()[0] as unknown as CountRow;
      return Number(row.count);
    });
    expect(count).toBe(20);

    const expiringUser = "expiring-user";
    const expiringKey = generateSecret();
    const expiringHeaders = await backupHeaders(expiringUser, expiringKey);
    const expiringStub = env.SNAPSHOT_BACKUP.get(
      env.SNAPSHOT_BACKUP.idFromName(expiringUser)
    );
    const expiresAt = Date.now() + 25;
    const expiring = await dispatch(
      `/backup/users/${encodeURIComponent(expiringUser)}/snapshots`,
      {
        method: "POST",
        headers: expiringHeaders,
        body: JSON.stringify(
          await snapshotPackage({
            cloudUserId: expiringUser,
            backupKey: expiringKey,
            revision: 1,
            expiresAt,
          })
        ),
      }
    );
    expect(expiring.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await runDurableObjectAlarm(expiringStub)).toBe(true);
    const afterAlarm = await dispatch(
      `/backup/users/${encodeURIComponent(expiringUser)}/latest`,
      { headers: expiringHeaders }
    );
    expect(
      snapshotBackupPullResponseV1Schema.parse(await afterAlarm.json()).package
    ).toBeNull();
  });
});
