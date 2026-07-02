import { useEffect } from "react";

import {
  PEER_MESSAGE_SCHEMA_VERSION,
  RTC_PROTOCOL_VERSION,
  decryptSignalEnvelope,
  encryptSignalEnvelope,
  generateSecret,
  iceResponseV1Schema,
  messageId,
  peerSyncMessageV1Schema,
  signalApiUrl,
  signalEnvelopeV1Schema,
  signalWebSocketUrl,
  type PeerSyncMessageV1,
  type SignalEnvelopeKind,
  type SignalEnvelopeV1,
  type SignalPlaintextV1,
} from "@harness-health/core";

import type {
  CloudSyncDeviceKind,
  PeerHostDevice,
  PeerHostPairingSession,
  PeerHostState,
} from "../shared/types";

type HostApi = Window["hd"]["peerHost"];

function parseDescription(value: string): RTCSessionDescriptionInit {
  const parsed = JSON.parse(value) as RTCSessionDescriptionInit;
  if (parsed.type !== "offer" && parsed.type !== "answer") {
    throw new Error("Invalid WebRTC session description.");
  }
  return parsed;
}

function candidateFromUnknown(value: unknown): RTCIceCandidateInit | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as RTCIceCandidateInit;
  return typeof candidate.candidate === "string" ? candidate : null;
}

function detectIceMode(iceServers: RTCIceServer[]): "stun" | "turn" {
  const urls = iceServers.flatMap((server) =>
    Array.isArray(server.urls) ? server.urls : [server.urls]
  );
  return urls.some((url) => url.startsWith("turn:") || url.startsWith("turns:"))
    ? "turn"
    : "stun";
}

class DesktopPeerHost {
  private state: PeerHostState | null = null;
  private readonly deviceSecrets = new Map<string, PeerHostDevice>();
  private readonly pairingSessions = new Map<string, PeerHostPairingSession>();
  private readonly peerConnections = new Map<string, RTCPeerConnection>();
  private readonly channels = new Map<string, RTCDataChannel>();
  private readonly queuedIce = new Map<string, RTCIceCandidateInit[]>();
  private iceServers: RTCIceServer[] = [];
  private ws: WebSocket | null = null;
  private wsKey = "";
  private stopped = false;
  private readonly unsubscribers: Array<() => void> = [];

  constructor(private readonly api: HostApi) {}

  async start(): Promise<void> {
    await this.refreshState();
    this.unsubscribers.push(
      this.api.onRefresh((_payload) => {
        void this.refreshState({ broadcastSnapshot: true });
      }),
      this.api.onPairingSession((session) => {
        this.pairingSessions.set(session.pairingId, session);
        void this.refreshState();
      })
    );
  }

  stop(): void {
    this.stopped = true;
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.closeSocket();
    for (const channel of this.channels.values()) channel.close();
    for (const pc of this.peerConnections.values()) pc.close();
    this.channels.clear();
    this.peerConnections.clear();
  }

  private async refreshState(
    options: { broadcastSnapshot?: boolean } = {}
  ): Promise<void> {
    if (this.stopped) return;
    this.state = await this.api.state();
    this.deviceSecrets.clear();
    for (const device of this.state.devices) {
      this.deviceSecrets.set(device.deviceId, device);
    }
    this.pairingSessions.clear();
    const now = Date.now();
    for (const session of this.state.pairingSessions) {
      if (session.expiresAt > now)
        this.pairingSessions.set(session.pairingId, session);
    }
    await this.loadIceServers();
    this.connectSignalSocket();
    if (options.broadcastSnapshot) this.broadcastSnapshot();
  }

  private async loadIceServers(): Promise<void> {
    if (!this.state) return;
    const response = await fetch(signalApiUrl(this.state.signalUrl, "/ice"));
    const parsed = iceResponseV1Schema.parse(await response.json());
    this.iceServers = parsed.iceServers as RTCIceServer[];
  }

  private connectSignalSocket(): void {
    if (!this.state?.enabled || !this.state.allowedByPlan) {
      this.closeSocket();
      return;
    }
    const key = `${this.state.signalUrl}\n${this.state.cloudUserId}\n${this.state.desktopDeviceId}`;
    if (this.ws && this.ws.readyState <= WebSocket.OPEN && this.wsKey === key) {
      return;
    }
    this.closeSocket();
    this.wsKey = key;
    const ws = new WebSocket(
      signalWebSocketUrl({
        signalUrl: this.state.signalUrl,
        cloudUserId: this.state.cloudUserId,
        deviceId: this.state.desktopDeviceId,
        role: "desktop",
      })
    );
    this.ws = ws;
    ws.addEventListener("message", (event) => {
      void this.handleSignalFrame(event.data).catch((error) => {
        console.error("[peer-host] signal frame failed", error);
      });
    });
    ws.addEventListener("close", () => {
      if (this.ws === ws) this.ws = null;
      if (!this.stopped) {
        window.setTimeout(() => this.connectSignalSocket(), 2500);
      }
    });
  }

  private closeSocket(): void {
    const current = this.ws;
    this.ws = null;
    this.wsKey = "";
    if (current && current.readyState <= WebSocket.OPEN) current.close();
  }

  private async handleSignalFrame(data: unknown): Promise<void> {
    if (typeof data !== "string" || !this.state) return;
    const envelope = signalEnvelopeV1Schema.parse(JSON.parse(data));
    const secret = this.secretForEnvelope(envelope);
    if (!secret) return;
    const payload = await decryptSignalEnvelope({ secret, envelope });
    if (payload.kind === "pair.request") {
      await this.handlePairRequest(envelope, payload, secret);
    } else if (payload.kind === "peer.offer") {
      await this.handlePeerOffer(envelope, payload, secret);
    } else if (payload.kind === "peer.ice") {
      await this.handlePeerIce(envelope.fromDeviceId, payload);
    } else if (payload.kind === "peer.close") {
      this.closePeer(envelope.fromDeviceId);
    }
  }

  private secretForEnvelope(envelope: SignalEnvelopeV1): string {
    if (envelope.kind === "pair.request" && envelope.pairingId) {
      return this.pairingSessions.get(envelope.pairingId)?.secret ?? "";
    }
    return this.deviceSecrets.get(envelope.fromDeviceId)?.sharedSecret ?? "";
  }

  private async sendSignal(input: {
    secret: string;
    kind: SignalEnvelopeKind;
    toDeviceId: string;
    pairingId?: string;
    payload: SignalPlaintextV1;
  }): Promise<void> {
    if (!this.state || !this.ws || this.ws.readyState !== WebSocket.OPEN)
      return;
    const envelope = await encryptSignalEnvelope({
      secret: input.secret,
      cloudUserId: this.state.cloudUserId,
      pairingId: input.pairingId,
      fromDeviceId: this.state.desktopDeviceId,
      toDeviceId: input.toDeviceId,
      kind: input.kind,
      payload: input.payload,
    });
    this.ws.send(JSON.stringify(envelope));
  }

  private async handlePairRequest(
    envelope: SignalEnvelopeV1,
    payload: SignalPlaintextV1,
    qrSecret: string
  ): Promise<void> {
    if (!this.state || !envelope.pairingId) return;
    const session = this.pairingSessions.get(envelope.pairingId);
    if (!session || session.expiresAt <= Date.now()) return;
    const deviceId = payload.deviceId || envelope.fromDeviceId;
    const deviceName = payload.deviceName || session.device.deviceName;
    const kind = (
      payload.deviceKind === "ipad" || payload.deviceKind === "watch"
        ? payload.deviceKind
        : "iphone"
    ) satisfies CloudSyncDeviceKind;
    const pairedDeviceSecret = generateSecret();
    await this.api.pairingAccepted({
      pairingId: envelope.pairingId,
      deviceId,
      deviceName,
      kind,
      pairedDeviceSecret,
    });
    await this.refreshState();
    await this.sendSignal({
      secret: qrSecret,
      pairingId: envelope.pairingId,
      kind: "pair.accept",
      toDeviceId: deviceId,
      payload: {
        version: RTC_PROTOCOL_VERSION,
        kind: "pair.accept",
        deviceId: this.state.desktopDeviceId,
        deviceName: this.state.desktopDeviceName,
        deviceKind: "desktop",
        accepted: true,
        pairedDeviceSecret,
      },
    });
  }

  private async handlePeerOffer(
    envelope: SignalEnvelopeV1,
    payload: SignalPlaintextV1,
    secret: string
  ): Promise<void> {
    if (!this.state || !payload.sdp) return;
    const deviceId = payload.deviceId || envelope.fromDeviceId;
    this.closePeer(deviceId);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.peerConnections.set(deviceId, pc);
    pc.addEventListener("icecandidate", (event) => {
      if (!event.candidate) return;
      void this.sendSignal({
        secret,
        kind: "peer.ice",
        toDeviceId: deviceId,
        payload: {
          version: RTC_PROTOCOL_VERSION,
          kind: "peer.ice",
          deviceId: this.state?.desktopDeviceId ?? "",
          ice: event.candidate.toJSON(),
        },
      });
    });
    pc.addEventListener("datachannel", (event) => {
      this.attachDataChannel(deviceId, event.channel);
    });
    pc.addEventListener("connectionstatechange", () => {
      const connected = pc.connectionState === "connected";
      if (
        connected ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        void this.api.connectionStatus({
          deviceId,
          connected,
          lastSeenAt: connected ? Date.now() : undefined,
          iceMode: detectIceMode(this.iceServers),
          error:
            pc.connectionState === "failed"
              ? "WebRTC connection failed."
              : undefined,
        });
      }
    });
    await pc.setRemoteDescription(parseDescription(payload.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await this.flushQueuedIce(deviceId);
    await this.sendSignal({
      secret,
      kind: "peer.answer",
      toDeviceId: deviceId,
      payload: {
        version: RTC_PROTOCOL_VERSION,
        kind: "peer.answer",
        deviceId: this.state.desktopDeviceId,
        deviceName: this.state.desktopDeviceName,
        deviceKind: "desktop",
        sdp: JSON.stringify(pc.localDescription),
      },
    });
  }

  private async handlePeerIce(
    deviceId: string,
    payload: SignalPlaintextV1
  ): Promise<void> {
    const candidate = candidateFromUnknown(payload.ice);
    if (!candidate) return;
    const pc = this.peerConnections.get(deviceId);
    if (!pc?.remoteDescription) {
      const queued = this.queuedIce.get(deviceId) ?? [];
      queued.push(candidate);
      this.queuedIce.set(deviceId, queued);
      return;
    }
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private async flushQueuedIce(deviceId: string): Promise<void> {
    const pc = this.peerConnections.get(deviceId);
    if (!pc) return;
    const queued = this.queuedIce.get(deviceId) ?? [];
    this.queuedIce.delete(deviceId);
    for (const candidate of queued) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private attachDataChannel(deviceId: string, channel: RTCDataChannel): void {
    this.channels.set(deviceId, channel);
    channel.addEventListener("open", () => {
      this.sendPeerMessage(deviceId, this.helloMessage(deviceId));
      this.sendSnapshot(deviceId);
      void this.api.connectionStatus({
        deviceId,
        connected: true,
        lastSeenAt: Date.now(),
        iceMode: detectIceMode(this.iceServers),
      });
    });
    channel.addEventListener("message", (event) => {
      void this.handlePeerMessage(deviceId, event.data).catch((error) => {
        console.error("[peer-host] peer message failed", error);
      });
    });
    channel.addEventListener("close", () => {
      this.channels.delete(deviceId);
      void this.api.connectionStatus({ deviceId, connected: false });
    });
  }

  private helloMessage(deviceId: string): PeerSyncMessageV1 {
    if (!this.state) throw new Error("Peer host state is not loaded.");
    return {
      type: "hello",
      schemaVersion: PEER_MESSAGE_SCHEMA_VERSION,
      messageId: messageId("peer"),
      deviceId: this.state.desktopDeviceId,
      deviceName: this.state.desktopDeviceName,
      deviceKind: "desktop",
      lastKnownRevision:
        this.deviceSecrets.get(deviceId)?.lastAckedRevision ??
        this.state.revision,
      createdAt: Date.now(),
    };
  }

  private snapshotMessage(): PeerSyncMessageV1 {
    if (!this.state) throw new Error("Peer host state is not loaded.");
    return {
      type: "report.snapshot",
      messageId: messageId("snapshot"),
      payload: {
        schemaVersion: PEER_MESSAGE_SCHEMA_VERSION,
        desktopDeviceId: this.state.desktopDeviceId,
        desktopDeviceName: this.state.desktopDeviceName,
        revision: this.state.revision,
        reports: this.state.reports,
        createdAt: Date.now(),
      },
    };
  }

  private sendPeerMessage(deviceId: string, message: PeerSyncMessageV1): void {
    const channel = this.channels.get(deviceId);
    if (channel?.readyState !== "open") return;
    channel.send(JSON.stringify(peerSyncMessageV1Schema.parse(message)));
  }

  private sendSnapshot(deviceId: string): void {
    this.sendPeerMessage(deviceId, this.snapshotMessage());
  }

  private broadcastSnapshot(): void {
    for (const deviceId of this.channels.keys()) this.sendSnapshot(deviceId);
  }

  private async handlePeerMessage(
    deviceId: string,
    data: unknown
  ): Promise<void> {
    if (typeof data !== "string") return;
    const message = peerSyncMessageV1Schema.parse(JSON.parse(data));
    if (message.type === "request.snapshot") {
      await this.refreshState();
      this.sendSnapshot(deviceId);
      return;
    }
    if (message.type === "review.decisions") {
      const result = await this.api.applyDecisions(message.payload);
      await this.refreshState();
      this.sendPeerMessage(deviceId, {
        type: "ack",
        messageId: messageId("ack"),
        payload: {
          schemaVersion: PEER_MESSAGE_SCHEMA_VERSION,
          ackId: message.messageId,
          revision: result.revision,
          accepted: true,
          createdAt: Date.now(),
        },
      });
      void this.api.connectionStatus({
        deviceId,
        connected: true,
        lastSeenAt: Date.now(),
        lastAckedRevision: result.revision,
      });
      this.broadcastSnapshot();
    }
  }

  private closePeer(deviceId: string): void {
    this.channels.get(deviceId)?.close();
    this.channels.delete(deviceId);
    this.peerConnections.get(deviceId)?.close();
    this.peerConnections.delete(deviceId);
    this.queuedIce.delete(deviceId);
    void this.api.connectionStatus({ deviceId, connected: false });
  }
}

export default function PeerHost(): null {
  useEffect(() => {
    const host = new DesktopPeerHost(window.hd.peerHost);
    void host.start().catch((error) => {
      console.error("[peer-host] failed to start", error);
    });
    return () => host.stop();
  }, []);

  return null;
}
