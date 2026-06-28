import { beforeEach, describe, expect, test, vi } from "vitest";

import type { AnalysisProject } from "../shared/types";
import type { LocalSession } from "./localIngest";

vi.mock("./localIngest", () => ({
  ingestSelectedSessions: vi.fn(),
}));

vi.mock("./remAnalysis", () => ({
  runRemAnalysis: vi.fn(),
}));

const { ingestSelectedSessions } = await import("./localIngest");
const { runRemAnalysis } = await import("./remAnalysis");
const { runSleepCycle } = await import("./cycleEngine");

const mockIngest = vi.mocked(ingestSelectedSessions);
const mockRem = vi.mocked(runRemAnalysis);

const now = 1_790_000_000_000;
const project: AnalysisProject = {
  path: "/tmp/harness-dreams-real-project",
  name: "real-project",
  sources: ["codex"],
  enabled: true,
  addedAt: now - 10_000,
};

function session(): LocalSession {
  return {
    id: "codex:real-project:session-1",
    source: "codex",
    projectPath: project.path,
    projectName: project.name,
    startedAt: now - 5_000,
    endedAt: now - 1_000,
    rawPath: "/tmp/codex-session.jsonl",
    turns: [
      {
        kind: "user",
        content: "Please make the CLI run real data.",
        timestamp: now - 5_000,
        hasToolCall: false,
        toolError: false,
      },
      {
        kind: "assistant",
        content: "I will inspect the real ingestion path.",
        timestamp: now - 1_000,
        hasToolCall: true,
        toolError: false,
      },
    ],
  };
}

function expectFrictionMatchesFindings(
  report: ReturnType<typeof runSleepCycle>
): void {
  const findingIds = new Set(report.findings.map((finding) => finding.id));
  const friction = report.alignment?.friction ?? [];
  expect(friction).toHaveLength(
    report.findings.filter((finding) => Boolean(finding.frictionType)).length
  );
  for (const point of friction) {
    expect(findingIds.has(point.findingId)).toBe(true);
  }
}

describe("runSleepCycle provenance", () => {
  beforeEach(() => {
    mockIngest.mockReset();
    mockRem.mockReset();
  });

  test("does not fabricate sample data when no projects are enabled", () => {
    const report = runSleepCycle([], { now });

    expect(report.sessions).toBe(0);
    expect(report.projects).toBe(0);
    expect(report.provenance).toMatchObject({
      mode: "real",
      generator: "no-data",
      usedSampleData: false,
      cli: { invoked: false, status: "not-required" },
    });
    expect(report.findings).toHaveLength(0);
    expect(report.alignment?.friction).toHaveLength(0);
    expectFrictionMatchesFindings(report);
    expect(report.digest).toContain("without demo data or sample fixtures");
    expect(mockIngest).not.toHaveBeenCalled();
  });

  test("returns a real quiet report when projects exist but no sessions match", () => {
    mockIngest.mockReturnValue([]);

    const report = runSleepCycle([project], { now, privacyMode: "local" });

    expect(report.sessions).toBe(0);
    expect(report.projects).toBe(1);
    expect(report.provenance).toMatchObject({
      mode: "real",
      generator: "local-ingest",
      usedSampleData: false,
      sources: ["codex"],
      cli: { invoked: false, status: "not-required" },
    });
    expect(report.findings).toHaveLength(0);
    expect(report.alignment?.friction).toHaveLength(0);
    expectFrictionMatchesFindings(report);
    expect(mockIngest).toHaveBeenCalledOnce();
  });

  test("records the real CLI execution when cloud REM is enabled", () => {
    mockIngest.mockReturnValue([session()]);
    mockRem.mockReturnValue({
      findings: [],
      redactionPreview: {
        runner: "codex:/usr/local/bin/codex",
        model: "test-model",
        redactions: 0,
        payloadChars: 1234,
        projects: 1,
      },
    });

    const report = runSleepCycle([project], {
      now,
      privacyMode: "cloud",
      analysisDepth: "standard",
      remRunner: {
        provider: "codex",
        model: "test-model",
        claudePath: "claude",
        codexPath: "codex",
        timeoutMs: 5_000,
      },
    });

    expect(mockRem).toHaveBeenCalledOnce();
    expect(report.sessions).toBe(1);
    expect(report.provenance).toMatchObject({
      mode: "real",
      generator: "local-ingest",
      usedSampleData: false,
      sources: ["codex"],
      cli: {
        invoked: true,
        status: "executed",
        runner: "codex:/usr/local/bin/codex",
        model: "test-model",
        payloadChars: 1234,
        projects: 1,
      },
    });
    expectFrictionMatchesFindings(report);
  });
});
