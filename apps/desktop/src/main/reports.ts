import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { app } from "electron";

import { nextDemoReport, seedDemoReports } from "../shared/mock";
import type {
  ActionCategory,
  ActionQueueEntry,
  HealthReviewKind,
  HealthReport,
  Experiment,
  Finding,
  GoalDisposition,
  ReviewDecisions,
  SyncedReviewDecision,
} from "../shared/types";
import { runHealthReview } from "./healthReviewEngine";
import {
  applyAcceptedRecommendationsAsBranches,
  applyAcceptedRecommendationsDirectly,
} from "./recommendationBranches";
import { getConfig } from "./store";

/**
 * Persistent Health Report history (newest first). Real mode starts empty when
 * no local history exists; demo mode uses its own fixture-backed history file.
 */

type Listener = (reports: HealthReport[]) => void;

let reports: HealthReport[] = [];
let reportsPath = "";
const listeners = new Set<Listener>();
const REPORTS_FILE = "harness-health-reports.json";
const DEMO_REPORTS_FILE = "harness-health-demo-reports.json";

function normalized(items: HealthReport[]): HealthReport[] {
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
    getConfig().demoMode ? DEMO_REPORTS_FILE : REPORTS_FILE
  );
}

function seedFromSample(): HealthReport[] {
  if (getConfig().demoMode) return seedDemoReports(Date.now());
  return [];
}

export function initReports(): void {
  reportsPath = reportFileForCurrentMode();
  const persisted = readJsonFile(reportsPath);
  reports = normalized(
    Array.isArray(persisted) ? (persisted as HealthReport[]) : seedFromSample()
  );
  persistReports();
}

export function resetReports(): HealthReport[] {
  reports = normalized(seedFromSample());
  publish();
  return reports;
}

export function syncReportsForConfig(): HealthReport[] {
  const nextPath = reportFileForCurrentMode();
  if (nextPath === reportsPath) return getReports();
  reportsPath = nextPath;
  const persisted = readJsonFile(reportsPath);
  reports = normalized(
    Array.isArray(persisted) ? (persisted as HealthReport[]) : seedFromSample()
  );
  publish();
  return reports;
}

export function getReports(): HealthReport[] {
  return normalized(reports);
}

export function getLatest(): HealthReport | null {
  return getReports()[0] ?? null;
}

/**
 * Record a freshly-completed Health Review. In real mode this always delegates to
 * the real engine and never falls back to sample/mock report generation.
 */
export function addHealthReview(kind: HealthReviewKind = "full"): HealthReport {
  const now = Date.now();
  const prev = reports[0] ?? null;
  if (getConfig().demoMode) {
    const fresh = nextDemoReport(now, prev, kind);
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
  const config = getConfig();
  const base = runHealthReview(config.projects ?? [], {
    since: prev?.timestamp ?? null,
    now,
    prev,
    privacyMode: config.privacyMode,
    analysisDepth: config.analysisDepth,
    insightRunner: config.insightRunner,
    kind,
  });
  const fresh = {
    ...base,
    id: `${base.id}_${now}`,
    timestamp: now,
    kind,
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

function categoryLabel(category: ActionCategory | undefined): string {
  if (category === "agentsmd") return "project guidance";
  if (category === "claudemd") return "Claude guidance";
  if (category === "contextdoc") return "project context";
  if (category === "skill") return "skill";
  if (category === "prompthabit") return "prompt habit";
  return "guidance";
}

function goalTitleFromFinding(finding: Finding): string {
  if (finding.patch) {
    return `Measure ${finding.project} after ${categoryLabel(finding.category)} update`;
  }
  return finding.title;
}

function experimentFromFinding(
  finding: Finding,
  report: HealthReport
): Experiment {
  // Snapshot the target project now, so the next review can measure movement.
  const insight = report.projectInsights?.find(
    (project) => project.path === finding.projectPath
  );
  return {
    id: `accepted_${finding.id}`,
    title: goalTitleFromFinding(finding),
    hypothesis: finding.patch
      ? `Check whether this config update improves the next sessions: ${finding.userBenefit}`
      : finding.improvement,
    agentBenefit: finding.agentBenefit,
    userBenefit: finding.userBenefit,
    reflection: finding.reflection,
    metric: "alignment · re-ask rate · tool success",
    status: "running",
    progress: 0,
    progressLabel: "0 / 3 reviews measured",
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
  report: HealthReport,
  entries: ActionQueueEntry[]
): Experiment[] {
  const acceptedIds = new Set(
    entries
      .filter((entry) => entry.state === "accepted")
      .map((entry) => entry.findingId)
  );
  const acceptedExperiments = report.findings
    .filter((finding) => acceptedIds.has(finding.id))
    .map((finding) => {
      const next = experimentFromFinding(finding, report);
      const existing = report.experiments.find(
        (experiment) => experiment.id === next.id
      );
      return existing?.disposition
        ? { ...next, disposition: existing.disposition }
        : next;
    });
  return [
    ...report.experiments.filter(
      (experiment) =>
        !acceptedExperiments.some((next) => next.id === experiment.id)
    ),
    ...acceptedExperiments,
  ];
}

export function revertConfigUpdate(
  reportId: string,
  findingId: string
): HealthReport | null {
  let changed = false;
  reports = reports.map((report) => {
    if (report.id !== reportId) return report;
    return {
      ...report,
      reviewDecisions: report.reviewDecisions?.map((entry) => {
        if (entry.findingId !== findingId) return entry;
        const applied = entry.reviewBranch;
        if (
          applied?.mode !== "direct" ||
          applied.revertedAt ||
          !applied.previousFiles?.length
        ) {
          return entry;
        }
        try {
          for (const previous of applied.previousFiles) {
            if (previous.existed) {
              mkdirSync(path.dirname(previous.file), { recursive: true });
              writeFileSync(previous.file, previous.content ?? "", "utf8");
            } else if (existsSync(previous.file)) {
              rmSync(previous.file, { force: true });
            }
          }
          changed = true;
          return {
            ...entry,
            reviewBranch: {
              ...applied,
              appliedDirectly: false,
              revertedAt: Date.now(),
              error: undefined,
            },
          };
        } catch (err) {
          changed = true;
          return {
            ...entry,
            reviewBranch: {
              ...applied,
              error:
                err instanceof Error
                  ? err.message
                  : "failed to revert config update",
            },
          };
        }
      }),
    };
  });
  if (changed) publish();
  return getReports().find((report) => report.id === reportId) ?? null;
}

export function setGoalDisposition(
  reportId: string,
  experimentId: string,
  disposition: GoalDisposition | null
): HealthReport | null {
  const target = reports.find((report) => report.id === reportId);
  if (!target) return null;

  let changed = false;
  reports = reports.map((report) => {
    if (report.id !== reportId) return report;
    return {
      ...report,
      experiments: report.experiments.map((experiment) => {
        if (experiment.id !== experimentId) return experiment;
        changed = true;
        if (disposition === null) {
          const next = { ...experiment };
          delete next.disposition;
          return next;
        }
        return { ...experiment, disposition };
      }),
    };
  });

  if (changed) publish();
  return getReports().find((report) => report.id === reportId) ?? null;
}

function queueFromDecisions(
  report: HealthReport,
  decisions: ReviewDecisions = {}
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
 * Apply the user's accepted recommendations. Branch mode gives git repos a
 * reviewable branch and PR URL; direct mode writes the managed guidance block
 * into the target file. Non-git projects always use direct file edits.
 */
function applyApprovedGuidance(
  entries: ActionQueueEntry[]
): ActionQueueEntry[] {
  const accepted = entries.filter(
    (entry) => entry.state === "accepted" && !entry.reviewBranch
  );
  if (accepted.length === 0) return entries;
  if (getConfig().demoMode) {
    return entries.map((entry, index) => {
      if (entry.state !== "accepted" || entry.reviewBranch) return entry;
      const slug = entry.project.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const branch = `demo/harness-health-${slug}`;
      return {
        ...entry,
        reviewBranch: {
          branch,
          baseBranch: "main",
          worktreePath: path.join(
            app.getPath("userData"),
            "demo-recommendation-worktrees",
            slug
          ),
          commit: `demo${index + 31}ab`,
          remote: "origin",
          prUrl: `https://github.com/demo-org/${slug}/compare/main...${branch}?expand=1`,
          pushed: true,
        },
      };
    });
  }
  const branchResults =
    getConfig().guidanceApplyMode === "direct"
      ? applyAcceptedRecommendationsDirectly(accepted)
      : applyAcceptedRecommendationsAsBranches(
          accepted,
          path.join(app.getPath("userData"), "recommendation-worktrees")
        );
  return entries.map((entry) =>
    entry.state === "accepted" && branchResults.has(entry.findingId)
      ? { ...entry, reviewBranch: branchResults.get(entry.findingId) }
      : entry
  );
}

/** Explicit user review. Only the newest review is reviewable. */
export function markReportReviewed(
  id?: string,
  decisions: ReviewDecisions = {}
): HealthReport | null {
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

function decisionTime(report: HealthReport, entry: ActionQueueEntry): number {
  return entry.decidedAt ?? report.reviewedAt ?? report.timestamp;
}

function decisionEntryForFinding(
  finding: Finding,
  remote: SyncedReviewDecision,
  existing?: ActionQueueEntry
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
  report: HealthReport,
  byFinding: Map<string, ActionQueueEntry>
): ActionQueueEntry[] {
  const ordered = report.findings
    .map((finding) => byFinding.get(finding.id))
    .filter((entry): entry is ActionQueueEntry => Boolean(entry));
  const known = new Set(ordered.map((entry) => entry.findingId));
  const orphaned = [...byFinding.values()].filter(
    (entry) => !known.has(entry.findingId)
  );
  return [...ordered, ...orphaned];
}

/**
 * Merge choices written by mobile/watch clients. Conflict policy is simple:
 * newest per finding wins. Accepted remote choices run through the same desktop
 * guidance-apply path as local accepted choices.
 */
export function mergeRemoteReviewDecisions(incoming: SyncedReviewDecision[]): {
  applied: number;
  reports: HealthReport[];
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
      (report.reviewDecisions ?? []).map((entry) => [entry.findingId, entry])
    );
    let reportChanged = false;
    let reviewedAt = report.reviewedAt ?? 0;

    for (const remote of decisions) {
      const finding = report.findings.find(
        (candidate) => candidate.id === remote.findingId
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
        decisionEntryForFinding(finding, remote, existing)
      );
      reviewedAt = Math.max(reviewedAt, remote.updatedAt);
      reportChanged = true;
      applied += 1;
    }

    if (!reportChanged) return report;

    changed = true;
    const reviewDecisions = applyApprovedGuidance(
      orderedDecisionEntries(report, current)
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
