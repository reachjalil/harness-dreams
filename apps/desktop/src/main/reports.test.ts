import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Finding, HealthReport } from "../shared/types";

let userData = "";

function mockElectron(): void {
  vi.doMock("electron", () => ({
    app: {
      getPath: (name: string) =>
        name === "logs" ? path.join(userData, "logs") : userData,
    },
  }));
}

function finding(id: string): Finding {
  return {
    id,
    type: "opportunity",
    title: `Finding ${id}`,
    body: "The review found a durable improvement.",
    improvement: "Add stable guidance.",
    agentBenefit: "Less rediscovery.",
    userBenefit: "Less repeated explanation.",
    reflection: "Check whether the next review improves.",
    confidence: "high",
    project: "Project A",
    evidence: "Local transcript evidence.",
    action: "Add rule: Use the real CLI before reporting status.",
    category: "agentsmd",
  };
}

function report(
  id: string,
  timestamp: number,
  findings: Finding[] = [finding("finding-1")]
): HealthReport {
  return {
    id,
    timestamp,
    rangeLabel: "Last 24h",
    sessions: 1,
    projects: 1,
    harness: "Codex",
    digest: "A compact review.",
    rings: [
      {
        key: "alignment",
        label: "Alignment",
        score: 84,
        delta: 2,
        hint: "Working well",
      },
    ],
    metrics: [],
    findings,
    experiments: [],
  };
}

async function loadStoreAndReports() {
  const store = await import("./store");
  store.initStore();
  const reports = await import("./reports");
  return { store, reports };
}

beforeEach(() => {
  userData = mkdtempSync(path.join(os.tmpdir(), "hd-reports-test-"));
  vi.resetModules();
  mockElectron();
});

afterEach(() => {
  vi.doUnmock("electron");
  rmSync(userData, { recursive: true, force: true });
});

describe("reports", () => {
  test("normalizes unreviewed reports and only reviews the newest report", async () => {
    const { reports } = await loadStoreAndReports();
    writeFileSync(
      path.join(userData, "harness-health-reports.json"),
      JSON.stringify([report("new", 300), report("old", 200)], null, 2),
      "utf8"
    );
    reports.initReports();

    expect(reports.getReports().map((item) => item.reviewStatus)).toEqual([
      "unreviewed",
      "expired",
    ]);
    expect(reports.markReportReviewed("old", { "finding-1": "accepted" })).toBe(
      null
    );

    const reviewed = reports.markReportReviewed("new", {
      "finding-1": "accepted",
    });
    expect(reviewed?.reviewStatus).toBe("reviewed");
    expect(reviewed?.reviewedAt).toBeGreaterThan(0);
    expect(reviewed?.reviewDecisions?.[0]).toMatchObject({
      findingId: "finding-1",
      state: "accepted",
    });
    expect(reviewed?.experiments.map((item) => item.id)).toContain(
      "accepted_finding-1"
    );
    expect(reports.getReports()[1]?.reviewStatus).toBe("expired");
  });

  test("syncs separate demo and real report histories when demo mode changes", async () => {
    const { store, reports } = await loadStoreAndReports();
    writeFileSync(
      path.join(userData, "harness-health-reports.json"),
      JSON.stringify([report("real", 100)], null, 2),
      "utf8"
    );
    reports.initReports();
    expect(reports.getReports()[0]?.id).toBe("real");

    store.setConfig({ demoMode: true });
    const demoReports = reports.syncReportsForConfig();
    expect(demoReports.length).toBeGreaterThan(0);
    expect(demoReports[0]?.provenance?.mode).toBe("demo");

    store.setConfig({ demoMode: false });
    const realReports = reports.syncReportsForConfig();
    expect(realReports[0]?.id).toBe("real");
  });

  test("merges remote review decisions with newest-wins conflict behavior", async () => {
    const { reports } = await loadStoreAndReports();
    writeFileSync(
      path.join(userData, "harness-health-reports.json"),
      JSON.stringify([report("remote-report", 100)], null, 2),
      "utf8"
    );
    reports.initReports();

    const first = reports.mergeRemoteReviewDecisions([
      {
        reportId: "remote-report",
        findingId: "finding-1",
        state: "accepted",
        updatedAt: 500,
        sourceDeviceId: "watch-1",
        sourceDeviceName: "Watch",
      },
    ]);
    expect(first.applied).toBe(1);
    expect(first.reports[0]?.reviewStatus).toBe("reviewed");
    expect(first.reports[0]?.reviewedAt).toBe(500);
    expect(first.reports[0]?.reviewDecisions?.[0]).toMatchObject({
      findingId: "finding-1",
      state: "accepted",
      sourceDeviceId: "watch-1",
    });
    expect(first.reports[0]?.experiments.map((item) => item.id)).toContain(
      "accepted_finding-1"
    );

    const stale = reports.mergeRemoteReviewDecisions([
      {
        reportId: "remote-report",
        findingId: "finding-1",
        state: "rejected",
        updatedAt: 400,
        sourceDeviceId: "phone-1",
      },
    ]);
    expect(stale.applied).toBe(0);
    expect(stale.reports[0]?.reviewDecisions?.[0]?.state).toBe("accepted");
  });
});
