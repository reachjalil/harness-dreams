import {
  MAX_SIGNAL_FRAME_BYTES,
  isFreshSignal,
  signalEnvelopeV1Schema,
  signalFrameSize,
} from "@harness-health/core";
import { DurableObject } from "cloudflare:workers";

import type { Env } from "./types";

const ROLE_TAG_PREFIX = "role:";
const DEVICE_TAG_PREFIX = "device:";
const PAIRING_TAG_PREFIX = "pairing:";

type PeerRole = "desktop" | "device";

function tag(prefix: string, value: string): string {
  return `${prefix}${value}`;
}

function tagValue(tags: string[], prefix: string): string {
  return (
    tags
      .find((candidate) => candidate.startsWith(prefix))
      ?.slice(prefix.length) ?? ""
  );
}

function socketRole(tags: string[]): PeerRole | "" {
  const role = tagValue(tags, ROLE_TAG_PREFIX);
  return role === "desktop" || role === "device" ? role : "";
}

function closeSocket(ws: WebSocket, code: number, reason: string): void {
  try {
    ws.close(code, reason);
  } catch {
    // The socket may already be closed by the peer.
  }
}

function serializeError(message: string): string {
  return JSON.stringify({ type: "error", message });
}

export class SignalRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get("upgrade") ?? "";
    if (upgrade.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade.", { status: 426 });
    }

    const url = new URL(request.url);
    const deviceId = url.searchParams.get("deviceId")?.trim() ?? "";
    const role = url.searchParams.get("role")?.trim() ?? "";
    const pairingId = url.searchParams.get("pairingId")?.trim() ?? "";
    if (!deviceId || (role !== "desktop" && role !== "device")) {
      return new Response("Missing valid deviceId or role.", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    const tags = [tag(ROLE_TAG_PREFIX, role), tag(DEVICE_TAG_PREFIX, deviceId)];
    if (pairingId) tags.push(tag(PAIRING_TAG_PREFIX, pairingId));
    this.ctx.acceptWebSocket(server, tags);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    if (typeof message !== "string") {
      ws.send(serializeError("Only JSON text signaling frames are accepted."));
      return;
    }

    if (new TextEncoder().encode(message).byteLength > MAX_SIGNAL_FRAME_BYTES) {
      ws.send(serializeError("Signaling frame is too large."));
      closeSocket(ws, 1009, "frame too large");
      return;
    }

    const tags = this.ctx.getTags(ws);
    const fromDeviceId = tagValue(tags, DEVICE_TAG_PREFIX);
    const roomName = this.ctx.id.name ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      ws.send(serializeError("Signaling frame must be valid JSON."));
      return;
    }

    if (signalFrameSize(parsed) > MAX_SIGNAL_FRAME_BYTES) {
      ws.send(serializeError("Signaling frame is too large."));
      closeSocket(ws, 1009, "frame too large");
      return;
    }

    const envelope = signalEnvelopeV1Schema.safeParse(parsed);
    if (!envelope.success) {
      ws.send(serializeError("Signaling frame failed schema validation."));
      return;
    }

    const frame = envelope.data;
    if (frame.cloudUserId !== roomName || frame.fromDeviceId !== fromDeviceId) {
      ws.send(serializeError("Signaling frame route metadata is invalid."));
      return;
    }
    if (!isFreshSignal(frame.createdAt)) {
      ws.send(serializeError("Signaling frame is outside the replay window."));
      return;
    }

    const text = JSON.stringify(frame);
    for (const target of this.targetsFor(frame.toDeviceId)) {
      if (target === ws) continue;
      target.send(text);
    }
  }

  webSocketClose(): void {
    // Hibernatable WebSockets are tracked by Cloudflare tags, not local maps.
  }

  webSocketError(): void {
    // No durable cleanup is required because no application data is stored.
  }

  private targetsFor(toDeviceId: string | undefined): WebSocket[] {
    if (toDeviceId) {
      return this.ctx.getWebSockets(tag(DEVICE_TAG_PREFIX, toDeviceId));
    }
    return this.ctx
      .getWebSockets(tag(ROLE_TAG_PREFIX, "desktop"))
      .filter((target) => socketRole(this.ctx.getTags(target)) === "desktop");
  }
}
