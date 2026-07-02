import * as Crypto from "expo-crypto";
import type { PeerSyncMessageV1 } from "@harness-health/core";
import type {
  Finding,
  FindingType,
  Metric,
  Report,
  Snapshot,
} from "../domain/types";

export function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeFinding(value: unknown): Finding {
  const record = recordValue(value);
  return {
    id: stringValue(record.id, Crypto.randomUUID()),
    type: ["win", "mistake", "opportunity", "risk"].includes(
      stringValue(record.type)
    )
      ? (record.type as FindingType)
      : "opportunity",
    title: stringValue(record.title, "Harness Health finding"),
    summary: stringValue(record.summary, stringValue(record.body)),
    action: stringValue(record.action, "Review this finding on the Mac."),
    confidence: stringValue(record.confidence, "medium"),
    project: stringValue(record.project, "Harness Health"),
  };
}

export function normalizeReport(value: unknown): Report | null {
  const record = recordValue(value);
  const id = stringValue(record.id);
  if (!id) return null;
  const windowRecord = recordValue(record.window);
  const contextHealth = recordValue(record.contextHealth);
  return {
    id,
    timestamp: numberValue(record.timestamp, Date.now()),
    rangeLabel: stringValue(record.rangeLabel, "Latest review"),
    sessions: numberValue(record.sessions),
    projects: numberValue(record.projects),
    harness: stringValue(record.harness, "Private WebRTC"),
    digest: stringValue(record.digest, stringValue(record.summary)),
    rings: Array.isArray(record.rings) ? (record.rings as Report["rings"]) : [],
    metrics: Array.isArray(record.metrics) ? (record.metrics as Metric[]) : [],
    findings: Array.isArray(record.findings)
      ? record.findings.map(normalizeFinding)
      : [],
    experiments: Array.isArray(record.experiments)
      ? (record.experiments as Report["experiments"])
      : [],
    reviewStatus: ["unreviewed", "reviewed", "expired"].includes(
      stringValue(record.reviewStatus)
    )
      ? (record.reviewStatus as Report["reviewStatus"])
      : undefined,
    window: record.window
      ? {
          label: stringValue(windowRecord.label, "Latest Mac review"),
          sessionsInWindow: numberValue(windowRecord.sessionsInWindow),
          turnsInWindow: numberValue(windowRecord.turnsInWindow),
          basis:
            windowRecord.basis === "since-last-review"
              ? "since-last-review"
              : "last-24h",
        }
      : undefined,
    contextHealth: record.contextHealth
      ? {
          score: numberValue(contextHealth.score),
          status:
            contextHealth.status === "watch" ||
            contextHealth.status === "overloaded"
              ? contextHealth.status
              : "clear",
          overloadedProjects: numberValue(contextHealth.overloadedProjects),
          riskCount: Array.isArray(contextHealth.risks)
            ? contextHealth.risks.length
            : numberValue(contextHealth.riskCount),
          chars: numberValue(
            contextHealth.totalChars,
            numberValue(contextHealth.chars)
          ),
          memoryFiles: numberValue(contextHealth.memoryFiles),
          skillCount: numberValue(contextHealth.skillCount),
          suggestions: Array.isArray(contextHealth.suggestions)
            ? (contextHealth.suggestions as string[])
            : [],
        }
      : undefined,
    projectInsights: Array.isArray(record.projectInsights)
      ? (record.projectInsights as Report["projectInsights"])
      : [],
  };
}

export function snapshotFromPeerMessage(
  pairing: { cloudUserId: string; deviceId: string },
  message: Extract<PeerSyncMessageV1, { type: "report.snapshot" }>
): Snapshot {
  const reports = message.payload.reports;
  const report = reports.length > 0 ? normalizeReport(reports[0]) : null;
  return {
    userId: pairing.cloudUserId,
    desktopDeviceId: message.payload.desktopDeviceId,
    desktopDeviceName: message.payload.desktopDeviceName,
    deviceId: pairing.deviceId,
    revision: message.payload.revision,
    report,
  };
}
