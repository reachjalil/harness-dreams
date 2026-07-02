import { randomUUID } from "node:crypto";
import http from "node:http";

import {
  RTC_PROTOCOL_VERSION,
  encodePairingLink,
  generateSecret,
  sha256Base64Url,
} from "@harness-health/core";

import type {
  CloudSyncDevice,
  CloudSyncDeviceKind,
  CloudSyncPairing,
  HealthReport,
  LiveTelemetrySnapshot,
  Metric,
} from "../shared/types";
import { sanitizeReportForCloud } from "./cloudRedaction";
import { registerPeerPairingSession } from "./cloudSync";
import { getReports } from "./reports";
import { getConfig, setConfig } from "./store";
import { getTelemetrySnapshot } from "./telemetry";

const PAIRING_TTL_MS = 10 * 60 * 1000;
const DEV_SYNC_PORT = Number(process.env.HARNESS_HEALTH_DEV_SYNC_PORT ?? 39391);

let devSyncServer: http.Server | null = null;

function signalingBaseUrl(): string {
  return getConfig().cloudSync.cloudApiBaseUrl.replace(/\/+$/u, "");
}

function metricByCanonical(
  snapshot: LiveTelemetrySnapshot,
  canonicalKey: string
): Metric | undefined {
  return snapshot.metrics.find(
    (metric) => (metric.canonicalKey ?? metric.key) === canonicalKey
  );
}

function telemetryHasData(snapshot: LiveTelemetrySnapshot): boolean {
  return snapshot.sources.some((source) => source.events > 0);
}

function metricSamples(
  snapshot: LiveTelemetrySnapshot,
  canonicalKey: string
): NonNullable<Metric["samples"]> | undefined {
  if (snapshot.trendSeries.length === 0) return undefined;
  if (canonicalKey === "tokens.total") {
    return snapshot.trendSeries.map((point) => ({
      label: point.label,
      value: point.tokens,
      display:
        point.tokens >= 1000
          ? `${Math.round(point.tokens / 1000)}K`
          : `${Math.round(point.tokens)}`,
    }));
  }
  if (canonicalKey === "sessions.active") {
    return snapshot.trendSeries.map((point) => ({
      label: point.label,
      value: point.sessions,
      display: `${point.sessions}`,
    }));
  }
  return undefined;
}

function reportFromTelemetrySnapshot(
  snapshot: LiveTelemetrySnapshot
): HealthReport {
  const sessions = metricByCanonical(snapshot, "sessions.active");
  const metrics = snapshot.metrics.map((metric) => {
    const canonicalKey = metric.canonicalKey ?? metric.key;
    return {
      ...metric,
      key: canonicalKey,
      canonicalKey,
      samples: metric.samples ?? metricSamples(snapshot, canonicalKey),
    };
  });
  return {
    id: `live-telemetry-${snapshot.generatedAt}`,
    timestamp: snapshot.generatedAt,
    kind: "quick",
    reviewStatus: "unreviewed",
    rangeLabel: snapshot.window.label,
    sessions: Math.max(0, Math.round(sessions?.numericValue ?? 0)),
    projects: snapshot.activeProjects.length,
    harness: "Codex + Claude realtime",
    digest: snapshot.status.message,
    rings: snapshot.rings,
    metrics,
    findings: snapshot.insights.slice(0, 3).map((insight) => ({
      id: insight.id,
      type:
        insight.severity === "positive"
          ? "win"
          : insight.severity === "warning"
            ? "risk"
            : "opportunity",
      title: insight.title,
      body: insight.explanation,
      improvement: insight.recommendation ?? insight.explanation,
      agentBenefit: insight.recommendation ?? insight.explanation,
      userBenefit: insight.recommendation ?? insight.explanation,
      reflection: insight.explanation,
      confidence: insight.confidence,
      project: "Realtime telemetry",
      evidence: insight.explanation,
      action: insight.recommendation ?? "Review realtime telemetry",
    })),
    experiments: [],
    window: {
      start: snapshot.window.start,
      end: snapshot.window.end,
      basis: "last-24h",
      label: snapshot.window.label,
      sessionsInWindow: Math.max(0, Math.round(sessions?.numericValue ?? 0)),
      turnsInWindow: snapshot.sources.reduce(
        (sum, source) => sum + source.events,
        0
      ),
    },
    projectInsights: snapshot.activeProjects.map((project) => ({
      name: project.name,
      path: project.path,
      sources: project.sources.filter(
        (source) => source === "codex" || source === "claude-code"
      ),
      sessions: project.sessions,
      turns: project.events,
      corrections: project.corrections,
      toolFailures: project.toolFailures,
      hedges: 0,
      alignment: project.contextScore ?? 80,
      topics: ["tokens", "tools", "realtime"],
      hasAgentsMd: false,
      hasClaudeMd: false,
      skillCount: 0,
    })),
    contextHealth: {
      score: Math.max(
        0,
        Math.round(
          snapshot.rings.find((ring) => ring.key === "alignment")?.score ?? 0
        )
      ),
      status: "clear",
      overloadedProjects: 0,
      riskCount: snapshot.insights.filter(
        (insight) => insight.severity === "warning"
      ).length,
      chars: 0,
      memoryFiles: 0,
      skillCount: snapshot.configArtifacts.length,
      suggestions: snapshot.insights
        .slice(0, 3)
        .map((insight) => insight.recommendation ?? insight.explanation)
        .filter((suggestion) => suggestion.length > 0),
    },
    provenance: {
      mode: "real",
      generator: "local-ingest",
      usedSampleData: false,
      sources: ["codex", "claude-code"],
      generatedAt: snapshot.generatedAt,
      cli: {
        invoked: false,
        status: "not-required",
      },
    },
  };
}

export function initDeviceSyncServer(): void {
  if (devSyncServer) return;
  devSyncServer = http.createServer((request, response) => {
    void handleDevSyncRequest(request, response);
  });
  devSyncServer.listen(DEV_SYNC_PORT, "127.0.0.1", () => {
    console.log(
      `[device-sync] dev pairing endpoint listening on http://127.0.0.1:${DEV_SYNC_PORT}`
    );
  });
  devSyncServer.on("error", (err) => {
    console.warn("[device-sync] dev pairing endpoint unavailable", err);
  });
}

export function shutdownDeviceSyncServer(): Promise<void> {
  const server = devSyncServer;
  devSyncServer = null;
  if (!server) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}

export function getDeviceSyncUrl(): string {
  return signalingBaseUrl();
}

export async function createCloudSyncPairing(input: {
  deviceId?: string;
  deviceName?: string;
  kind?: CloudSyncDeviceKind;
}): Promise<CloudSyncPairing> {
  const config = getConfig().cloudSync;
  const now = Date.now();
  const deviceId = input.deviceId ?? randomUUID();
  const kind = input.kind ?? "iphone";
  const deviceName =
    input.deviceName?.trim() ||
    (kind === "watch" ? "Apple Watch" : kind === "ipad" ? "iPad" : "iPhone");
  const pairingId = randomUUID();
  const secret = generateSecret();
  const expiresAt = now + PAIRING_TTL_MS;
  const secretHash = await sha256Base64Url(secret);
  const device: CloudSyncDevice = {
    deviceId,
    deviceName,
    kind,
    status: "pending",
    secretHash,
    createdAt: now,
    secretIssuedAt: now,
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
    companionSyncInterest: true,
  });

  const url = encodePairingLink({
    version: RTC_PROTOCOL_VERSION,
    signalUrl: signalingBaseUrl(),
    cloudUserId: config.cloudUserId,
    pairingId,
    deviceName,
    expiresAt,
    pairingSecret: secret,
    backupEnabled: config.backupEnabled,
    backupEpochId: config.backupEnabled ? config.backupEpochId : undefined,
    backupKey: config.backupEnabled ? config.backupKey : undefined,
  });
  const QRCode = await import("qrcode");
  const qrDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 360,
  });

  registerPeerPairingSession({
    pairingId,
    secret,
    expiresAt,
    device,
  });

  return {
    pairingId,
    pairingUrl: url,
    cloudApiBaseUrl: signalingBaseUrl(),
    secret,
    backupEnabled: config.backupEnabled,
    qrDataUrl,
    expiresAt,
    device,
  };
}

function writeJson(
  response: http.ServerResponse,
  status: number,
  body: unknown
): void {
  response.writeHead(status, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

async function handleDevSyncRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse
): Promise<void> {
  if (request.method === "OPTIONS") {
    writeJson(response, 204, {});
    return;
  }

  const url = new URL(request.url ?? "/", `http://127.0.0.1:${DEV_SYNC_PORT}`);
  if (request.method === "GET" && url.pathname === "/health") {
    writeJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/dev/snapshot") {
    const config = getConfig().cloudSync;
    const reports = getReports().map((report) =>
      sanitizeReportForCloud(report)
    );
    const telemetry = await getTelemetrySnapshot().catch(() => null);
    const telemetryReport =
      telemetry && telemetryHasData(telemetry)
        ? sanitizeReportForCloud(reportFromTelemetrySnapshot(telemetry))
        : null;
    const latest = telemetryReport ?? reports[0] ?? null;
    const latestRecord =
      latest && typeof latest === "object"
        ? (latest as Record<string, unknown>)
        : {};
    writeJson(response, 200, {
      schemaVersion: 1,
      cloudUserId: config.cloudUserId,
      desktopDeviceId: config.deviceId,
      desktopDeviceName: config.deviceName,
      revision:
        typeof latestRecord.timestamp === "number"
          ? latestRecord.timestamp
          : Date.now(),
      report: latest,
      reportCount: reports.length,
    });
    return;
  }

  if (request.method !== "GET" || url.pathname !== "/v1/dev/pair") {
    writeJson(response, 404, { error: "not_found" });
    return;
  }

  try {
    const kindParam = url.searchParams.get("kind");
    const kind: CloudSyncDeviceKind =
      kindParam === "watch" || kindParam === "ipad" ? kindParam : "iphone";
    const deviceName =
      url.searchParams.get("deviceName") ??
      (kind === "watch" ? "Dev Apple Watch" : "Dev iPhone Simulator");
    const pairing = await createCloudSyncPairing({ kind, deviceName });
    writeJson(response, 200, {
      pairingUrl: pairing.pairingUrl,
      cloudApiBaseUrl: pairing.cloudApiBaseUrl,
      expiresAt: pairing.expiresAt,
      device: pairing.device,
    });
  } catch (err) {
    writeJson(response, 500, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function removeCloudSyncDevice(
  deviceId: string
): Promise<CloudSyncDevice[]> {
  const config = getConfig().cloudSync;
  const devices = config.devices.filter(
    (device) => device.deviceId !== deviceId && device.status !== "revoked"
  );
  setConfig({ cloudSync: { devices } });
  return devices;
}
