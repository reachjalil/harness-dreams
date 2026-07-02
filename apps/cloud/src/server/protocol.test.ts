import {
  MAX_SIGNAL_FRAME_BYTES,
  RTC_PROTOCOL_VERSION,
  encryptedSnapshotPackageV1Schema,
  iceResponseV1Schema,
  signalApiUrl,
  signalFrameSize,
  signalWebSocketUrl,
} from "@harness-health/core";
import { describe, expect, it } from "vitest";

describe("private device sync signaling protocol", () => {
  it("mounts under the Harness Health RTC API base path", () => {
    expect(signalApiUrl("https://sync.example.com/", "/ice")).toBe(
      "https://sync.example.com/api/rtc/harness-health/v1/ice"
    );
  });

  it("builds websocket routes without private QR fragment material", () => {
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
    expect(url).not.toContain("pairingSecret");
  });

  it("keeps signaling frames bounded before Durable Object routing", () => {
    expect(
      signalFrameSize({ payload: "x".repeat(MAX_SIGNAL_FRAME_BYTES) })
    ).toBeGreaterThan(MAX_SIGNAL_FRAME_BYTES);
  });

  it("accepts STUN/TURN server lists without user content", () => {
    expect(
      iceResponseV1Schema.parse({
        version: RTC_PROTOCOL_VERSION,
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          {
            urls: ["turn:turn.example.com:3478"],
            username: "ephemeral-user",
            credential: "ephemeral-credential",
          },
        ],
      }).iceServers
    ).toHaveLength(2);
  });

  it("mounts optional encrypted snapshot backup under the RTC API", () => {
    expect(
      signalApiUrl("https://sync.example.com/", "/backup/users/user-1/latest")
    ).toBe(
      "https://sync.example.com/api/rtc/harness-health/v1/backup/users/user-1/latest"
    );
    expect(
      encryptedSnapshotPackageV1Schema.parse({
        version: 1,
        cloudUserId: "user-1",
        epochId: "epoch-1",
        revision: 1,
        baseRevision: 0,
        kind: "snapshot.update",
        authorDeviceId: "desktop-1",
        keyId: "snapshot-v1",
        nonce: "nonce-material",
        ciphertext: "opaque-ciphertext",
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }).kind
    ).toBe("snapshot.update");
  });
});
