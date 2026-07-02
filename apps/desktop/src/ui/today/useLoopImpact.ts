import { useMemo } from "react";

import type {
  ActionQueueEntry,
  Experiment,
  HealthReport,
} from "../../shared/types";

export interface LoopExperiment {
  experiment: Experiment;
  reportId: string;
  timestamp: number;
  alignmentDelta: number | null;
}

export interface LoopImpact {
  accepted: number;
  queued: number;
  applied: number;
  prLinks: number;
  applyErrors: number;
  concluded: number;
  helped: number;
  noChange: number;
  worse: number;
  averageDelta: number | null;
  bestDelta: number | null;
  guidanceCoverage: number | null;
  guidanceCovered: number;
  guidanceTotal: number;
  latestVerdict: LoopExperiment | null;
}

function parseAlignmentDelta(note?: string): number | null {
  if (!note) return null;
  const match = note.match(/\(([+-]?\d+)\)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function reviewedReports(reports: HealthReport[]): HealthReport[] {
  return reports.filter(
    (candidate) => candidate.reviewStatus === "reviewed" || candidate.reviewedAt
  );
}

function latestExperiments(reports: HealthReport[]): LoopExperiment[] {
  const byId = new Map<string, LoopExperiment>();
  for (const report of reviewedReports(reports)) {
    for (const experiment of report.experiments) {
      if (byId.has(experiment.id)) continue;
      byId.set(experiment.id, {
        experiment,
        reportId: report.id,
        timestamp: report.timestamp,
        alignmentDelta: parseAlignmentDelta(experiment.verdictNote),
      });
    }
  }
  return [...byId.values()];
}

function loopImpact(reports: HealthReport[], report: HealthReport): LoopImpact {
  const reviewed = reviewedReports(reports);
  const decisions: ActionQueueEntry[] = reviewed.flatMap(
    (candidate) => candidate.reviewDecisions ?? []
  );
  const accepted = decisions.filter((entry) => entry.state === "accepted");
  const queued = decisions.filter((entry) => entry.state === "queued");
  const experiments = latestExperiments(reports);
  const concluded = experiments.filter(
    ({ experiment }) => experiment.status === "concluded"
  );
  const deltas = concluded
    .map((item) => item.alignmentDelta)
    .filter((value): value is number => value != null);
  const guidanceTotal = report.projectInsights?.length ?? 0;
  const guidanceCovered =
    report.projectInsights?.filter(
      (project) => project.contextHealth?.status !== "overloaded"
    ).length ?? 0;

  return {
    accepted: accepted.length,
    queued: queued.length,
    applied: accepted.filter(
      (entry) =>
        entry.reviewBranch?.branch || entry.reviewBranch?.appliedDirectly
    ).length,
    prLinks: accepted.filter((entry) => entry.reviewBranch?.prUrl).length,
    applyErrors: accepted.filter((entry) => entry.reviewBranch?.error).length,
    concluded: concluded.length,
    helped: concluded.filter(
      ({ experiment }) => experiment.verdict === "helped"
    ).length,
    noChange: concluded.filter(
      ({ experiment }) => experiment.verdict === "no-change"
    ).length,
    worse: concluded.filter(({ experiment }) => experiment.verdict === "worse")
      .length,
    averageDelta:
      deltas.length === 0
        ? null
        : Math.round(
            deltas.reduce((sum, value) => sum + value, 0) / deltas.length
          ),
    bestDelta: deltas.length === 0 ? null : Math.max(...deltas),
    guidanceCoverage:
      guidanceTotal === 0
        ? null
        : Math.round((guidanceCovered / guidanceTotal) * 100),
    guidanceCovered,
    guidanceTotal,
    latestVerdict:
      concluded.sort((a, b) => b.timestamp - a.timestamp)[0] ?? null,
  };
}

function emptyLoopImpact(): LoopImpact {
  return {
    accepted: 0,
    queued: 0,
    applied: 0,
    prLinks: 0,
    applyErrors: 0,
    concluded: 0,
    helped: 0,
    noChange: 0,
    worse: 0,
    averageDelta: null,
    bestDelta: null,
    guidanceCoverage: null,
    guidanceCovered: 0,
    guidanceTotal: 0,
    latestVerdict: null,
  };
}

export function useLoopImpact(
  reports: HealthReport[],
  report: HealthReport | null
): LoopImpact {
  return useMemo(
    () => (report ? loopImpact(reports, report) : emptyLoopImpact()),
    [reports, report]
  );
}
