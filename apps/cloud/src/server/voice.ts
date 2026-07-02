import { base64UrlEncode } from "@harness-health/core";

import type { Env } from "./types";

const encoder = new TextEncoder();

function utf8(value: string): Uint8Array {
  return encoder.encode(value);
}

function bufferSource(value: string): ArrayBuffer {
  const encoded = utf8(value);
  const copy = new Uint8Array(encoded.byteLength);
  copy.set(encoded);
  return copy.buffer as ArrayBuffer;
}

async function signHs256(input: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    bufferSource(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, bufferSource(input));
  return base64UrlEncode(new Uint8Array(signature));
}

export async function createVoiceToken(env: Env): Promise<Response> {
  const apiKey = env.LIVEKIT_API_KEY?.trim();
  const apiSecret = env.LIVEKIT_API_SECRET?.trim();
  const url = env.LIVEKIT_URL?.trim();
  if (!apiKey || !apiSecret || !url) {
    return Response.json(
      { error: "LiveKit voice token minting is not configured." },
      { status: 501 }
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const room = `health-${crypto.randomUUID().slice(0, 8)}`;
  const identity = `user-${crypto.randomUUID().slice(0, 8)}`;
  const agentName = env.LIVEKIT_AGENT_NAME?.trim() || "health-voice";
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: apiKey,
    sub: identity,
    name: "User",
    nbf: now,
    exp: now + 60 * 60,
    video: {
      room,
      room_join: true,
      can_publish: true,
      can_subscribe: true,
      can_publish_data: true,
    },
    room_config: {
      agents: [{ agent_name: agentName }],
    },
  };
  const encodedHeader = base64UrlEncode(utf8(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(utf8(JSON.stringify(payload)));
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signature = await signHs256(unsigned, apiSecret);
  return Response.json({
    token: `${unsigned}.${signature}`,
    url,
    room,
  });
}
