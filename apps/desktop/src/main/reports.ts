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
import { makeReport } from "../shared/mock";
import type {
  ActionCategory,
  ActionQueueEntry,
  DreamReport,
  Experiment,
  Finding,
  ReviewDecisions,
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

function sampleDreamLogPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "dream.dream_logs.example.json"),
    path.resolve(app.getAppPath(), "dream.dream_logs.example.json"),
    path.resolve(app.getAppPath(), "..", "dream.dream_logs.example.json"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function seedFromSample(): DreamReport[] {
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
  reportsPath = path.join(
    app.getPath("userData"),
    "harness-dreams-reports.json"
  );
  const persisted = readJsonFile(reportsPath);
  reports = normalized(
    Array.isArray(persisted) ? (persisted as DreamReport[]) : seedFromSample()
  );
  persistReports();
}

export function resetReports(): DreamReport[] {
  reports = normalized(seedFromSample());
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
        : item
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
  report: DreamReport
): Experiment {
  // Snapshot the target project now, so the next cycle can measure movement.
  const insight = report.projectInsights?.find(
    (project) => project.path === finding.projectPath
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
      ? { alignment: insight.alignment, corrections: insight.corrections }
      : undefined,
  };
}

function queueFromDecisions(
  report: DreamReport,
  decisions: ReviewDecisions = {}
): ActionQueueEntry[] {
  const entries: ActionQueueEntry[] = [];
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
function applyApprovedGuidance(entries: ActionQueueEntry[]): ActionQueueEntry[] {
  const accepted = entries.filter((entry) => entry.state === "accepted");
  if (accepted.length === 0) return entries;
  const branchResults = applyAcceptedRecommendationsAsBranches(
    accepted,
    path.join(app.getPath("userData"), "recommendation-worktrees")
  );
  return entries.map((entry) =>
    entry.state === "accepted" && branchResults.has(entry.findingId)
      ? { ...entry, reviewBranch: branchResults.get(entry.findingId) }
      : entry
  );
}

/** Explicit user review. Only the newest cycle is reviewable. */
export function markReportReviewed(
  id?: string,
  decisions: ReviewDecisions = {}
): DreamReport | null {
  reports = normalized(reports);
  const latest = reports[0] ?? null;
  if (latest?.reviewStatus !== "unreviewed") return null;
  if (id && id !== latest.id) return null;

  const reviewDecisions = queueFromDecisions(latest, decisions);
  const acceptedIds = new Set(
    reviewDecisions
      .filter((entry) => entry.state === "accepted")
      .map((entry) => entry.findingId)
  );
  const acceptedExperiments = latest.findings
    .filter((finding) => acceptedIds.has(finding.id))
    .map((finding) => experimentFromFinding(finding, latest));
  const appliedReviewDecisions = applyApprovedGuidance(reviewDecisions);
  const marked = {
    ...latest,
    reviewStatus: "reviewed" as const,
    reviewedAt: Date.now(),
    reviewDecisions: appliedReviewDecisions,
    experiments: [
      ...latest.experiments.filter(
        (experiment) =>
          !acceptedExperiments.some((next) => next.id === experiment.id)
      ),
      ...acceptedExperiments,
    ],
  };
  reports = [marked, ...reports.slice(1)];
  publish();
  return marked;
}

export function onReportsChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
