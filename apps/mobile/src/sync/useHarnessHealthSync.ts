import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PEER_MESSAGE_SCHEMA_VERSION,
  RTC_PROTOCOL_VERSION,
  decryptSignalEnvelope,
  decryptSnapshotBackupPackage,
  encryptSignalEnvelope,
  iceResponseV1Schema,
  peerSyncMessageV1Schema,
  signalApiUrl,
  signalEnvelopeV1Schema,
  signalWebSocketUrl,
  snapshotBackupApiUrl,
  snapshotBackupAuthToken,
  snapshotBackupPullResponseV1Schema,
  type PeerReviewDecisionBatchV1,
  type PeerSyncMessageV1,
} from "@harness-health/core";
import { Alert, Linking } from "react-native";
import { type RTCIceCandidate, RTCPeerConnection } from "react-native-webrtc";
import type NativeRTCDataChannel from "react-native-webrtc/lib/typescript/RTCDataChannel";
import { formatSyncTime } from "../domain/harnessHealth";
import type {
  Pairing,
  PendingDecision,
  ReviewState,
  Snapshot,
} from "../domain/types";
import { ensureCryptoRuntime } from "./cryptoRuntime";
import { candidateFromUnknown, parseRemoteDescription } from "./webrtc";
import {
  applySnapshotPayloadToSqlite,
  clearPairing,
  clearSnapshotDb,
  loadPairing,
  loadSnapshotFromSqlite,
  parsePairingUrl,
  savePairing,
  savePeerSnapshotToSqlite,
} from "./persistence";
import { normalizeReport, snapshotFromPeerMessage } from "./normalization";

const DEV_SYNC_BASE_URL = "http://127.0.0.1:39391";
const DEV_AUTO_PAIR_DEVICE_NAME = "Dev iPhone Simulator";
const DEV_AUTO_PAIR_ENABLED = typeof __DEV__ !== "undefined" && __DEV__;

interface DevPairingResponse {
  pairingUrl?: string;
  error?: string;
}

interface DevSnapshotResponse {
  cloudUserId?: string;
  desktopDeviceId?: string;
  desktopDeviceName?: string;
  revision?: number;
  report?: unknown;
  error?: string;
}

function localMessageId(prefix: string): string {
  return `${prefix}_${Crypto.randomUUID()}`;
}

async function fetchDevPairing(): Promise<Pairing> {
  const url = new URL(`${DEV_SYNC_BASE_URL}/v1/dev/pair`);
  url.searchParams.set("kind", "iphone");
  url.searchParams.set("deviceName", DEV_AUTO_PAIR_DEVICE_NAME);
  const response = await fetch(url.toString());
  const body = (await response.json().catch(() => ({}))) as DevPairingResponse;
  if (!response.ok) {
    throw new Error(body.error || `Dev auto-pair failed: ${response.status}`);
  }
  if (!body.pairingUrl) {
    throw new Error("Dev auto-pair response was missing a pairing URL.");
  }
  const pairing = parsePairingUrl(body.pairingUrl);
  if (!pairing) {
    throw new Error("Dev auto-pair response returned an invalid pairing URL.");
  }
  return {
    ...pairing,
    deviceName: DEV_AUTO_PAIR_DEVICE_NAME,
  };
}

async function fetchDevSnapshot(): Promise<Snapshot | null> {
  const response = await fetch(`${DEV_SYNC_BASE_URL}/v1/dev/snapshot`);
  const body = (await response.json().catch(() => ({}))) as DevSnapshotResponse;
  if (!response.ok) {
    throw new Error(body.error || `Dev snapshot failed: ${response.status}`);
  }
  const report = normalizeReport(body.report);
  if (!report) return null;
  return {
    userId: body.cloudUserId ?? "local-dev",
    desktopDeviceId: body.desktopDeviceId ?? "harness-health-mac",
    desktopDeviceName: body.desktopDeviceName ?? "Harness Health Mac",
    deviceId: DEV_AUTO_PAIR_DEVICE_NAME,
    revision: body.revision ?? report.timestamp,
    report,
  };
}

function isWebCryptoRuntimeError(err: unknown): boolean {
  return (
    err instanceof Error && err.message.includes("WebCrypto-compatible runtime")
  );
}

function signalSecret(pairing: Pairing, firstPairing: boolean): string {
  if (firstPairing && pairing.pairingSecret) return pairing.pairingSecret;
  return pairing.pairedDeviceSecret ?? "";
}

function addNativeEvent<T>(
  target: unknown,
  type: string,
  listener: (event: T) => void
): void {
  (
    target as {
      addEventListener: (name: string, cb: (event: T) => void) => void;
    }
  ).addEventListener(type, listener);
}

export interface HarnessHealthSyncState {
  pairing: Pairing | null;
  paired: boolean;
  snapshot: Snapshot | null;
  loading: boolean;
  devAutoPairing: boolean;
  devAutoPairEnabled: boolean;
  syncError: string;
  lastSyncedAt: string;
  connectionStatus: string;
  signalBaseUrl: string;
  pairFromUrl(input: string): Promise<boolean>;
  refresh(): Promise<void>;
  unpair(): Promise<void>;
  markDecision(findingId: string, state: ReviewState): Promise<void>;
}

export function useHarnessHealthSync(): HarnessHealthSyncState {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [devAutoPairing, setDevAutoPairing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Preview");
  const pairingRef = useRef<Pairing | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<NativeRTCDataChannel | null>(null);
  const pendingIceRef = useRef<RTCIceCandidate[]>([]);

  const signalBaseUrl = useMemo(
    () => pairing?.signalUrl.replace(/\/+$/u, "") ?? "",
    [pairing]
  );

  const persistPairing = useCallback(async (next: Pairing) => {
    pairingRef.current = next;
    await savePairing(next);
    setPairing(next);
  }, []);

  const closePeer = useCallback(() => {
    channelRef.current?.close();
    pcRef.current?.close();
    wsRef.current?.close();
    channelRef.current = null;
    pcRef.current = null;
    wsRef.current = null;
    pendingIceRef.current = [];
    setConnectionStatus("Disconnected");
  }, []);

  const sendPeerMessage = useCallback((message: PeerSyncMessageV1) => {
    const channel = channelRef.current;
    if (channel?.readyState !== "open") return false;
    channel.send(JSON.stringify(peerSyncMessageV1Schema.parse(message)));
    return true;
  }, []);

  const requestSnapshot = useCallback(() => {
    const current = pairingRef.current;
    if (!current) return false;
    return sendPeerMessage({
      type: "request.snapshot",
      schemaVersion: PEER_MESSAGE_SCHEMA_VERSION,
      messageId: localMessageId("snapshot_request"),
      lastKnownRevision: current.lastRevision,
      createdAt: Date.now(),
    });
  }, [sendPeerMessage]);

  const flushPendingDecisions = useCallback(async () => {
    const current = pairingRef.current;
    if (!current || current.pendingDecisions.length === 0) return;
    const batch: PeerReviewDecisionBatchV1 = {
      schemaVersion: PEER_MESSAGE_SCHEMA_VERSION,
      sourceDeviceId: current.deviceId,
      sourceDeviceName: current.deviceName,
      revision: current.lastRevision,
      decisions: current.pendingDecisions.map((decision) => ({
        ...decision,
        sourceDeviceId: current.deviceId,
        sourceDeviceName: current.deviceName,
      })),
      createdAt: Date.now(),
    };
    sendPeerMessage({
      type: "review.decisions",
      messageId: localMessageId("decision_batch"),
      payload: batch,
    });
  }, [sendPeerMessage]);

  const pullEncryptedBackup = useCallback(
    async (current: Pairing): Promise<boolean> => {
      if (!current.backupEnabled || !current.backupKey) return false;
      setLoading(true);
      try {
        const authToken = await snapshotBackupAuthToken({
          backupKey: current.backupKey,
          cloudUserId: current.cloudUserId,
        });
        const response = await fetch(
          snapshotBackupApiUrl(
            current.signalUrl,
            `/backup/users/${encodeURIComponent(current.cloudUserId)}/latest`
          ),
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(text || `Backup refresh failed: ${response.status}`);
        }
        const body = snapshotBackupPullResponseV1Schema.parse(
          await response.json()
        );
        if (!body.package) return false;
        const payload = await decryptSnapshotBackupPackage({
          backupKey: current.backupKey,
          package: body.package,
        });
        const nextSnapshot = await applySnapshotPayloadToSqlite(
          current,
          payload
        );
        const nextPairing = {
          ...current,
          desktopDeviceId: payload.desktopDeviceId,
          desktopDeviceName: payload.desktopDeviceName,
          backupEpochId: payload.epochId,
          lastRevision: Math.max(current.lastRevision, payload.revision),
        };
        await persistPairing(nextPairing);
        if (nextSnapshot) setSnapshot(nextSnapshot);
        setConnectionStatus("Encrypted fallback");
        setLastSyncedAt(formatSyncTime());
        setSyncError("");
        return true;
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [persistPairing]
  );

  const refreshDevSnapshot = useCallback(async (): Promise<boolean> => {
    if (!DEV_AUTO_PAIR_ENABLED) return false;
    setLoading(true);
    try {
      const nextSnapshot = await fetchDevSnapshot();
      if (!nextSnapshot) return false;
      setSnapshot(nextSnapshot);
      setConnectionStatus("Dev preview");
      setLastSyncedAt(formatSyncTime());
      setSyncError("");
      return true;
    } catch (err) {
      setConnectionStatus("Preview");
      setSyncError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePeerMessage = useCallback(
    async (data: unknown) => {
      if (typeof data !== "string") return;
      const message = peerSyncMessageV1Schema.parse(JSON.parse(data));
      const current = pairingRef.current;
      if (!current) return;
      if (message.type === "report.snapshot") {
        const nextSnapshot = snapshotFromPeerMessage(current, message);
        await savePeerSnapshotToSqlite(current, message);
        const nextPairing = {
          ...current,
          desktopDeviceId: message.payload.desktopDeviceId,
          desktopDeviceName: message.payload.desktopDeviceName,
          lastRevision: message.payload.revision,
        };
        await persistPairing(nextPairing);
        setSnapshot(nextSnapshot);
        setLastSyncedAt(formatSyncTime());
        setConnectionStatus("Connected");
        setSyncError("");
        return;
      }
      if (message.type === "ack" && message.payload.accepted) {
        const nextPairing = {
          ...current,
          lastRevision: Math.max(
            current.lastRevision,
            message.payload.revision
          ),
          pendingDecisions: [],
        };
        await persistPairing(nextPairing);
        setLastSyncedAt(formatSyncTime());
      }
    },
    [persistPairing]
  );

  const attachDataChannel = useCallback(
    (channel: NativeRTCDataChannel) => {
      channelRef.current = channel;
      addNativeEvent(channel, "open", () => {
        const current = pairingRef.current;
        if (!current) return;
        setConnectionStatus("Connected");
        sendPeerMessage({
          type: "hello",
          schemaVersion: PEER_MESSAGE_SCHEMA_VERSION,
          messageId: localMessageId("hello"),
          deviceId: current.deviceId,
          deviceName: current.deviceName,
          deviceKind: "iphone",
          lastKnownRevision: current.lastRevision,
          createdAt: Date.now(),
        });
        requestSnapshot();
        void flushPendingDecisions();
      });
      addNativeEvent<{ data: unknown }>(channel, "message", (event) => {
        void handlePeerMessage(event.data).catch((err) => {
          setSyncError(err instanceof Error ? err.message : String(err));
        });
      });
      addNativeEvent(channel, "close", () =>
        setConnectionStatus("Disconnected")
      );
    },
    [flushPendingDecisions, handlePeerMessage, requestSnapshot, sendPeerMessage]
  );

  const sendSignal = useCallback(
    async (
      ws: WebSocket,
      current: Pairing,
      secret: string,
      kind: "pair.request" | "peer.offer" | "peer.ice" | "peer.close",
      payload: Parameters<typeof encryptSignalEnvelope>[0]["payload"],
      toDeviceId?: string
    ) => {
      const envelope = await encryptSignalEnvelope({
        secret,
        cloudUserId: current.cloudUserId,
        pairingId: kind === "pair.request" ? current.pairingId : undefined,
        fromDeviceId: current.deviceId,
        toDeviceId,
        kind,
        payload,
      });
      ws.send(JSON.stringify(envelope));
    },
    []
  );

  const createOffer = useCallback(
    async (current: Pairing, ws: WebSocket) => {
      if (!current.pairedDeviceSecret || !current.desktopDeviceId) return;
      const iceResponse = await fetch(signalApiUrl(current.signalUrl, "/ice"));
      const ice = iceResponseV1Schema.parse(await iceResponse.json());
      const pc = new RTCPeerConnection({ iceServers: ice.iceServers });
      pcRef.current = pc;
      const channel = pc.createDataChannel("harness-health");
      attachDataChannel(channel);
      addNativeEvent<{ candidate: RTCIceCandidate | null }>(
        pc,
        "icecandidate",
        (event) => {
          if (!event.candidate) return;
          void sendSignal(
            ws,
            current,
            current.pairedDeviceSecret ?? "",
            "peer.ice",
            {
              version: RTC_PROTOCOL_VERSION,
              kind: "peer.ice",
              deviceId: current.deviceId,
              ice: event.candidate.toJSON(),
            },
            current.desktopDeviceId
          );
        }
      );
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      await sendSignal(
        ws,
        current,
        current.pairedDeviceSecret,
        "peer.offer",
        {
          version: RTC_PROTOCOL_VERSION,
          kind: "peer.offer",
          deviceId: current.deviceId,
          deviceName: current.deviceName,
          deviceKind: "iphone",
          sdp: JSON.stringify(pc.localDescription),
        },
        current.desktopDeviceId
      );
    },
    [attachDataChannel, sendSignal]
  );

  const connectPeer = useCallback(
    async (current: Pairing) => {
      closePeer();
      setLoading(true);
      setConnectionStatus("Connecting");
      try {
        ensureCryptoRuntime();
        const ws = new WebSocket(
          signalWebSocketUrl({
            signalUrl: current.signalUrl,
            cloudUserId: current.cloudUserId,
            deviceId: current.deviceId,
            role: "device",
            pairingId: current.pairingId,
          })
        );
        wsRef.current = ws;
        ws.onopen = () => {
          if (current.pairedDeviceSecret && current.desktopDeviceId) {
            void createOffer(current, ws);
            return;
          }
          if (!current.pairingSecret || !current.pairingId) return;
          void sendSignal(ws, current, current.pairingSecret, "pair.request", {
            version: RTC_PROTOCOL_VERSION,
            kind: "pair.request",
            deviceId: current.deviceId,
            deviceName: current.deviceName,
            deviceKind: "iphone",
          });
        };
        ws.onmessage = (event) => {
          void (async () => {
            const envelope = signalEnvelopeV1Schema.parse(
              JSON.parse(event.data)
            );
            const firstPairing = envelope.kind === "pair.accept";
            const secret = signalSecret(
              pairingRef.current ?? current,
              firstPairing
            );
            if (!secret) return;
            const payload = await decryptSignalEnvelope({ secret, envelope });
            const active = pairingRef.current ?? current;
            if (payload.kind === "pair.accept" && payload.pairedDeviceSecret) {
              const nextPairing = {
                ...active,
                pairedDeviceSecret: payload.pairedDeviceSecret,
                desktopDeviceId: payload.deviceId,
                desktopDeviceName: payload.deviceName,
                pairingSecret: undefined,
              };
              await persistPairing(nextPairing);
              await createOffer(nextPairing, ws);
            } else if (payload.kind === "peer.answer" && payload.sdp) {
              await pcRef.current?.setRemoteDescription(
                parseRemoteDescription(payload.sdp)
              );
              for (const candidate of pendingIceRef.current) {
                await pcRef.current?.addIceCandidate(candidate);
              }
              pendingIceRef.current = [];
            } else if (payload.kind === "peer.ice") {
              const candidate = candidateFromUnknown(payload.ice);
              if (!candidate) return;
              if (pcRef.current?.remoteDescription) {
                await pcRef.current.addIceCandidate(candidate);
              } else {
                pendingIceRef.current.push(candidate);
              }
            }
          })().catch((err) => {
            setSyncError(err instanceof Error ? err.message : String(err));
          });
        };
        ws.onerror = () => {
          setSyncError("Signaling connection failed.");
          setConnectionStatus("Disconnected");
        };
        ws.onclose = () => {
          setConnectionStatus((value) =>
            value === "Connected" ? value : "Disconnected"
          );
        };
      } catch (err) {
        if (isWebCryptoRuntimeError(err) && DEV_AUTO_PAIR_ENABLED) {
          setConnectionStatus("Preview");
          setSyncError("");
          void refreshDevSnapshot();
        } else {
          setSyncError(err instanceof Error ? err.message : String(err));
          Alert.alert(
            "Connection failed",
            err instanceof Error ? err.message : String(err)
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [closePeer, createOffer, persistPairing, refreshDevSnapshot, sendSignal]
  );

  const pairParsed = useCallback(
    async (next: Pairing) => {
      await persistPairing(next);
      await connectPeer(next);
    },
    [connectPeer, persistPairing]
  );

  const pairFromUrl = useCallback(
    async (input: string): Promise<boolean> => {
      const next = parsePairingUrl(input.trim());
      if (!next) return false;
      await pairParsed(next);
      return true;
    },
    [pairParsed]
  );

  const pairDevDevice = useCallback(async (): Promise<boolean> => {
    if (!DEV_AUTO_PAIR_ENABLED || pairingRef.current) return false;
    setDevAutoPairing(true);
    setConnectionStatus("Auto pairing");
    setSyncError("");
    try {
      try {
        ensureCryptoRuntime();
      } catch (err) {
        if (isWebCryptoRuntimeError(err)) {
          return await refreshDevSnapshot();
        }
        throw err;
      }
      const next = await fetchDevPairing();
      await pairParsed(next);
      return true;
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
      setConnectionStatus("Preview");
      return false;
    } finally {
      setDevAutoPairing(false);
    }
  }, [pairParsed, refreshDevSnapshot]);

  const refresh = useCallback(async () => {
    const current = pairingRef.current;
    if (!current) {
      await refreshDevSnapshot();
      return;
    }
    if (channelRef.current?.readyState === "open" && requestSnapshot()) {
      setLoading(false);
      return;
    }
    await connectPeer(current);
    await pullEncryptedBackup(current);
  }, [connectPeer, pullEncryptedBackup, refreshDevSnapshot, requestSnapshot]);

  const unpair = useCallback(async () => {
    await clearPairing();
    await clearSnapshotDb();
    closePeer();
    pairingRef.current = null;
    setPairing(null);
    setSnapshot(null);
    setLastSyncedAt("");
    setSyncError("");
    setConnectionStatus("Preview");
  }, [closePeer]);

  const markDecision = useCallback(
    async (findingId: string, state: ReviewState): Promise<void> => {
      const current = pairingRef.current;
      const report = snapshot?.report;
      if (!current || !report) return;
      const pending: PendingDecision = {
        reportId: report.id,
        findingId,
        state,
        updatedAt: Date.now(),
      };
      const nextPairing = {
        ...current,
        pendingDecisions: [
          pending,
          ...current.pendingDecisions.filter(
            (decision) => decision.findingId !== findingId
          ),
        ],
      };
      await persistPairing(nextPairing);
      await flushPendingDecisions();
    },
    [flushPendingDecisions, persistPairing, snapshot?.report]
  );

  useEffect(() => {
    void loadPairing()
      .then((stored) => {
        if (!stored) return;
        pairingRef.current = stored;
        setPairing(stored);
        void loadSnapshotFromSqlite(stored).then((localSnapshot) => {
          if (localSnapshot) setSnapshot(localSnapshot);
        });
        void connectPeer(stored);
        void pullEncryptedBackup(stored);
      })
      .finally(() => setHydrated(true));
  }, [connectPeer, pullEncryptedBackup]);

  useEffect(() => {
    if (!hydrated || pairing || devAutoPairing || !DEV_AUTO_PAIR_ENABLED) {
      return;
    }
    void pairDevDevice();
  }, [devAutoPairing, hydrated, pairDevDevice, pairing]);

  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      void pairFromUrl(url);
    });
    void Linking.getInitialURL().then((url) => {
      if (url) void pairFromUrl(url);
    });
    return () => subscription.remove();
  }, [pairFromUrl]);

  return {
    pairing,
    paired: Boolean(pairing),
    snapshot,
    loading,
    devAutoPairing,
    devAutoPairEnabled: DEV_AUTO_PAIR_ENABLED,
    syncError,
    lastSyncedAt,
    connectionStatus,
    signalBaseUrl,
    pairFromUrl,
    refresh,
    unpair,
    markDecision,
  };
}
