import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { app } from "electron";

import { reportsFromDreamLogs } from "../shared/dreamLogAnalysis";
import { makeReport, nextDemoReport, seedDemoReports } from "../shared/mock";
import type {
  ActionCategory,
  ActionQueueEntry,
  DreamReport,
  Experiment,
  Finding,
  ReviewDecisions,
  SyncedReviewDecision,
} from "../shared/types";
import { runSleepCycle } from "./cycleEngine";
import { applyAcceptedRecommendationsAsBranches } from "./recommendationBranches";
import { getConfig } from "./store";

/**
 * Persistent Dream Report history (newest first). Seeded from the real sample
 * dream log when no local history exists.
 */

type Listener = (reports: DreamReport[]) => void;

let reports: DreamReport[] = [];
let reportsPath = "";
const listeners = new Set<Listener>();
const REPORTS_FILE = "harness-dreams-reports.json";
const DEMO_REPORTS_FILE = "harness-dreams-demo-reports.json";

function normalized(items: DreamReport[]): DreamReport[] {
  return items.map((report, index) => {
    if (report.reviewStatus === "reviewed" || report.reviewedAt) {
      return { ...report, reviewStatus: "reviewed" as const };
    }
    if (index === 0 && report.reviewStatus !== "expired") {
      return { ...report, reviewStatus: "unreviewed" as const };
    }
    return { ...report, reviewStatus: "expired" as const };
  });
}

function publish(): void {
  reports = normalized(reports);
  persistReports();
  for (const listener of listeners) listener(reports);
}

function persistReports(): void {
  if (!reportsPath) return;
  try {
    mkdirSync(path.dirname(reportsPath), { recursive: true });
    const tmp = `${reportsPath}.tmp`;
    writeFileSync(tmp, JSON.stringify(reports, null, 2), "utf8");
    renameSync(tmp, reportsPath);
  } catch (err) {
    console.error("[reports] failed to persist reports", err);
  }
}

function readJsonFile(file: string): unknown | null {
  try {
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.error("[reports] failed to read", file, err);
    return null;
  }
}

function reportFileForCurrentMode(): string {
  return path.join(
    app.getPath("userData"),
    getConfig().demoMode ? DEMO_REPORTS_FILE : REPORTS_FILE,
  );
}

function sampleDreamLogPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "dream.dream_logs.example.json"),
    path.resolve(app.getAppPath(), "dream.dream_logs.example.json"),
    path.resolve(app.getAppPath(), "..", "dream.dream_logs.example.json"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function seedFromSample(): DreamReport[] {
  if (getConfig().demoMode) return seedDemoReports(Date.now());
  const config = getConfig();
  const local = runSleepCycle(config.projects ?? [], {
    privacyMode: config.privacyMode,
    analysisDepth: config.analysisDepth,
    remRunner: config.remRunner,
  });
  if (local) return [local];
  const samplePath = sampleDreamLogPath();
  const parsed = samplePath ? readJsonFile(samplePath) : null;
  const realReports = reportsFromDreamLogs(parsed);
  if (realReports.length > 0) return realReports;
  return [makeReport(Date.now(), Math.floor(Date.now() / 997) % 1000)];
}

export function initReports(): void {
  reportsPath = reportFileForCurrentMode();
  const persisted = readJsonFile(reportsPath);
  reports = normalized(
    Array.isArray(persisted) ? (persisted as DreamReport[]) : seedFromSample(),
  );
  persistReports();
}

export function resetReports(): DreamReport[] {
  reports = normalized(seedFromSample());
  publish();
  return reports;
}

export function syncReportsForConfig(): DreamReport[] {
  const nextPath = reportFileForCurrentMode();
  if (nextPath === reportsPath) return getReports();
  reportsPath = nextPath;
  const persisted = readJsonFile(reportsPath);
  reports = normalized(
    Array.isArray(persisted) ? (persisted as DreamReport[]) : seedFromSample(),
  );
  publish();
  return reports;
}

export function getReports(): DreamReport[] {
  return normalized(reports);
}

export function getLatest(): DreamReport | null {
  return getReports()[0] ?? null;
}

/**
 * Record a freshly-completed Sleep Cycle. The window starts at the previous
 * cycle's timestamp (capped at 24h inside the engine), so each run reviews only
 * what's new. Falls back to the sample/mock report only when no projects are
 * enabled.
 */
export function addDream(): DreamReport {
  const now = Date.now();
  const prev = reports[0] ?? null;
  if (getConfig().demoMode) {
    const fresh = nextDemoReport(now, prev);
    reports = [
      fresh,
      ...reports.map((item) =>
        item.reviewStatus === "unreviewed"
          ? { ...item, reviewStatus: "expired" as const }
          : item,
      ),
    ];
    publish();
    return fresh;
  }
  const samplePath = sampleDreamLogPath();
  const config = getConfig();
  const base =
    runSleepCycle(config.projects ?? [], {
      since: prev?.timestamp ?? null,
      now,
      prev,
      privacyMode: config.privacyMode,
      analysisDepth: config.analysisDepth,
      remRunner: config.remRunner,
    }) ??
    (samplePath
      ? reportsFromDreamLogs(readJsonFile(samplePath), now)[0]
      : null) ??
    makeReport(now, Math.floor(now / 997) % 1000, "unreviewed");
  const fresh = {
    ...base,
    id: `${base.id}_${now}`,
    timestamp: now,
    reviewStatus: "unreviewed" as const,
    reviewedAt: undefined,
  };
  reports = [
    fresh,
    ...reports.map((item) =>
      item.reviewStatus === "unreviewed"
        ? { ...item, reviewStatus: "expired" as const }
        : item,
    ),
  ];
  publish();
  return fresh;
}

function categoryForFinding(finding: Finding): ActionCategory {
  return (
    finding.category ??
    (finding.action.toLowerCase().includes("agent") ? "agentsmd" : "contextdoc")
  );
}

function experimentFromFinding(
  finding: Finding,
  report: DreamReport,
): Experiment {
  // Snapshot the target project now, so the next cycle can measure movement.
  const insight = report.projectInsights?.find(
    (project) => project.path === finding.projectPath,
  );
  return {
    id: `accepted_${finding.id}`,
    title: finding.action,
    hypothesis: finding.improvement,
    agentBenefit: finding.agentBenefit,
    userBenefit: finding.userBenefit,
    reflection: finding.reflection,
    metric: "alignment · re-ask rate · tool success",
    status: "running",
    progress: 0,
    progressLabel: "0 / 3 cycles measured",
    projectPath: finding.projectPath,
    category: finding.category,
    baseline: insight
      ? {
          alignment: insight.alignment,
          corrections: insight.corrections,
          contextScore: insight.contextHealth?.score,
        }
      : undefined,
  };
}

function applyAcceptedExperiments(
  report: DreamReport,
  entries: ActionQueueEntry[],
): Experiment[] {
  const acceptedIds = new Set(
    entries
      .filter((entry) => entry.state === "accepted")
      .map((entry) => entry.findingId),
  );
  const acceptedExperiments = report.findings
    .filter((finding) => acceptedIds.has(finding.id))
    .map((finding) => experimentFromFinding(finding, report));
  return [
    ...report.experiments.filter(
      (experiment) =>
        !acceptedExperiments.some((next) => next.id === experiment.id),
    ),
    ...acceptedExperiments,
  ];
}

function queueFromDecisions(
  report: DreamReport,
  decisions: ReviewDecisions = {},
): ActionQueueEntry[] {
  const entries: ActionQueueEntry[] = [];
  const decidedAt = Date.now();
  const { deviceId, deviceName } = getConfig().cloudSync;
  for (const finding of report.findings) {
    const state = decisions[finding.id];
    if (
      state === "accepted" ||
      state === "rejected" ||
      state === "queued" ||
      state === "snoozed"
    ) {
      entries.push({
        findingId: finding.id,
        category: categoryForFinding(finding),
        action: finding.action,
        project: finding.project,
        state,
        decidedAt,
        sourceDeviceId: deviceId || undefined,
        sourceDeviceName: deviceName || undefined,
        projectPath: finding.projectPath,
        patch: finding.patch,
      });
    }
  }
  return entries;
}

/**
 * Apply the user's accepted recommendations as reviewable repo branches. Each
 * affected git repo gets a persistent worktree, a feature branch, a commit, and
 * a PR creation URL when the branch can be pushed to a GitHub origin.
 */
function applyApprovedGuidance(
  entries: ActionQueueEntry[],
): ActionQueueEntry[] {
  const accepted = entries.filter(
    (entry) => entry.state === "accepted" && !entry.reviewBranch,
  );
  if (accepted.length === 0) return entries;
  if (getConfig().demoMode) {
    return entries.map((entry, index) => {
      if (entry.state !== "accepted" || entry.reviewBranch) return entry;
      const slug = entry.project.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const branch = `demo/harness-dreams-${slug}`;
      return {
        ...entry,
        reviewBranch: {
          branch,
          baseBranch: "main",
          worktreePath: path.join(
            app.getPath("userData"),
            "demo-recommendation-worktrees",
            slug,
          ),
          commit: `demo${index + 31}ab`,
          remote: "origin",
          prUrl: `https://github.com/demo-org/${slug}/compare/main...${branch}?expand=1`,
          pushed: true,
        },
      };
    });
  }
  const branchResults = applyAcceptedRecommendationsAsBranches(
    accepted,
    path.join(app.getPath("userData"), "recommendation-worktrees"),
  );
  return entries.map((entry) =>
    entry.state === "accepted" && branchResults.has(entry.findingId)
      ? { ...entry, reviewBranch: branchResults.get(entry.findingId) }
      : entry,
  );
}

/** Explicit user review. Only the newest cycle is reviewable. */
export function markReportReviewed(
  id?: string,
  decisions: ReviewDecisions = {},
): DreamReport | null {
  reports = normalized(reports);
  const latest = reports[0] ?? null;
  if (latest?.reviewStatus !== "unreviewed") return null;
  if (id && id !== latest.id) return null;

  const reviewDecisions = queueFromDecisions(latest, decisions);
  const appliedReviewDecisions = applyApprovedGuidance(reviewDecisions);
  const marked = {
    ...latest,
    reviewStatus: "reviewed" as const,
    reviewedAt: Date.now(),
    reviewDecisions: appliedReviewDecisions,
    experiments: applyAcceptedExperiments(latest, appliedReviewDecisions),
  };
  reports = [marked, ...reports.slice(1)];
  publish();
  return marked;
}

function decisionTime(report: DreamReport, entry: ActionQueueEntry): number {
  return entry.decidedAt ?? report.reviewedAt ?? report.timestamp;
}

function decisionEntryForFinding(
  finding: Finding,
  remote: SyncedReviewDecision,
  existing?: ActionQueueEntry,
): ActionQueueEntry {
  return {
    ...(existing ?? {}),
    findingId: finding.id,
    category: existing?.category ?? categoryForFinding(finding),
    action: existing?.action ?? finding.action,
    project: existing?.project ?? finding.project,
    state: remote.state,
    decidedAt: remote.updatedAt,
    sourceDeviceId: remote.sourceDeviceId,
    sourceDeviceName: remote.sourceDeviceName,
    projectPath: existing?.projectPath ?? finding.projectPath,
    patch: existing?.patch ?? finding.patch,
  };
}

function orderedDecisionEntries(
  report: DreamReport,
  byFinding: Map<string, ActionQueueEntry>,
): ActionQueueEntry[] {
  const ordered = report.findings
    .map((finding) => byFinding.get(finding.id))
    .filter((entry): entry is ActionQueueEntry => Boolean(entry));
  const known = new Set(ordered.map((entry) => entry.findingId));
  const orphaned = [...byFinding.values()].filter(
    (entry) => !known.has(entry.findingId),
  );
  return [...ordered, ...orphaned];
}

/**
 * Merge choices written by mobile/watch clients. Conflict policy is simple:
 * newest per finding wins. Accepted remote choices run through the same desktop
 * branch application path as local accepted choices.
 */
export function mergeRemoteReviewDecisions(incoming: SyncedReviewDecision[]): {
  applied: number;
  reports: DreamReport[];
} {
  if (incoming.length === 0) return { applied: 0, reports: getReports() };

  const byReport = new Map<string, SyncedReviewDecision[]>();
  for (const decision of incoming) {
    const current = byReport.get(decision.reportId) ?? [];
    current.push(decision);
    byReport.set(decision.reportId, current);
  }

  let applied = 0;
  let changed = false;
  reports = normalized(reports).map((report) => {
    const decisions = byReport.get(report.id);
    if (!decisions) return report;

    const current = new Map<string, ActionQueueEntry>(
      (report.reviewDecisions ?? []).map((entry) => [entry.findingId, entry]),
    );
    let reportChanged = false;
    let reviewedAt = report.reviewedAt ?? 0;

    for (const remote of decisions) {
      const finding = report.findings.find(
        (candidate) => candidate.id === remote.findingId,
      );
      if (!finding) continue;

      const existing = current.get(remote.findingId);
      const localTime = existing ? decisionTime(report, existing) : 0;
      if (existing && remote.updatedAt < localTime) continue;
      if (
        existing &&
        remote.updatedAt === localTime &&
        existing.state === remote.state
      ) {
        continue;
      }

      current.set(
        remote.findingId,
        decisionEntryForFinding(finding, remote, existing),
      );
      reviewedAt = Math.max(reviewedAt, remote.updatedAt);
      reportChanged = true;
      applied += 1;
    }

    if (!reportChanged) return report;

    changed = true;
    const reviewDecisions = applyApprovedGuidance(
      orderedDecisionEntries(report, current),
    );
    return {
      ...report,
      reviewStatus: "reviewed" as const,
      reviewedAt: reviewedAt || Date.now(),
      reviewDecisions,
      experiments: applyAcceptedExperiments(report, reviewDecisions),
    };
  });

  if (changed) publish();
  return { applied, reports: getReports() };
}

export function onReportsChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
