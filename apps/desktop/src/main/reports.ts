import { makeReport, seedReports } from "../shared/mock";
import type { DreamReport } from "../shared/types";

/**
 * In-memory Dream Report history (newest first). Seeded with a few past
 * sessions; each completed dream prepends a fresh one so the session list
 * grows. Lives only for the app's lifetime in this mock build.
 */

type Listener = (reports: DreamReport[]) => void;

let reports: DreamReport[] = [];
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
  for (const listener of listeners) listener(reports);
}

export function initReports(): void {
  reports = normalized(seedReports(Date.now()));
}

export function getReports(): DreamReport[] {
  return normalized(reports);
}

export function getLatest(): DreamReport | null {
  return getReports()[0] ?? null;
}

/** Record a freshly-completed dream and notify listeners. */
export function addDream(): DreamReport {
  const now = Date.now();
  const report = makeReport(now, Math.floor(now / 997) % 1000, "unreviewed");
  reports = [
    report,
    ...reports.map((item) =>
      item.reviewStatus === "unreviewed"
        ? { ...item, reviewStatus: "expired" as const }
        : item
    ),
  ];
  publish();
  return report;
}

/** Explicit user review. Only the newest cycle is reviewable. */
export function markReportReviewed(id?: string): DreamReport | null {
  reports = normalized(reports);
  const latest = reports[0] ?? null;
  if (latest?.reviewStatus !== "unreviewed") return null;
  if (id && id !== latest.id) return null;

  const marked = {
    ...latest,
    reviewStatus: "reviewed" as const,
    reviewedAt: Date.now(),
  };
  reports = [marked, ...reports.slice(1)];
  publish();
  return marked;
}

export function onReportsChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
