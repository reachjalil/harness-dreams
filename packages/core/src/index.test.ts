import { describe, expect, test } from "vitest";

import {
  MAX_SIGNAL_FRAME_BYTES,
  RTC_PROTOCOL_VERSION,
  assertPairingSecretNotInUrl,
  decodePairingLink,
  decryptSignalEnvelope,
  decryptSnapshotBackupPackage,
  encodePairingLink,
  encryptSignalEnvelope,
  encryptSnapshotBackupPackage,
  generateSecret,
  peerSyncMessageV1Schema,
  signalFrameSize,
  signalWebSocketUrl,
  VERSION,
} from "./index";

describe("@harness-health/core private sync", () => {
  test("exposes a version", () => {
    expect(VERSION).toBe("0.1.0");
  });

  test("keeps QR pairing secret in the fragment only", () => {
    const pairingUrl = encodePairingLink({
      version: RTC_PROTOCOL_VERSION,
      signalUrl: "https://sync.example.com",
      cloudUserId: "user-1",
      pairingId: "pair-1",
      deviceName: "Jalil's iPhone",
      expiresAt: 1_800_000_000_000,
      pairingSecret: "super-secret-pairing-material-123",
      backupEnabled: true,
      backupEpochId: "epoch-1",
      backupKey: "super-secret-backup-material-123",
    });

    expect(pairingUrl).toContain("#pairingSecret=");
    expect(pairingUrl).toContain("backupKey=");
    expect(new URL(pairingUrl).searchParams.has("pairingSecret")).toBe(false);
    expect(new URL(pairingUrl).searchParams.has("backupKey")).toBe(false);
    expect(() => assertPairingSecretNotInUrl(pairingUrl)).not.toThrow();
    expect(decodePairingLink(pairingUrl).pairingSecret).toBe(
      "super-secret-pairing-material-123"
    );
    expect(decodePairingLink(pairingUrl).backupKey).toBe(
      "super-secret-backup-material-123"
    );
  });

  test("builds signaling websocket URLs without fragment secrets", () => {
    const url = signalWebSocketUrl({
      signalUrl: "https://sync.example.com",
      cloudUserId: "user-1",
      deviceId: "desktop-1",
      role: "desktop",
      pairingId: "pair-1",
    });
    expect(url).toBe(
      "wss://sync.example.com/api/rtc/harness-health/v1/users/user-1/ws?deviceId=desktop-1&role=desktop&pairingId=pair-1"
    );
  });

  test("encrypts and authenticates signaling payloads", async () => {
    const secret = generateSecret();
    const envelope = await encryptSignalEnvelope({
      secret,
      cloudUserId: "user-1",
      pairingId: "pair-1",
      fromDeviceId: "iphone-1",
      toDeviceId: "desktop-1",
      kind: "peer.offer",
      payload: {
        version: RTC_PROTOCOL_VERSION,
        kind: "peer.offer",
        deviceId: "iphone-1",
        deviceName: "iPhone",
        deviceKind: "iphone",
        sdp: "private-sdp",
      },
    });

    expect(envelope.ciphertext).not.toContain("private-sdp");
    await expect(
      decryptSignalEnvelope({ secret, envelope })
    ).resolves.toMatchObject({
      kind: "peer.offer",
      sdp: "private-sdp",
    });
    await expect(
      decryptSignalEnvelope({
        secret,
        envelope: { ...envelope, kind: "peer.answer" },
      })
    ).rejects.toThrow();
  });

  test("enforces signal frame size budget and peer message schemas", () => {
    expect(
      signalFrameSize({ payload: "x".repeat(MAX_SIGNAL_FRAME_BYTES) })
    ).toBeGreaterThan(MAX_SIGNAL_FRAME_BYTES);
    expect(() =>
      peerSyncMessageV1Schema.parse({
        type: "review.decisions",
        messageId: "msg-1",
        payload: {
          schemaVersion: 1,
          sourceDeviceId: "iphone-1",
          revision: 1,
          decisions: [{ reportId: "r", findingId: "f", state: "open" }],
          createdAt: Date.now(),
        },
      })
    ).toThrow();
  });

  test("encrypts optional snapshot backup packages", async () => {
    const backupKey = generateSecret();
    const pkg = await encryptSnapshotBackupPackage({
      backupKey,
      cloudUserId: "user-1",
      epochId: "epoch-1",
      revision: 10,
      authorDeviceId: "desktop-1",
      payload: {
        schemaVersion: 1,
        cloudUserId: "user-1",
        epochId: "epoch-1",
        revision: 10,
        desktopDeviceId: "desktop-1",
        desktopDeviceName: "MacBook",
        ops: [
          {
            op: "replaceTable",
            table: "reports",
            rows: [
              {
                id: "report-1",
                updatedAt: 10,
                json: JSON.stringify({ id: "report-1", digest: "private" }),
              },
            ],
          },
        ],
        createdAt: Date.now(),
      },
    });

    expect(pkg.ciphertext).not.toContain("private");
    await expect(
      decryptSnapshotBackupPackage({ backupKey, package: pkg })
    ).resolves.toMatchObject({
      revision: 10,
      ops: [{ op: "replaceTable", table: "reports" }],
    });
    await expect(
      decryptSnapshotBackupPackage({
        backupKey,
        package: { ...pkg, revision: 11 },
      })
    ).rejects.toThrow();
  });
});
