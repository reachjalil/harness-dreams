import type { DreamReport } from "./types";

/**
 * Mock Dream Report.
 *
 * Stands in for the real Dream Engine until ingestion + analysis land. The
 * numbers and narratives are illustrative but shaped exactly like the real
 * artifact, and reference real project names so the experience reads true.
 */
export const MOCK_REPORT: DreamReport = {
  id: "dream_mock_001",
  timestamp: Date.now(),
  rangeLabel: "Last night · 14 sessions",
  sessions: 14,
  projects: 5,
  harness: "Claude Code",
  digest:
    "Solid day. Tokens-per-change dropped 12% vs your two-week median, mostly " +
    "in agent-fleet. One soft spot: re-ask rate ticked up on UI work — there's " +
    "an experiment below to test a fix.",
  rings: [
    {
      key: "efficiency",
      label: "Efficiency",
      score: 78,
      delta: +6,
      hint: "Tokens & cost per accepted change",
    },
    {
      key: "effectiveness",
      label: "Effectiveness",
      score: 64,
      delta: -3,
      hint: "Code delivered with less back-and-forth",
    },
    {
      key: "alignment",
      label: "Alignment",
      score: 83,
      delta: +2,
      hint: "Did what you wanted, fewer corrections",
    },
  ],
  metrics: [
    {
      key: "tokens_per_change",
      label: "Tokens / change",
      value: "4.2k",
      delta: -12,
      trend: "down",
      good: true,
    },
    {
      key: "cost",
      label: "Cost",
      value: "$3.18",
      delta: -8,
      trend: "down",
      good: true,
    },
    {
      key: "reask",
      label: "Re-ask rate",
      value: "18%",
      delta: +5,
      trend: "up",
      good: false,
    },
    {
      key: "cache",
      label: "Cache hits",
      value: "71%",
      delta: +4,
      trend: "up",
      good: true,
    },
    {
      key: "tool_success",
      label: "Tool success",
      value: "94%",
      delta: +1,
      trend: "flat",
      good: true,
    },
    {
      key: "sessions",
      label: "Sessions",
      value: "14",
      delta: +2,
      trend: "up",
      good: true,
    },
  ],
  findings: [
    {
      id: "f_verify_win",
      type: "win",
      title: "The verify skill correlates with fewer re-asks",
      body: "On the 6 sessions where you used the verify skill, re-ask rate was 18% lower than your average. Worth keeping as a habit.",
      confidence: "medium",
      project: "agent-fleet",
      evidence: "6 sessions · verify invoked before “done”",
      action: "Reinforce in memory",
    },
    {
      id: "f_reask_mistake",
      type: "mistake",
      title: "Re-asked to run tests 4× in agent-fleet",
      body: "The agent guessed the test command and got it wrong before you redirected it. A one-line AGENTS.md hint would likely remove this.",
      confidence: "high",
      project: "agent-fleet",
      evidence: "4 prompts · “actually run the tests”",
      action: "Add test-runner hint to AGENTS.md",
    },
    {
      id: "f_dup_opportunity",
      type: "opportunity",
      title: "CSV parser duplicated across two repos",
      body: "A near-identical CSV parser was written in both zod-to-sql and sql-export this week. Extracting a shared helper would save future effort.",
      confidence: "medium",
      project: "zod-to-sql · sql-export",
      evidence: "2 files · ~80% similar",
      action: "Open as experiment",
    },
    {
      id: "f_noagents_risk",
      type: "risk",
      title: "No AGENTS.md in waker — higher tool-failure rate",
      body: "waker has a 14% tool-failure rate, well above your average. It’s also the only active repo without an AGENTS.md to orient the agent.",
      confidence: "low",
      project: "waker",
      evidence: "14% tool failures · no AGENTS.md",
      action: "Draft a starter AGENTS.md",
    },
  ],
  experiments: [
    {
      id: "x_medium_ui",
      title: "Medium thinking effort for UI tasks",
      hypothesis:
        "Lower effort on UI work reduces cost without hurting quality.",
      metric: "re-ask rate · tokens/change",
      status: "proposed",
    },
    {
      id: "x_codex_refactor",
      title: "Prefer Codex for quick refactors",
      hypothesis: "Codex is faster for small mechanical edits.",
      metric: "latency · accept rate",
      status: "proposed",
    },
    {
      id: "x_plan_mode",
      title: "Plan mode for multi-file edits",
      hypothesis: "Planning first reduces wrong-file mistakes.",
      metric: "correction rate",
      status: "running",
      progress: 0.6,
      progressLabel: "3 / 5 sessions",
    },
  ],
};
