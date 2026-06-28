import { beforeEach, describe, expect, test, vi } from "vitest";

import type { AnalysisProject, Finding } from "../shared/types";
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

function sessionWithAttachmentMetadata(): LocalSession {
  return {
    ...session(),
    turns: [
      {
        kind: "user",
        content:
          "# Files mentioned by the user:\n\n## codex-clipboard-1a61ff3c-08f0-49d8-a51c-6a78d40ba962.png: /var/folders/tmp/codex-clipboard.png\n\n## My request for Codex:\nNo you went too simple, keep the dashboard experience and explain the findings.",
        timestamp: now - 5_000,
        hasToolCall: false,
        toolError: false,
      },
      {
        kind: "assistant",
        content: "I will revise the dashboard summary.",
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

  test("uses successful CLI output to build a real sleep report", () => {
    mockIngest.mockReturnValue([session()]);
    const cliFinding: Finding = {
      id: "rem-test-1",
      type: "mistake",
      title: "CLI finding",
      body: "Codex found a durable rule gap in the real session output.",
      improvement: "Run the real CLI before producing a Sleep Cycle report.",
      agentBenefit: "The agent waits for the configured runner output.",
      userBenefit: "The report is based on the actual analyzer result.",
      reflection: "Whether the next report remains CLI-derived.",
      confidence: "high",
      project: project.name,
      projectPath: project.path,
      evidence: "Please make the CLI run real data.",
      evidenceFile: "/tmp/codex-session.jsonl",
      action:
        "Add rule: Run the real CLI before producing a Sleep Cycle report.",
      category: "agentsmd",
      frictionType: "config-conflict",
    };
    mockRem.mockReturnValue({
      findings: [cliFinding],
      digest: "Codex CLI built this report from real session output.",
      scores: {
        alignment: 81,
        efficiency: 82,
        effectiveness: 83,
      },
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
      privacyMode: "local",
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
    expect(report.digest).toBe(
      "Codex CLI built this report from real session output."
    );
    expect(report.findings).toEqual([cliFinding]);
    expect(report.rings.find((ring) => ring.key === "alignment")?.score).toBe(
      81
    );
    expect(report.rings.find((ring) => ring.key === "efficiency")?.score).toBe(
      82
    );
    expect(
      report.rings.find((ring) => ring.key === "effectiveness")?.score
    ).toBe(83);
    expect(report.alignment?.friction).toHaveLength(1);
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

  test("summarizes alignment signals instead of showing attachment metadata", () => {
    mockIngest.mockReturnValue([sessionWithAttachmentMetadata()]);

    const report = runSleepCycle([project], {
      now,
      privacyMode: "local",
    });

    const signals = report.alignment?.human.signals.join(" ") ?? "";
    expect(signals).toContain("correction signals");
    expect(signals).not.toMatch(/Files mentioned by the user/i);
    expect(signals).not.toMatch(/codex-clipboard/i);
    expect(signals).not.toMatch(/\/var\/folders/i);
    expect(report.alignment?.human.question).not.toMatch(/codex-clipboard/i);
  });
});
