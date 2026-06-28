import type {
  ActionQueueEntry,
  AlignmentBand,
  AlignmentDetail,
  CycleReviewStatus,
  DreamReport,
  Experiment,
  Finding,
  Metric,
  ProjectInsight,
  Ring,
} from "./types";

/**
 * Mock Dream Reports. Stands in for the real Dream Engine until ingestion +
 * analysis land. `seedReports` builds a believable history; `makeReport` mints
 * a fresh one each time a dream completes, so the session list grows.
 */

const DIGESTS = [
  "Solid day. Tokens-per-change dropped vs your two-week median, mostly in agent-fleet. One soft spot: re-ask rate ticked up on UI work.",
  "Quietly efficient. Cache hits climbed and you shipped more with fewer follow-ups. Codex handled the quick refactors well.",
  "Mixed bag. Strong alignment — almost no reverts — but token spend crept up on a couple of long debugging sessions.",
  "Good momentum. The verify skill kept regressions out, and your UI work needed less back-and-forth than usual.",
  "Heavy day across five repos. Effectiveness held steady; worth watching cost on the bigger feature work.",
];

/** Deterministic pseudo-random in [-1, 1] from a seed + salt. */
function noise(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function vary(
  base: number,
  seed: number,
  salt: number,
  spread: number
): number {
  return Math.round(base + noise(seed, salt) * spread);
}

function clampScore(n: number): number {
  return Math.max(40, Math.min(98, n));
}

function rings(seed: number): Ring[] {
  return [
    {
      key: "efficiency",
      label: "Efficiency",
      score: clampScore(vary(76, seed, 1, 12)),
      delta: vary(4, seed, 2, 8),
      hint: "Tokens & cost per accepted change",
    },
    {
      key: "effectiveness",
      label: "Effectiveness",
      score: clampScore(vary(66, seed, 3, 12)),
      delta: vary(0, seed, 4, 7),
      hint: "Code delivered with less back-and-forth",
    },
    {
      key: "alignment",
      label: "Alignment",
      score: clampScore(vary(82, seed, 5, 10)),
      delta: vary(2, seed, 6, 6),
      hint: "Did what you wanted, fewer corrections",
    },
  ];
}

function metrics(seed: number): Metric[] {
  const reask = Math.max(6, vary(18, seed, 7, 6));
  return [
    {
      key: "tokens_per_change",
      label: "Tokens / change",
      value: `${(vary(42, seed, 8, 8) / 10).toFixed(1)}k`,
      delta: vary(-12, seed, 9, 8),
      trend: "down",
      good: true,
    },
    {
      key: "cost",
      label: "Cost",
      value: `$${(vary(32, seed, 10, 12) / 10).toFixed(2)}`,
      delta: vary(-8, seed, 11, 7),
      trend: "down",
      good: true,
    },
    {
      key: "reask",
      label: "Re-ask rate",
      value: `${reask}%`,
      delta: vary(5, seed, 12, 6),
      trend: reask > 18 ? "up" : "down",
      good: reask <= 18,
    },
    {
      key: "cache",
      label: "Cache hits",
      value: `${vary(71, seed, 13, 8)}%`,
      delta: vary(4, seed, 14, 5),
      trend: "up",
      good: true,
    },
    {
      key: "tool_success",
      label: "Tool success",
      value: `${vary(94, seed, 15, 4)}%`,
      delta: vary(1, seed, 16, 3),
      trend: "flat",
      good: true,
    },
    {
      key: "sessions",
      label: "Sessions",
      value: `${Math.max(6, vary(13, seed, 17, 4))}`,
      delta: vary(2, seed, 18, 3),
      trend: "up",
      good: true,
    },
  ];
}

const FINDINGS: Finding[] = [
  {
    id: "f_verify_win",
    type: "win",
    title: "The verify skill correlates with fewer re-asks",
    body: "On the sessions where you used the verify skill, re-ask rate was ~18% lower than your average. Worth keeping as a habit.",
    improvement:
      "Keep verification as a default completion step for code changes.",
    agentBenefit:
      "The harness closes loops by checking its work before handing it back.",
    userBenefit:
      "You spend less time asking for tests, proof, or cleanup after the agent says it is done.",
    reflection:
      "Keep watching whether verified sessions continue to reduce re-asks without increasing cost.",
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
    improvement:
      "Add the exact test command where the harness already looks for project guidance.",
    agentBenefit:
      "The agent can choose the right validation path without guessing.",
    userBenefit:
      "You avoid repeated prompts like “actually run the tests” on this repo.",
    reflection:
      "Check the next few sessions for fewer test-command corrections in agent-fleet.",
    confidence: "high",
    project: "agent-fleet",
    evidence: "4 prompts · “actually run the tests”",
    evidenceFile:
      "/Users/jalillaaraichi/.codex/sessions/mock/agent-fleet-tests.jsonl",
    configGap:
      "AGENTS.md did not name the repo's canonical validation command.",
    action: "Add test-runner hint to AGENTS.md",
    category: "agentsmd",
    frictionType: "config-conflict",
    projectPath: "/Users/jalillaaraichi/agent-fleet",
    patch: {
      target: "agentsmd",
      file: "/Users/jalillaaraichi/agent-fleet/AGENTS.md",
      label: "AGENTS.md · agent-fleet",
      snippet:
        "<!-- harness-dreams:start -->\n## Harness Dreams — accepted guidance\n\n- Run `pnpm test` before claiming code changes are complete.\n<!-- harness-dreams:end -->\n",
      creates: false,
    },
  },
  {
    id: "f_dup_opportunity",
    type: "opportunity",
    title: "CSV parser duplicated across two repos",
    body: "A near-identical CSV parser was written in both zod-to-sql and sql-export this week. Extracting a shared helper would save future effort.",
    improvement:
      "Turn the duplicate parser into a shared helper or reusable snippet.",
    agentBenefit:
      "Future agents can reuse one known implementation instead of rebuilding it.",
    userBenefit:
      "You get more consistent behavior across repos and less review time on repeated code.",
    reflection:
      "Track whether future CSV-related changes reuse the helper instead of creating new variants.",
    confidence: "medium",
    project: "zod-to-sql · sql-export",
    evidence: "2 files · ~80% similar",
    action: "Track as improvement",
  },
  {
    id: "f_noagents_risk",
    type: "risk",
    title: "No AGENTS.md in waker — higher tool-failure rate",
    body: "waker has a 14% tool-failure rate, well above your average. It’s also the only active repo without an AGENTS.md to orient the agent.",
    improvement:
      "Draft a small AGENTS.md with setup, test, and style expectations.",
    agentBenefit:
      "The harness starts with local rules instead of discovering them through failed tools.",
    userBenefit:
      "You spend less time correcting environment assumptions in a repo you revisit.",
    reflection:
      "Compare tool-failure rate after adding project guidance to confirm it helped.",
    confidence: "low",
    project: "waker",
    evidence: "14% tool failures · no AGENTS.md",
    configGap:
      "The project has no local guidance file, so the agent discovers setup through failed tools.",
    action: "Draft a starter AGENTS.md",
    category: "agentsmd",
    frictionType: "missing-skill",
    projectPath: "/Users/jalillaaraichi/waker",
  },
];

const REVIEW_DECISIONS: ActionQueueEntry[] = [
  {
    findingId: "f_reask_mistake",
    category: "agentsmd",
    action: "Add test-runner hint to AGENTS.md",
    project: "agent-fleet",
    state: "accepted",
    projectPath: "/Users/jalillaaraichi/agent-fleet",
    patch: FINDINGS[1].patch,
    reviewBranch: {
      branch: "codex/harness-dreams-agent-fleet-tests",
      baseBranch: "main",
      worktreePath:
        "/Users/jalillaaraichi/Library/Application Support/Harness Dreams/recommendation-worktrees/agent-fleet",
      commit: "7c3a91d",
      remote: "origin",
      prUrl:
        "https://github.com/example/agent-fleet/compare/main...codex/harness-dreams-agent-fleet-tests?expand=1",
      pushed: true,
    },
  },
  {
    findingId: "f_dup_opportunity",
    category: "skill",
    action: "Track as improvement",
    project: "zod-to-sql · sql-export",
    state: "queued",
  },
];

const EXPERIMENTS: Experiment[] = [
  {
    id: "accepted_f_reask_mistake",
    title: "Add test-runner hint to AGENTS.md",
    hypothesis:
      "The exact validation command removes repeated test-command corrections.",
    agentBenefit:
      "The harness chooses the correct verification path without guessing.",
    userBenefit:
      "You spend fewer prompts asking the agent to actually run the tests.",
    reflection:
      "Check the next agent-fleet sessions for fewer test-command corrections.",
    metric: "alignment · re-ask rate · tool success",
    status: "concluded",
    progress: 1 / 3,
    progressLabel: "1 / 3 cycles measured",
    verdict: "helped",
    verdictNote: "Alignment 71 → 83 (+12)",
    projectPath: "/Users/jalillaaraichi/agent-fleet",
    category: "agentsmd",
    baseline: { alignment: 71, corrections: 4 },
  },
  {
    id: "x_medium_ui",
    title: "Medium thinking effort for UI tasks",
    hypothesis: "Lower effort on UI work reduces cost without hurting quality.",
    agentBenefit:
      "The harness uses a lighter reasoning budget where iteration is visual and bounded.",
    userBenefit:
      "You get cheaper UI passes while still seeing quality and re-ask rate monitored.",
    reflection:
      "Review cost, re-asks, and accepted changes after the next five UI sessions.",
    metric: "re-ask rate · tokens/change",
    status: "proposed",
  },
  {
    id: "x_codex_refactor",
    title: "Prefer Codex for quick refactors",
    hypothesis: "Codex is faster for small mechanical edits.",
    agentBenefit:
      "Small refactors route to the harness that has been quickest on mechanical edits.",
    userBenefit:
      "You wait less on routine cleanup while keeping accept rate visible.",
    reflection:
      "Compare latency and accept rate against similar refactors from the last week.",
    metric: "latency · accept rate",
    status: "proposed",
  },
  {
    id: "x_plan_mode",
    title: "Plan mode for multi-file edits",
    hypothesis: "Planning first reduces wrong-file mistakes.",
    agentBenefit:
      "The harness maps touched files before editing, which reduces avoidable churn.",
    userBenefit:
      "You review fewer wrong-file edits and spend less time redirecting scope.",
    reflection:
      "Keep checking correction rate until there are enough multi-file sessions to judge.",
    metric: "correction rate",
    status: "running",
    progress: 0.6,
    progressLabel: "3 / 5 sessions",
  },
];

const PROJECT_INSIGHTS: ProjectInsight[] = [
  {
    name: "agent-fleet",
    path: "/Users/jalillaaraichi/agent-fleet",
    sources: ["claude-code", "codex"],
    sessions: 6,
    turns: 44,
    corrections: 1,
    toolFailures: 0,
    hedges: 1,
    alignment: 83,
    topics: ["tests", "runner", "verification"],
    hasAgentsMd: true,
    hasClaudeMd: false,
    skillCount: 3,
  },
  {
    name: "waker",
    path: "/Users/jalillaaraichi/waker",
    sources: ["claude-code"],
    sessions: 2,
    turns: 17,
    corrections: 2,
    toolFailures: 3,
    hedges: 1,
    alignment: 58,
    topics: ["setup", "tools", "environment"],
    hasAgentsMd: false,
    hasClaudeMd: false,
    skillCount: 0,
  },
  {
    name: "zod-to-sql",
    path: "/Users/jalillaaraichi/zod-to-sql",
    sources: ["codex"],
    sessions: 3,
    turns: 24,
    corrections: 1,
    toolFailures: 0,
    hedges: 0,
    alignment: 79,
    topics: ["csv", "parser", "schema"],
    hasAgentsMd: true,
    hasClaudeMd: true,
    skillCount: 1,
  },
];

/** Deterministically pick one option from a list using the seed. */
function pick<T>(options: T[], seed: number, salt = 0): T {
  const idx = Math.floor(((noise(seed, salt) + 1) / 2) * options.length);
  return options[Math.min(options.length - 1, Math.max(0, idx))];
}

/** Map an alignment score to its band. */
function bandFor(score: number): AlignmentBand {
  if (score >= 80) return "collaborating";
  if (score >= 45) return "friction";
  return "fighting";
}

/** Build the alignment detail from the alignment ring + the day's findings. */
function alignment(seed: number, ringScore: number): AlignmentDetail {
  return {
    score: ringScore,
    band: bandFor(ringScore),
    human: {
      mood: pick(["deep-focus", "exploratory", "scattered"], seed, 31),
      question: "How do I cut re-asks without losing review quality?",
      signals: ["rephrased ask 4×", "2 context switches", "3 rejections"],
    },
    agent: {
      mood: pick(["confident", "uncertain", "overloaded"], seed, 32),
      question: 'What does this user mean by "done"?',
      signals: ["hedged 3×", "1 contradiction", "2 tool retries"],
    },
    friction: [
      {
        type: "unclear-prompt",
        example: "Re-asked to run tests 4× in agent-fleet",
        findingId: "f_reask_mistake",
      },
      {
        type: "config-conflict",
        example: "waker has no AGENTS.md to orient the agent",
        findingId: "f_noagents_risk",
      },
    ],
  };
}

function dateLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Mint a Dream Report. `seed` drives the (deterministic) mock variation. */
export function makeReport(
  timestamp: number,
  seed: number,
  reviewStatus: CycleReviewStatus = "unreviewed"
): DreamReport {
  const sessions = Math.max(6, vary(13, seed, 17, 4));
  const ringSet = rings(seed);
  const alignScore = ringSet.find((r) => r.key === "alignment")?.score ?? 82;
  return {
    id: `dream_${timestamp}`,
    timestamp,
    reviewStatus,
    reviewedAt: reviewStatus === "reviewed" ? timestamp + 1_800_000 : undefined,
    rangeLabel: `${dateLabel(timestamp)} · ${sessions} sessions`,
    sessions,
    projects: Math.max(2, vary(5, seed, 20, 2)),
    harness: "Claude Code",
    digest: DIGESTS[Math.abs(seed) % DIGESTS.length],
    rings: ringSet,
    metrics: metrics(seed),
    findings: FINDINGS,
    experiments: EXPERIMENTS,
    reviewDecisions: reviewStatus === "reviewed" ? REVIEW_DECISIONS : undefined,
    alignment: alignment(seed, alignScore),
    projectInsights: PROJECT_INSIGHTS,
  };
}

/** A history of past dreams, newest first. */
export function seedReports(now: number): DreamReport[] {
  const DAY = 86_400_000;
  return [0, 1, 2, 3, 4].map((i) =>
    makeReport(now - i * DAY, 97 - i * 11, i === 0 ? "unreviewed" : "reviewed")
  );
}
