import {
  HARNESS_HEALTH_RTC_BASE_PATH,
  RTC_PROTOCOL_VERSION,
  iceResponseV1Schema,
  iceServerSchema,
} from "@harness-health/core";
import { Hono } from "hono";
import { z } from "zod";

import { json, jsonError, jsonHeaders } from "./server/http";
import { SignalRoom } from "./server/signalRoom";
import { SnapshotBackupRoom } from "./server/snapshotBackupRoom";
import type { Env } from "./server/types";
import { createVoiceToken } from "./server/voice";

export { SignalRoom, SnapshotBackupRoom };

const app = new Hono<{ Bindings: Env }>().basePath(
  HARNESS_HEALTH_RTC_BASE_PATH
);

app.options(
  "*",
  () => new Response(null, { status: 204, headers: jsonHeaders })
);

app.get("/users/:cloudUserId/ws", (context) => {
  const cloudUserId = context.req.param("cloudUserId")?.trim();
  if (!cloudUserId) return jsonError("missing cloud user id", 400);
  const roomId = context.env.SIGNAL_ROOM.idFromName(cloudUserId);
  const room = context.env.SIGNAL_ROOM.get(roomId);
  return room.fetch(context.req.raw);
});

app.get("/ice", (context) => {
  const configured = context.env.RTC_ICE_SERVERS_JSON?.trim();
  const parsed = configured
    ? z.array(iceServerSchema).safeParse(JSON.parse(configured))
    : {
        success: true as const,
        data: [{ urls: "stun:stun.l.google.com:19302" }],
      };
  if (!parsed.success) {
    return jsonError("RTC_ICE_SERVERS_JSON is invalid.", 500, parsed.error);
  }
  return json(
    iceResponseV1Schema.parse({
      version: RTC_PROTOCOL_VERSION,
      iceServers: parsed.data,
    })
  );
});

function backupRoomFor(context: {
  req: { param: (name: string) => string };
  env: Env;
}): DurableObjectStub | Response {
  const cloudUserId = context.req.param("cloudUserId")?.trim();
  if (!cloudUserId) return jsonError("missing cloud user id", 400);
  const roomId = context.env.SNAPSHOT_BACKUP.idFromName(cloudUserId);
  return context.env.SNAPSHOT_BACKUP.get(roomId);
}

app.post("/backup/users/:cloudUserId/snapshots", (context) => {
  const room = backupRoomFor(context);
  return room instanceof Response ? room : room.fetch(context.req.raw);
});

app.get("/backup/users/:cloudUserId/latest", (context) => {
  const room = backupRoomFor(context);
  return room instanceof Response ? room : room.fetch(context.req.raw);
});

app.delete("/backup/users/:cloudUserId", (context) => {
  const room = backupRoomFor(context);
  return room instanceof Response ? room : room.fetch(context.req.raw);
});

app.post("/voice/token", (context) => createVoiceToken(context.env));

app.notFound(() => jsonError("Harness Health RTC route not found", 404));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await app.fetch(request, env);
    } catch (error) {
      return jsonError("Harness Health RTC request failed", 500, String(error));
    }
  },
} satisfies ExportedHandler<Env>;
