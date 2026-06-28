import {
  createHmac,
  createHash,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";

import type {
  ActionState,
  CloudSyncDevice,
  CloudSyncDeviceKind,
  CloudSyncPairing,
  DreamReport,
  Finding,
  Metric,
  Ring,
  SyncedReviewDecision,
} from "../shared/types";
import { getLatest, mergeRemoteReviewDecisions } from "./reports";
import { getConfig, setConfig } from "./store";

const PAIRING_TTL_MS = 10 * 60 * 1000;
const DEV_SYNC_PORT = 39_391;
const JWT_ISSUER = "harness-dreams-desktop";
const JWT_AUDIENCE = "harness-dreams-companion";
const VALID_DECISION_STATES = new Set<ActionState>([
  "accepted",
  "rejected",
  "queued",
  "snoozed",
]);

let server: http.Server | null = null;
let serverPort: number | null = null;

interface PairingJwtPayload {
  iss: typeof JWT_ISSUER;
  aud: typeof JWT_AUDIENCE;
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  userId: string;
  deviceId: string;
  deviceName: string;
  deviceKind: CloudSyncDeviceKind;
  desktopDeviceId: string;
  desktopDeviceName: string;
  syncBaseUrl: string;
  scope: string[];
}

interface AuthenticatedDevice {
  token: string;
  tokenHash: string;
  device: CloudSyncDevice;
  payload: PairingJwtPayload;
}

function devAutoPairEnabled(): boolean {
  if (process.env.HARNESS_DREAMS_DEV_AUTO_PAIR === "0") return false;
  if (process.env.HARNESS_DREAMS_DEV_AUTO_PAIR === "1") return true;
  return (
    process.env.NODE_ENV === "development" ||
    Boolean((process as NodeJS.Process & { defaultApp?: boolean }).defaultApp)
  );
}

function deviceSyncPort(): number {
  const raw = process.env.HARNESS_DREAMS_DEVICE_SYNC_PORT;
  if (raw) {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0 && parsed < 65_536) {
      return parsed;
    }
  }
  return devAutoPairEnabled() ? DEV_SYNC_PORT : 0;
}

function isLoopbackRequest(request: IncomingMessage): boolean {
  const address = request.socket.remoteAddress ?? "";
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
}

function parseDeviceKind(value: string | null): CloudSyncDeviceKind {
  return value === "ipad" || value === "watch" ? value : "iphone";
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeBase64url(input: string): Buffer {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  return Buffer.from(padded, "base64");
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

function signJwt(payload: PairingJwtPayload, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const body = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(body).digest();
  return `${body}.${base64url(signature)}`;
}

function verifyJwt(token: string, secret: string): PairingJwtPayload | null {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

  const body = `${encodedHeader}.${encodedPayload}`;
  const expected = createHmac("sha256", secret).update(body).digest();
  const actual = decodeBase64url(encodedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  const payload = JSON.parse(
    decodeBase64url(encodedPayload).toString("utf8")
  ) as PairingJwtPayload;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    payload.iss !== JWT_ISSUER ||
    payload.aud !== JWT_AUDIENCE ||
    payload.exp <= nowSeconds
  ) {
    return null;
  }
  return payload;
}

function localAddress(): string {
  for (const interfaces of Object.values(networkInterfaces())) {
    for (const item of interfaces ?? []) {
      if (item.family === "IPv4" && !item.internal) return item.address;
    }
  }
  return "127.0.0.1";
}

export function getDeviceSyncUrl(): string {
  return serverPort ? `http://${localAddress()}:${serverPort}` : "";
}

function waitForDeviceSyncUrl(): Promise<string> {
  const current = getDeviceSyncUrl();
  if (current) return Promise.resolve(current);
  return new Promise((resolve) => {
    server?.once("listening", () => resolve(getDeviceSyncUrl()));
  });
}

function json(
  response: ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

function readBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("error", reject);
    request.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function authenticate(request: IncomingMessage): AuthenticatedDevice | null {
  const header = request.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const config = getConfig().cloudSync;
  const payload = verifyJwt(token, config.jwtSecret);
  if (!payload || payload.userId !== config.userId) return null;

  const hash = tokenHash(token);
  const device = config.devices.find(
    (item) =>
      item.deviceId === payload.deviceId &&
      item.tokenHash === hash &&
      item.status !== "revoked"
  );
  if (!device) return null;

  return { token, tokenHash: hash, device, payload };
}

function markDeviceSeen(auth: AuthenticatedDevice): void {
  const now = Date.now();
  const current = getConfig().cloudSync.devices;
  const existing = current.find(
    (device) => device.deviceId === auth.device.deviceId
  );
  if (
    existing &&
    existing.status === "active" &&
    existing.lastSeenAt &&
    now - existing.lastSeenAt < 60_000
  ) {
    return;
  }
  setConfig({
    cloudSync: {
      devices: current.map((device) =>
        device.deviceId === auth.device.deviceId
          ? { ...device, status: "active", lastSeenAt: now }
          : device
      ),
    },
  });
}

function safeFindings(findings: Finding[]): Array<{
  id: string;
  type: Finding["type"];
  title: string;
  summary: string;
  action: string;
  confidence: Finding["confidence"];
  project: string;
}> {
  return findings.map((finding) => ({
    id: finding.id,
    type: finding.type,
    title: finding.title,
    summary: finding.body,
    action: finding.action,
    confidence: finding.confidence,
    project: finding.project,
  }));
}

function mobileSnapshot(report: DreamReport | null): {
  report: null | {
    id: string;
    timestamp: number;
    rangeLabel: string;
    sessions: number;
    projects: number;
    harness: string;
    digest: string;
    rings: Ring[];
    metrics: Metric[];
    findings: ReturnType<typeof safeFindings>;
  };
} {
  if (!report) return { report: null };
  return {
    report: {
      id: report.id,
      timestamp: report.timestamp,
      rangeLabel: report.rangeLabel,
      sessions: report.sessions,
      projects: report.projects,
      harness: report.harness,
      digest: report.digest,
      rings: report.rings,
      metrics: report.metrics,
      findings: safeFindings(report.findings),
    },
  };
}

async function handleSnapshot(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const auth = authenticate(request);
  if (!auth) {
    json(response, 401, { error: "unauthorized" });
    return;
  }
  markDeviceSeen(auth);
  json(response, 200, {
    userId: auth.payload.userId,
    desktopDeviceId: auth.payload.desktopDeviceId,
    desktopDeviceName: auth.payload.desktopDeviceName,
    deviceId: auth.device.deviceId,
    ...mobileSnapshot(getLatest()),
  });
}

async function handleDecisions(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const auth = authenticate(request);
  if (!auth) {
    json(response, 401, { error: "unauthorized" });
    return;
  }

  const body = (await readBody(request)) as {
    reportId?: unknown;
    decisions?: unknown;
  };
  if (typeof body.reportId !== "string" || typeof body.decisions !== "object") {
    json(response, 400, { error: "invalid decision payload" });
    return;
  }

  const now = Date.now();
  const incoming: SyncedReviewDecision[] = [];
  for (const [findingId, state] of Object.entries(
    body.decisions as Record<string, unknown>
  )) {
    if (
      typeof findingId !== "string" ||
      !VALID_DECISION_STATES.has(state as ActionState)
    ) {
      continue;
    }
    incoming.push({
      reportId: body.reportId,
      findingId,
      state: state as Exclude<ActionState, "open">,
      updatedAt: now,
      sourceDeviceId: auth.device.deviceId,
      sourceDeviceName: auth.device.deviceName,
      deviceTokenHash: auth.tokenHash,
    });
  }

  const result = mergeRemoteReviewDecisions(incoming);
  markDeviceSeen(auth);
  json(response, 200, {
    applied: result.applied,
    ...mobileSnapshot(getLatest()),
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  if (request.method === "OPTIONS") {
    json(response, 204, {});
    return;
  }

  const url = new URL(
    request.url ?? "/",
    getDeviceSyncUrl() || "http://localhost"
  );
  if (request.method === "GET" && url.pathname === "/v1/snapshot") {
    await handleSnapshot(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/decisions") {
    await handleDecisions(request, response);
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/dev/pair") {
    await handleDevPair(request, response, url);
    return;
  }
  json(response, 404, { error: "not found" });
}

async function handleDevPair(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL
): Promise<void> {
  const config = getConfig().cloudSync;
  if (!devAutoPairEnabled() || !config.devBypassPaidPlan) {
    json(response, 404, { error: "dev auto-pair is disabled" });
    return;
  }
  if (!isLoopbackRequest(request)) {
    json(response, 403, { error: "dev auto-pair requires loopback" });
    return;
  }

  const kind = parseDeviceKind(url.searchParams.get("kind"));
  const deviceName =
    url.searchParams.get("deviceName") ??
    (kind === "watch" ? "Dev Apple Watch" : "Dev iPhone");
  const pairing = await createCloudSyncPairing({
    deviceId: `dev-${kind}-simulator`,
    deviceName,
    kind,
  });
  json(response, 200, {
    token: pairing.token,
    pairingUrl: pairing.pairingUrl,
    syncBaseUrl: getDeviceSyncUrl(),
    devSyncBaseUrl: pairing.devSyncBaseUrl,
    expiresAt: pairing.expiresAt,
    device: pairing.device,
  });
}

export function initDeviceSyncServer(): void {
  if (server) return;
  server = http.createServer((request, response) => {
    void handleRequest(request, response).catch((err) => {
      json(response, 500, {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  });
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE" && serverPort === null) {
      console.warn(
        `[device-sync] port ${deviceSyncPort()} unavailable; falling back to an ephemeral port`
      );
      server?.listen(0, "0.0.0.0");
      return;
    }
    console.error("[device-sync] server error", err);
  });
  server.listen(deviceSyncPort(), "0.0.0.0", () => {
    const address = server?.address();
    serverPort = typeof address === "object" && address ? address.port : null;
  });
}

export function shutdownDeviceSyncServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    const current = server;
    server = null;
    serverPort = null;
    current.close(() => resolve());
  });
}

export async function createCloudSyncPairing(input: {
  deviceId?: string;
  deviceName?: string;
  kind?: CloudSyncDeviceKind;
}): Promise<CloudSyncPairing> {
  if (!server) initDeviceSyncServer();
  const config = getConfig().cloudSync;
  const now = Date.now();
  const deviceId = input.deviceId ?? randomUUID();
  const kind = input.kind ?? "iphone";
  const deviceName =
    input.deviceName?.trim() ||
    (kind === "watch" ? "Apple Watch" : kind === "ipad" ? "iPad" : "iPhone");
  const expiresAt = now + PAIRING_TTL_MS;
  const syncBaseUrl = await waitForDeviceSyncUrl();
  const devSyncBaseUrl =
    serverPort === null ? syncBaseUrl : `http://127.0.0.1:${serverPort}`;
  const payload: PairingJwtPayload = {
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    sub: deviceId,
    jti: randomUUID(),
    iat: Math.floor(now / 1000),
    exp: Math.floor(expiresAt / 1000),
    userId: config.userId,
    deviceId,
    deviceName,
    deviceKind: kind,
    desktopDeviceId: config.deviceId,
    desktopDeviceName: config.deviceName,
    syncBaseUrl,
    scope: ["cycle:read", "decision:write"],
  };
  const token = signJwt(payload, config.jwtSecret);
  const device: CloudSyncDevice = {
    deviceId,
    deviceName,
    kind,
    status: "pending",
    tokenHash: tokenHash(token),
    createdAt: now,
    lastTokenIssuedAt: now,
  };
  setConfig({
    cloudSync: {
      enabled: true,
      devices: [
        device,
        ...config.devices.filter(
          (candidate) => candidate.deviceId !== deviceId
        ),
      ],
    },
    cloudSyncInterest: true,
  });

  const pairingUrl = `harnessdreams://pair?token=${encodeURIComponent(
    token
  )}&syncBaseUrl=${encodeURIComponent(syncBaseUrl)}&devSyncBaseUrl=${encodeURIComponent(
    devSyncBaseUrl
  )}&deviceName=${encodeURIComponent(deviceName)}`;
  const QRCode = await import("qrcode");
  const qrDataUrl = await QRCode.toDataURL(pairingUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 360,
  });

  return { token, pairingUrl, devSyncBaseUrl, qrDataUrl, expiresAt, device };
}

export function removeCloudSyncDevice(deviceId: string): CloudSyncDevice[] {
  const devices = getConfig().cloudSync.devices.filter(
    (device) => device.deviceId !== deviceId
  );
  setConfig({ cloudSync: { devices } });
  return devices;
}
