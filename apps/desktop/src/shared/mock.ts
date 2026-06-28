import type {
  ActionQueueEntry,
  AlignmentBand,
  AlignmentDetail,
  AnalysisProject,
  CycleKind,
  CycleReviewStatus,
  DreamReport,
  Experiment,
  Finding,
  Metric,
  ProjectInsight,
  Ring,
} from "./types";

/**
 * Preview and demo reports. `seedReports` powers renderer-only preview mode;
 * the explicit demo helpers below power persisted in-app Demo Mode.
 */

export const DEMO_PROJECTS: AnalysisProject[] = [
  {
    path: "/Users/demo/work/atlas-notes",
    name: "atlas-notes",
    sources: ["codex", "claude-code"],
    enabled: true,
    addedAt: 1_798_460_800_000,
  },
  {
    path: "/Users/demo/work/route-hopper",
    name: "route-hopper",
    sources: ["codex"],
    enabled: true,
    addedAt: 1_798_460_800_000,
  },
  {
    path: "/Users/demo/work/launch-ledger",
    name: "launch-ledger",
    sources: ["claude-code"],
    enabled: true,
    addedAt: 1_798_460_800_000,
  },
];

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

const DEMO_FINDINGS: Finding[] = [
  {
    id: "demo_agents_validation",
    type: "mistake",
    title: "Validation command was discovered through re-asks",
    body: "The agent tried npm test, then pnpm test, before the user corrected it to the repo's fixture-backed command.",
    improvement:
      "Add the canonical validation command to AGENTS.md so the agent starts with the right proof path.",
    agentBenefit:
      "The agent can verify changes without guessing package scripts.",
    userBenefit:
      "The user avoids repeated redirects before a change is considered done.",
    reflection:
      "Watch whether future atlas-notes sessions need fewer test-command corrections.",
    confidence: "high",
    project: "atlas-notes",
    evidence:
      "actually use `pnpm test:fixtures`, that is the command this repo trusts",
    evidenceFile:
      "/Users/demo/.codex/sessions/atlas-notes/2026-06-26-validation.jsonl",
    configGap:
      "AGENTS.md named the package manager but not the repo's trusted fixture validation command.",
    action: "Add fixture validation rule to AGENTS.md",
    category: "agentsmd",
    frictionType: "config-conflict",
    projectPath: "/Users/demo/work/atlas-notes",
    patch: {
      target: "agentsmd",
      file: "/Users/demo/work/atlas-notes/AGENTS.md",
      label: "AGENTS.md · atlas-notes",
      snippet:
        "<!-- harness-dreams:start -->\n## Harness Dreams — accepted guidance\n\n- Run `pnpm test:fixtures` before claiming parser or import changes are complete.\n<!-- harness-dreams:end -->\n",
      creates: false,
    },
  },
  {
    id: "demo_skill_routing",
    type: "opportunity",
    title: "Support triage prompts repeat the same manual checklist",
    body: "Three route-hopper sessions rebuilt the same issue-classification checklist before editing labels.",
    improvement:
      "Scaffold a small triage skill that lists label definitions, escalation rules, and the expected evidence summary.",
    agentBenefit:
      "The agent can route support issues consistently instead of recreating the checklist from memory.",
    userBenefit:
      "The user gets cleaner triage output and spends less time correcting label choices.",
    reflection:
      "Track whether support-routing sessions reuse the skill and reduce wrong-label corrections.",
    confidence: "medium",
    project: "route-hopper",
    evidence:
      "we already wrote this triage checklist yesterday; please stop rebuilding it",
    evidenceFile:
      "/Users/demo/.claude/projects/route-hopper/2026-06-27-triage.jsonl",
    configGap:
      "No reusable skill captured the repo's support-routing checklist.",
    action: "Scaffold route triage skill",
    category: "skill",
    frictionType: "missing-skill",
    projectPath: "/Users/demo/work/route-hopper",
    patch: {
      target: "skill",
      file: "/Users/demo/work/route-hopper/.codex/skills/route-triage/SKILL.md",
      label: "New skill · route-triage",
      snippet:
        "# route-triage\n\nUse when support issues need product-area labels.\n\n- Read the issue body and linked logs before changing labels.\n- Apply exactly one product-area label and one urgency label.\n- Return the evidence sentence that justified the label choice.\n",
      creates: true,
    },
  },
  {
    id: "demo_claude_release_notes",
    type: "risk",
    title: "Release-note style changes by agent",
    body: "Launch-ledger alternated between terse changelog bullets and customer-facing release notes in adjacent sessions.",
    improvement:
      "Add the release-note audience and format to CLAUDE.md so generated notes match the product voice.",
    agentBenefit:
      "The agent gets a stable style target before drafting release copy.",
    userBenefit:
      "The user spends less time rewriting notes after the implementation work is done.",
    reflection:
      "Compare release-note rewrites after adding the CLAUDE.md style rule.",
    confidence: "medium",
    project: "launch-ledger",
    evidence:
      "this reads like an internal changelog; make it customer-facing and mention the migration risk",
    evidenceFile:
      "/Users/demo/.claude/projects/launch-ledger/2026-06-27-release-copy.jsonl",
    configGap:
      "CLAUDE.md did not specify release-note audience, tone, or required risk callout.",
    action: "Add release-note rule to CLAUDE.md",
    category: "claudemd",
    frictionType: "wrong-domain",
    projectPath: "/Users/demo/work/launch-ledger",
    patch: {
      target: "claudemd",
      file: "/Users/demo/work/launch-ledger/CLAUDE.md",
      label: "CLAUDE.md · launch-ledger",
      snippet:
        "<!-- harness-dreams:start -->\n## Harness Dreams — accepted guidance\n\n- Draft release notes for customers, not maintainers; include migration risk when data shape changes.\n<!-- harness-dreams:end -->\n",
      creates: false,
    },
  },
  {
    id: "demo_api_contract",
    type: "mistake",
    title: "API changes landed without contract examples",
    body: "The agent updated the billing endpoint but left the OpenAPI example and fixture response in the old shape.",
    improvement:
      "Add an AGENTS.md rule that API changes must update fixtures and the OpenAPI example in the same branch.",
    agentBenefit:
      "The agent checks the contract surface before calling an API change complete.",
    userBenefit:
      "The user catches fewer frontend/backend mismatches during review.",
    reflection:
      "Watch whether API sessions update fixtures before the user asks for it.",
    confidence: "high",
    project: "launch-ledger",
    evidence:
      "the endpoint changed but the OpenAPI example is still returning `invoice_total_cents`",
    evidenceFile:
      "/Users/demo/.codex/sessions/launch-ledger/2026-06-28-api-contract.jsonl",
    configGap:
      "AGENTS.md did not define the repo's contract-update checklist for API changes.",
    action: "Add API contract checklist to AGENTS.md",
    category: "agentsmd",
    frictionType: "config-conflict",
    projectPath: "/Users/demo/work/launch-ledger",
    patch: {
      target: "agentsmd",
      file: "/Users/demo/work/launch-ledger/AGENTS.md",
      label: "AGENTS.md · launch-ledger",
      snippet:
        "<!-- harness-dreams:start -->\n## Harness Dreams — accepted guidance\n\n- When API response shapes change, update the OpenAPI example and fixture response in the same branch.\n<!-- harness-dreams:end -->\n",
      creates: false,
    },
  },
  {
    id: "demo_scope_creep",
    type: "risk",
    title: "Small UI asks turned into broad rewrites",
    body: "Two atlas-notes sessions changed surrounding navigation and spacing while the user only asked for the import review panel.",
    improvement:
      "Add a prompt habit that asks the agent to name the intended files before editing compact UI requests.",
    agentBenefit:
      "The agent holds a smaller edit boundary and avoids unrelated churn.",
    userBenefit:
      "The user reviews focused patches instead of backing out opportunistic cleanup.",
    reflection:
      "Measure whether compact UI sessions touch fewer unrelated files.",
    confidence: "medium",
    project: "atlas-notes",
    evidence:
      "please stop changing the sidebar; this was only about the import review panel",
    evidenceFile:
      "/Users/demo/.claude/projects/atlas-notes/2026-06-28-ui-scope.jsonl",
    configGap:
      "No prompt habit tells the agent to restate scope before compact UI edits.",
    action: "Track a narrow-scope prompt habit",
    category: "prompthabit",
    frictionType: "unclear-prompt",
    projectPath: "/Users/demo/work/atlas-notes",
  },
  {
    id: "demo_accessibility_review",
    type: "opportunity",
    title: "Accessibility review happens after visual approval",
    body: "Route-hopper shipped a clean keyboard filter UI only after a second pass added labels and focus states.",
    improvement:
      "Scaffold a UI accessibility review skill for keyboard, labels, focus, and reduced-motion checks.",
    agentBenefit:
      "The agent can run the UI quality checklist before returning a visual change.",
    userBenefit:
      "The user gets fewer late accessibility corrections after the layout already looks done.",
    reflection:
      "Track whether UI sessions include keyboard/focus evidence on the first handoff.",
    confidence: "medium",
    project: "route-hopper",
    evidence:
      "looks good visually, but the filter chips still need keyboard focus and labels",
    evidenceFile:
      "/Users/demo/.codex/sessions/route-hopper/2026-06-29-a11y-review.jsonl",
    configGap:
      "No skill captured the UI review checklist the user repeats after visual approval.",
    action: "Scaffold UI accessibility review skill",
    category: "skill",
    frictionType: "missing-skill",
    projectPath: "/Users/demo/work/route-hopper",
    patch: {
      target: "skill",
      file: "/Users/demo/work/route-hopper/.codex/skills/ui-a11y-review/SKILL.md",
      label: "New skill · ui-a11y-review",
      snippet:
        "# ui-a11y-review\n\nUse before handing off UI changes.\n\n- Check keyboard reachability for new controls.\n- Confirm visible labels or aria-labels for icon-only controls.\n- Verify focus states and reduced-motion behavior.\n- Report the evidence checked in the final response.\n",
      creates: true,
    },
  },
];

const DEMO_SCENARIOS = [
  {
    label: "Demo: onboarding parser work",
    digest:
      "The team spent the day importing customer notes. The same validation command was corrected twice, while support triage kept rebuilding a checklist that should be reusable.",
    findingIds: ["demo_agents_validation", "demo_skill_routing"],
    alignment: 58,
    reask: 31,
    sessions: 6,
    turns: 52,
    humanMood: "frustrated",
    humanQuestion: "Why do I keep repeating repo-specific rules?",
    humanSignals: [
      "2 test-command corrections",
      "1 repeated triage checklist",
      "1 late fixture request",
    ],
    agentMood: "uncertain",
    agentQuestion: "Which local rule should I trust first?",
    agentSignals: [
      "guessed test script",
      "rebuilt checklist",
      "missed fixture proof",
    ],
  },
  {
    label: "Demo: release and billing polish",
    digest:
      "Release work moved fast, but copy style and API contract updates drifted from what the repos expect. Two accepted guidance changes are now being measured.",
    findingIds: ["demo_claude_release_notes", "demo_api_contract"],
    alignment: 69,
    reask: 22,
    sessions: 7,
    turns: 61,
    humanMood: "exploratory",
    humanQuestion:
      "Can the agent keep release quality without extra rewrite passes?",
    humanSignals: [
      "1 customer-copy rewrite",
      "1 stale OpenAPI example",
      "accepted AGENTS.md branch under review",
    ],
    agentMood: "confident",
    agentQuestion: "Which surfaces prove this release is done?",
    agentSignals: ["read guidance", "updated code first", "missed doc fixture"],
  },
  {
    label: "Demo: focused UI iteration",
    digest:
      "UI work improved after the validation rule, but compact requests still expanded beyond scope and accessibility checks arrived late.",
    findingIds: ["demo_scope_creep", "demo_accessibility_review"],
    alignment: 74,
    reask: 18,
    sessions: 8,
    turns: 64,
    humanMood: "deep-focus",
    humanQuestion:
      "Can the agent keep patches tight without me policing scope?",
    humanSignals: [
      "1 unrelated sidebar edit",
      "1 late keyboard-focus request",
      "fixture command used correctly",
    ],
    agentMood: "overloaded",
    agentQuestion: "Should I clean nearby UI while I am here?",
    agentSignals: [
      "expanded touched files",
      "missed labels first pass",
      "used prior AGENTS.md",
    ],
  },
  {
    label: "Demo: measured follow-through",
    digest:
      "Accepted guidance is paying off: validation and contract misses dropped, while the next best improvement is a reusable UI review skill.",
    findingIds: [
      "demo_accessibility_review",
      "demo_scope_creep",
      "demo_skill_routing",
    ],
    alignment: 83,
    reask: 11,
    sessions: 9,
    turns: 67,
    humanMood: "deep-focus",
    humanQuestion: "Which guidance should become a durable workflow habit?",
    humanSignals: [
      "0 validation-command corrections",
      "1 scoped UI redirect",
      "2 guidance branches measured",
    ],
    agentMood: "confident",
    agentQuestion: "Which accepted changes are now proven?",
    agentSignals: [
      "used fixture rule",
      "updated contract example",
      "reported verdict",
    ],
  },
] as const;

const DEMO_PROJECT_INSIGHTS: ProjectInsight[] = [
  {
    name: "atlas-notes",
    path: "/Users/demo/work/atlas-notes",
    sources: ["codex", "claude-code"],
    sessions: 5,
    turns: 38,
    corrections: 4,
    toolFailures: 1,
    hedges: 1,
    alignment: 63,
    topics: ["fixtures", "imports", "parser"],
    hasAgentsMd: true,
    hasClaudeMd: false,
    skillCount: 1,
  },
  {
    name: "route-hopper",
    path: "/Users/demo/work/route-hopper",
    sources: ["codex"],
    sessions: 3,
    turns: 21,
    corrections: 2,
    toolFailures: 0,
    hedges: 2,
    alignment: 68,
    topics: ["triage", "labels", "support"],
    hasAgentsMd: false,
    hasClaudeMd: false,
    skillCount: 0,
  },
  {
    name: "launch-ledger",
    path: "/Users/demo/work/launch-ledger",
    sources: ["claude-code"],
    sessions: 2,
    turns: 16,
    corrections: 2,
    toolFailures: 0,
    hedges: 1,
    alignment: 59,
    topics: ["release notes", "migration", "copy"],
    hasAgentsMd: false,
    hasClaudeMd: true,
    skillCount: 0,
  },
];

function demoReviewBranch(finding: Finding, index: number) {
  const slug = finding.project.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    branch: `demo/harness-dreams-${slug}-${index + 1}`,
    baseBranch: "main",
    worktreePath: `/Users/demo/Library/Application Support/Harness Dreams/recommendation-worktrees/${slug}`,
    commit: `demo${index + 17}c${finding.id.length}`,
    remote: "origin",
    prUrl: `https://github.com/demo-org/${slug}/compare/main...demo/harness-dreams-${slug}-${index + 1}?expand=1`,
    pushed: true,
  };
}

function demoScenario(cycleNumber: number) {
  return DEMO_SCENARIOS[Math.abs(cycleNumber) % DEMO_SCENARIOS.length];
}

function demoFindings(cycleNumber: number): Finding[] {
  const ids = new Set<string>(demoScenario(cycleNumber).findingIds);
  return DEMO_FINDINGS.filter((finding) => ids.has(finding.id));
}

function demoVerdictFor(entry: ActionQueueEntry, cycleNumber: number) {
  if (entry.category === "prompthabit") return "no-change" as const;
  if (entry.category === "claudemd" && cycleNumber % 3 === 0) {
    return "worse" as const;
  }
  return "helped" as const;
}

function concludeDemoExperiments(
  experiments: Experiment[],
  cycleNumber: number,
  previous?: DreamReport | null
): Experiment[] {
  const accepted = previous?.reviewDecisions?.filter(
    (entry) => entry.state === "accepted"
  );
  if (!accepted?.length) return experiments;
  const existing = new Map(
    experiments.map((experiment) => [experiment.id, experiment])
  );
  accepted.forEach((entry, index) => {
    const prior = previous?.findings.find(
      (finding) => finding.id === entry.findingId
    );
    const baseline = previous?.projectInsights?.find(
      (project) => project.path === entry.projectPath
    );
    const nextAlignment = Math.min(
      94,
      (baseline?.alignment ?? 64) +
        (entry.category === "prompthabit" ? 2 : 14 - index * 3)
    );
    const verdict = demoVerdictFor(entry, cycleNumber);
    const baselineAlignment = baseline?.alignment ?? 64;
    existing.set(`accepted_${entry.findingId}`, {
      id: `accepted_${entry.findingId}`,
      title: entry.action,
      hypothesis:
        prior?.improvement ??
        "Accepted guidance should reduce repeated correction.",
      agentBenefit:
        prior?.agentBenefit ?? "The agent starts from clearer local guidance.",
      userBenefit:
        prior?.userBenefit ??
        "The user spends fewer prompts correcting the agent.",
      reflection:
        prior?.reflection ??
        "The next cycle compares alignment and corrections.",
      metric: "alignment · corrections · tool success",
      status: "concluded",
      progress: 1,
      progressLabel: "1 / 1 demo cycle measured",
      verdict,
      verdictNote:
        verdict === "helped"
          ? `Alignment ${baselineAlignment} -> ${nextAlignment} (+${nextAlignment - baselineAlignment})`
          : verdict === "worse"
            ? `Alignment ${baselineAlignment} -> ${Math.max(40, baselineAlignment - 3)} (-3); release copy still needed a rewrite.`
            : "No repeated friction observed yet; keep watching one more cycle.",
      projectPath: entry.projectPath,
      category: entry.category,
      baseline: baseline
        ? { alignment: baseline.alignment, corrections: baseline.corrections }
        : undefined,
    });
  });
  return Array.from(existing.values());
}

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

/**
 * Shape a full demo cycle into a "nap": lighter and morning-framed. A nap is a
 * fast Deep-Sleep-only check-in, so it keeps the vitals but trims to the single
 * most useful nudge and a short "this morning" window.
 */
function napifyDemo(report: DreamReport): DreamReport {
  const napSessions = Math.max(2, Math.round(report.sessions / 3));
  return {
    ...report,
    kind: "nap",
    sessions: napSessions,
    findings: report.findings.slice(0, 1),
    reviewDecisions: undefined,
    rangeLabel: `This morning · ${napSessions} session${napSessions === 1 ? "" : "s"}`,
    digest:
      "A quick mid-day look at this morning's work — just the most useful nudge to keep your momentum.",
    alignment: report.alignment
      ? { ...report.alignment, friction: report.alignment.friction.slice(0, 1) }
      : report.alignment,
    window: report.window
      ? {
          ...report.window,
          label: "This morning",
          sessionsInWindow: napSessions,
        }
      : report.window,
  };
}

export function makeDemoReport(
  timestamp: number,
  cycleNumber: number,
  reviewStatus: CycleReviewStatus = "unreviewed",
  previous?: DreamReport | null,
  kind: CycleKind = "sleep"
): DreamReport {
  const seed = 240 + cycleNumber * 19;
  const base = makeReport(timestamp, seed, reviewStatus);
  const scenario = demoScenario(cycleNumber);
  const alignmentScore = Math.min(92, scenario.alignment + cycleNumber);
  const sessions = scenario.sessions + Math.floor(cycleNumber / 4);
  const turns = scenario.turns + Math.floor(cycleNumber / 4) * 5;
  const findings = demoFindings(cycleNumber);
  const reviewedDecisions =
    reviewStatus === "reviewed"
      ? findings.slice(0, 2).map(
          (finding, index): ActionQueueEntry => ({
            findingId: finding.id,
            category: finding.category ?? "contextdoc",
            action: finding.action,
            project: finding.project,
            state: index === 0 ? "accepted" : "queued",
            projectPath: finding.projectPath,
            patch: finding.patch,
            reviewBranch:
              index === 0 ? demoReviewBranch(finding, index) : undefined,
          })
        )
      : undefined;
  const experiments = concludeDemoExperiments(
    previous?.experiments ?? [],
    cycleNumber,
    previous
  );
  const report: DreamReport = {
    ...base,
    id: `demo_cycle_${timestamp}_${cycleNumber}`,
    timestamp,
    reviewStatus,
    reviewedAt: reviewStatus === "reviewed" ? timestamp + 1_200_000 : undefined,
    rangeLabel: `${dateLabel(timestamp)} · Demo cycle ${cycleNumber + 1}`,
    sessions,
    projects: DEMO_PROJECTS.length,
    harness: "Codex + Claude Code demo",
    digest: scenario.digest,
    rings: base.rings.map((ring) =>
      ring.key === "alignment"
        ? { ...ring, score: alignmentScore, delta: cycleNumber === 0 ? -6 : 14 }
        : ring.key === "efficiency"
          ? { ...ring, score: Math.min(90, ring.score + cycleNumber * 5) }
          : ring
    ),
    metrics: base.metrics.map((metric) =>
      metric.key === "sessions"
        ? { ...metric, value: `${sessions}`, delta: cycleNumber + 1 }
        : metric.key === "reask"
          ? {
              ...metric,
              value: `${scenario.reask}%`,
              delta: scenario.reask > 24 ? 9 : -8,
              trend: scenario.reask > 24 ? "up" : "down",
              good: scenario.reask <= 22,
            }
          : metric
    ),
    findings,
    experiments,
    reviewDecisions: reviewedDecisions,
    alignment: {
      score: alignmentScore,
      band: bandFor(alignmentScore),
      human: {
        mood: scenario.humanMood,
        question: scenario.humanQuestion,
        signals: [...scenario.humanSignals],
      },
      agent: {
        mood: scenario.agentMood,
        question: scenario.agentQuestion,
        signals: [...scenario.agentSignals],
      },
      friction: findings.map((finding) => ({
        type: finding.frictionType ?? "unclear-prompt",
        example: finding.evidence,
        findingId: finding.id,
      })),
    },
    window: {
      start: timestamp - 7_200_000,
      end: timestamp,
      basis: cycleNumber === 0 ? "last-24h" : "since-last-cycle",
      label: scenario.label,
      sessionsInWindow: sessions,
      turnsInWindow: turns,
    },
    projectInsights: DEMO_PROJECT_INSIGHTS.map((project, index) => ({
      ...project,
      sessions: Math.max(1, project.sessions + cycleNumber - index),
      turns: Math.max(5, project.turns + cycleNumber * 4 - index),
      corrections: Math.max(
        0,
        project.corrections + (scenario.reask > 24 ? 1 : 0) - cycleNumber
      ),
      alignment: Math.min(
        94,
        project.alignment +
          Math.floor(cycleNumber / 2) * (8 - index * 2) +
          (scenario.reask <= 18 ? 4 : 0)
      ),
      hasAgentsMd:
        project.path === "/Users/demo/work/atlas-notes" ||
        (project.path === "/Users/demo/work/launch-ledger" && cycleNumber > 1)
          ? true
          : project.hasAgentsMd,
      skillCount:
        project.path === "/Users/demo/work/route-hopper"
          ? project.skillCount + (cycleNumber > 2 ? 1 : 0)
          : project.skillCount,
    })),
    cloudRedactionPreview:
      cycleNumber === 0
        ? {
            runner: "demo",
            model: "demo-rem",
            redactions: 4,
            payloadChars: 4_860,
            projects: DEMO_PROJECTS.length,
          }
        : undefined,
  };
  return kind === "nap" ? napifyDemo(report) : report;
}

export function seedDemoReports(now: number): DreamReport[] {
  const DAY = 86_400_000;
  const oldest = makeDemoReport(now - DAY * 4, 0, "reviewed");
  const second = makeDemoReport(now - DAY * 3, 1, "reviewed", oldest);
  const third = makeDemoReport(now - DAY * 2, 2, "reviewed", second);
  const fourth = makeDemoReport(now - DAY, 3, "reviewed", third);
  return [
    makeDemoReport(now, 4, "unreviewed", fourth),
    fourth,
    third,
    second,
    oldest,
  ];
}

export function nextDemoReport(
  now: number,
  previous?: DreamReport | null,
  kind: CycleKind = "sleep"
): DreamReport {
  const count = previous?.id.startsWith("demo_cycle_")
    ? Number(previous.id.split("_").at(-1) ?? 0) + 1
    : 1;
  return makeDemoReport(
    now,
    Number.isFinite(count) ? count : 1,
    "unreviewed",
    previous,
    kind
  );
}
