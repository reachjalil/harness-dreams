import { describe, expect, test } from "vitest";

import type { DreamReport } from "../shared/types";
import { sanitizeCloudText, sanitizeReportForCloud } from "./cloudRedaction";

function reportWithSensitiveFields(): DreamReport {
  return {
    id: "cycle-sensitive",
    timestamp: 1_782_655_100,
    rangeLabel: "Last night",
    sessions: 1,
    projects: 1,
    harness: "Codex",
    digest:
      "Summary references /Users/alice/work/private-repo and API_TOKEN=super-secret.",
    rings: [
      {
        key: "alignment",
        label: "Alignment",
        score: 88,
        delta: 2,
        hint: "Intent match",
      },
    ],
    metrics: [
      {
        key: "reask",
        label: "Re-ask rate",
        value: "14%",
        delta: -5,
        trend: "down",
        good: true,
      },
    ],
    findings: [
      {
        id: "finding-1",
        type: "mistake",
        title: "Repeated correction",
        body: "The user pasted ```ts\nconst secret = 'sk-abc12345678901234567890';\n```.",
        improvement: "Add a durable rule.",
        agentBenefit: "Avoids guessing.",
        userBenefit: "Less rework.",
        reflection: "Whether this repeats.",
        confidence: "high",
        project: "private-repo",
        evidence:
          "Use /Users/alice/work/private-repo/src/payments.ts and ghp_abcdefghijklmnopqrstuvwxyz123456.",
        evidenceFile: "/Users/alice/.codex/sessions/private.jsonl",
        projectPath: "/Users/alice/work/private-repo",
        configGap: "Path /Users/alice/work/private-repo leaked.",
        action: "Add rule without storing /Users/alice/work/private-repo.",
        category: "agentsmd",
        frictionType: "config-conflict",
        patch: {
          target: "agentsmd",
          file: "/Users/alice/work/private-repo/AGENTS.md",
          label: "AGENTS.md",
          snippet: "```ts\nconsole.log('secret')\n```",
          creates: false,
        },
      },
    ],
    experiments: [
      {
        id: "exp-1",
        title: "Measure /Users/alice/work/private-repo",
        hypothesis: "Sensitive path is redacted.",
        agentBenefit: "Clearer guidance.",
        userBenefit: "No leak.",
        reflection: "Check next cycle.",
        metric: "alignment",
        status: "running",
        progress: 0,
        progressLabel: "0 / 3 cycles",
        projectPath: "/Users/alice/work/private-repo",
      },
    ],
    reviewStatus: "reviewed",
    reviewedAt: 1_782_655_200,
    reviewDecisions: [
      {
        findingId: "finding-1",
        category: "agentsmd",
        action: "Apply /Users/alice/work/private-repo/AGENTS.md update",
        project: "private-repo",
        state: "accepted",
        projectPath: "/Users/alice/work/private-repo",
        patch: {
          target: "agentsmd",
          file: "/Users/alice/work/private-repo/AGENTS.md",
          label: "AGENTS.md",
          snippet: "secret",
          creates: false,
        },
        reviewBranch: {
          branch: "codex/harness-dreams-test",
          worktreePath: "/Users/alice/worktrees/private-repo",
          pushed: false,
        },
      },
    ],
    alignment: {
      score: 88,
      band: "collaborating",
      human: {
        mood: "frustrated",
        question: "Why did /Users/alice/work/private-repo leak?",
        signals: ["Fix /Users/alice/work/private-repo now"],
      },
      agent: {
        mood: "confident",
        question: "What should I do?",
        signals: ["0 tool errors"],
      },
      friction: [
        {
          type: "config-conflict",
          example: "Raw transcript quote with sk-abc12345678901234567890",
          findingId: "finding-1",
        },
      ],
    },
    window: {
      start: 1_782_568_700,
      end: 1_782_655_100,
      basis: "last-24h",
      label: "Last 24h",
      sessionsInWindow: 1,
      turnsInWindow: 8,
    },
    projectInsights: [
      {
        path: "/Users/alice/work/private-repo",
        name: "private-repo",
        turns: 8,
        sessions: 1,
        corrections: 1,
        toolFailures: 0,
        hedges: 0,
        alignment: 88,
        sources: ["claude-code"],
        topics: ["/Users/alice/work/private-repo"],
        hasAgentsMd: true,
        hasClaudeMd: false,
        hasRulesMd: false,
        skillCount: 0,
        contextHealth: {
          score: 70,
          status: "watch",
          totalChars: 100,
          projectChars: 80,
          globalChars: 20,
          memoryChars: 0,
          skillCount: 0,
          localSkillCount: 0,
          globalSkillCount: 0,
          hasRulesMd: false,
          memoryFiles: 0,
          sourceCount: 1,
          oversizedFiles: [
            {
              kind: "agentsmd",
              label: "/Users/alice/work/private-repo/AGENTS.md",
              path: "/Users/alice/work/private-repo/AGENTS.md",
              chars: 100,
              lines: 10,
            },
          ],
          risks: ["Path /Users/alice/work/private-repo risk"],
          suggestions: ["Move /Users/alice/work/private-repo details"],
        },
      },
    ],
    cloudRedactionPreview: {
      runner: "codex:/Users/alice/.local/bin/codex",
      model: "model",
      redactions: 1,
      payloadChars: 1000,
      projects: 1,
    },
  };
}

describe("sanitizeReportForCloud", () => {
  test("removes local paths, patch snippets, evidence files, transcript evidence, and secrets", () => {
    const sanitized = sanitizeReportForCloud(reportWithSensitiveFields());
    const json = JSON.stringify(sanitized);

    expect(json).not.toContain("/Users/alice");
    expect(json).not.toContain("private.jsonl");
    expect(json).not.toContain("payments.ts");
    expect(json).not.toContain("worktreePath");
    expect(json).not.toContain("snippet");
    expect(json).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz123456");
    expect(json).not.toContain("sk-abc12345678901234567890");
    expect(json).not.toContain("super-secret");
    expect(json).toContain("Evidence retained locally on desktop.");
    expect(json).toContain("[redacted path]");
    expect(json).toContain("[redacted secret]");
  });

  test("redacts standalone cloud document text fields", () => {
    expect(
      sanitizeCloudText(
        "Digest mentions /Users/alice/work/private-repo and API_TOKEN=super-secret."
      )
    ).toBe("Digest mentions [redacted path] and [redacted secret].");
  });
});
