import type {
  AlignmentDetail,
  AnalysisProject,
  CycleKind,
  CycleWindow,
  DreamReport,
  Experiment,
  Finding,
  FrictionType,
  Metric,
  ProjectInsight,
  Ring,
  WindowBasis,
  PrivacyMode,
  RemRunnerConfig,
} from "../shared/types";
import {
  agentsPatch,
  claudePatch,
  contextRulesPatch,
  type ProjectConfig,
  readProjectConfig,
  skillPatch,
} from "./agentConfig";
import { startOfDay } from "../shared/timeOfDay";
import {
  ingestSelectedSessions,
  type LocalSession,
  type LocalTurn,
} from "./localIngest";
import { runRemAnalysis } from "./remAnalysis";

/**
 * The real Sleep Cycle engine. Given the enabled projects and the time since
 * the last cycle, it ingests only the windowed sessions (capped at 24h),
 * detects collaboration friction from the actual transcripts, and turns the
 * strongest patterns into concrete AGENTS.md / skill / context recommendations
 * with ready-to-apply file patches.
 */

const DAY_MS = 86_400_000;
const RAPID_MS = 90_000;

const FRUSTRATION_RE =
  /\b(no+|nope|don'?t|stop|wrong|not what|undo|revert|again|still not|broke|broken|isn'?t working|doesn'?t work|that'?s not|why (is|did|are|isn)|ugh)\b/i;
const HEDGE_RE =
  /\b(i think|i believe|i'?m not sure|might be|may be|possibly|presumably|perhaps|unclear|not certain|hard to say|i assume|i'?ll guess)\b/i;

const STOPWORDS = new Set([
  "the",
  "and",
  "that",
  "this",
  "with",
  "from",
  "have",
  "will",
  "your",
  "what",
  "when",
  "they",
  "them",
  "then",
  "there",
  "here",
  "just",
  "like",
  "into",
  "also",
  "because",
  "should",
  "would",
  "could",
  "about",
  "which",
  "while",
  "being",
  "does",
  "done",
  "need",
  "want",
  "make",
  "made",
  "using",
  "used",
  "than",
  "then",
  "some",
  "more",
  "most",
  "very",
  "code",
  "file",
  "files",
  "line",
  "lines",
  "function",
  "change",
  "changes",
  "work",
  "working",
  "right",
  "okay",
  "yeah",
  "sure",
  "let's",
  "lets",
  "going",
  "still",
  "back",
  "now",
  "one",
  "two",
  "get",
  "got",
  "add",
  "added",
  "fix",
  "fixed",
  "issue",
  "thing",
  "things",
  "good",
  "great",
  "please",
  "thanks",
  "actually",
  "really",
  "maybe",
  "sense",
]);

const RULE_HINTS: { re: RegExp; rule: string }[] = [
  {
    re: /hardcod/i,
    rule: "Never hardcode values — read them from config or handle them server-side.",
  },
  {
    re: /server[- ]?side|client[- ]?side/i,
    rule: "Keep state and secrets server-side; don't rely on client-side shortcuts.",
  },
  {
    re: /\btests?\b|\bspec\b|coverage/i,
    rule: "Run the relevant tests and report the actual output before claiming a fix works.",
  },
  {
    re: /revert|undo|broke|regress/i,
    rule: "Make small, reversible changes and verify each one before moving on.",
  },
  {
    re: /deterministic|prompt|instruction/i,
    rule: "For rule-based behavior prefer deterministic code over prompt tweaks.",
  },
  {
    re: /migrat|schema|database|mongo|sql/i,
    rule: "Confirm the data shape and migration plan before touching the database.",
  },
];

function clampScore(value: number): number {
  return Math.max(28, Math.min(98, Math.round(value)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function quote(text: string, max = 96): string {
  const clean = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function fmtDuration(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Per-session + per-project signal detection ───────────────────────────────

interface SessionSignals {
  session: LocalSession;
  windowTurns: number;
  userTurns: number;
  corrections: number;
  toolCalls: number;
  frustration: string[];
  toolFailures: string[];
  hedges: string[];
  topics: Set<string>;
}

function topicsFrom(turns: LocalTurn[], counter: Map<string, number>): void {
  for (const turn of turns) {
    const seen = new Set<string>();
    for (const raw of turn.content.toLowerCase().split(/[^a-z0-9-]+/)) {
      const word = raw.replace(/^-+|-+$/g, "");
      if (word.length < 4 || word.length > 22) continue;
      if (STOPWORDS.has(word) || /^\d+$/.test(word)) continue;
      if (seen.has(word)) continue;
      seen.add(word);
      counter.set(word, (counter.get(word) ?? 0) + 1);
    }
  }
}

function analyzeSession(
  session: LocalSession,
  windowStart: number
): SessionSignals {
  const turns = session.turns.filter((turn) => turn.timestamp >= windowStart);
  const userTurns = turns.filter((turn) => turn.kind === "user");
  const frustration: string[] = [];
  const toolFailures: string[] = [];
  const hedges: string[] = [];
  const topicCounter = new Map<string, number>();
  let corrections = 0;
  let toolCalls = 0;
  let prevUserAt = 0;

  // Topics come from the human's words only — tool-result dumps and verbose
  // agent output would otherwise drown the signal in code tokens.
  topicsFrom(userTurns, topicCounter);

  for (const turn of turns) {
    if (turn.hasToolCall) toolCalls += 1;
    if (turn.kind === "user") {
      const isFrustrated = FRUSTRATION_RE.test(turn.content);
      const isRapid = prevUserAt > 0 && turn.timestamp - prevUserAt < RAPID_MS;
      if (isFrustrated) {
        corrections += 1;
        if (frustration.length < 4) frustration.push(quote(turn.content));
      } else if (isRapid) {
        corrections += 1;
      }
      prevUserAt = turn.timestamp;
    } else if (turn.kind === "assistant") {
      if (HEDGE_RE.test(turn.content)) {
        hedges.push(hedges.length < 4 ? quote(turn.content) : "");
      }
    } else if (turn.kind === "tool_result" && turn.toolError) {
      toolFailures.push(toolFailures.length < 4 ? quote(turn.content) : "");
    }
  }

  return {
    session,
    windowTurns: turns.filter((turn) => turn.kind !== "tool_result").length,
    userTurns: userTurns.length,
    corrections,
    toolCalls,
    frustration,
    toolFailures,
    hedges,
    topics: new Set([...topicCounter.keys()]),
  };
}

interface ProjectAgg {
  path: string;
  name: string;
  sources: Set<string>;
  config: ProjectConfig;
  sessions: number;
  turns: number;
  userTurns: number;
  corrections: number;
  toolCalls: number;
  toolFailures: number;
  hedges: number;
  frustrationQuotes: string[];
  toolFailQuotes: string[];
  hedgeQuotes: string[];
  topicFreq: Map<string, number>;
  topicSessions: Map<string, number>;
}

function aggregate(signals: SessionSignals[]): Map<string, ProjectAgg> {
  const byProject = new Map<string, ProjectAgg>();
  for (const sig of signals) {
    const key = sig.session.projectPath;
    let agg = byProject.get(key);
    if (!agg) {
      agg = {
        path: key,
        name: sig.session.projectName,
        sources: new Set(),
        config: readProjectConfig(key),
        sessions: 0,
        turns: 0,
        userTurns: 0,
        corrections: 0,
        toolCalls: 0,
        toolFailures: 0,
        hedges: 0,
        frustrationQuotes: [],
        toolFailQuotes: [],
        hedgeQuotes: [],
        topicFreq: new Map(),
        topicSessions: new Map(),
      };
      byProject.set(key, agg);
    }
    agg.sources.add(sig.session.source);
    agg.sessions += 1;
    agg.turns += sig.windowTurns;
    agg.userTurns += sig.userTurns;
    agg.corrections += sig.corrections;
    agg.toolCalls += sig.toolCalls;
    agg.toolFailures += sig.toolFailures.length;
    agg.hedges += sig.hedges.length;
    for (const q of sig.frustration) if (q) agg.frustrationQuotes.push(q);
    for (const q of sig.toolFailures) if (q) agg.toolFailQuotes.push(q);
    for (const q of sig.hedges) if (q) agg.hedgeQuotes.push(q);
    for (const topic of sig.topics) {
      agg.topicSessions.set(topic, (agg.topicSessions.get(topic) ?? 0) + 1);
    }
  }
  return byProject;
}

function configOnlyAgg(project: AnalysisProject): ProjectAgg {
  return {
    path: project.path,
    name: project.name,
    sources: new Set(project.sources),
    config: readProjectConfig(project.path),
    sessions: 0,
    turns: 0,
    userTurns: 0,
    corrections: 0,
    toolCalls: 0,
    toolFailures: 0,
    hedges: 0,
    frustrationQuotes: [],
    toolFailQuotes: [],
    hedgeQuotes: [],
    topicFreq: new Map(),
    topicSessions: new Map(),
  };
}

function topTopics(agg: ProjectAgg, limit: number): string[] {
  return [...agg.topicSessions.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([topic]) => topic);
}

function lineCount(text: string): number {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

function compactChars(chars: number): string {
  if (chars >= 1000) return `${Math.round(chars / 1000)}k chars`;
  return `${chars} chars`;
}

function projectAlignment(agg: ProjectAgg): number {
  const reask = (agg.corrections / Math.max(1, agg.userTurns)) * 100;
  const toolFailRate = (agg.toolFailures / Math.max(1, agg.toolCalls)) * 100;
  return clampScore(96 - reask * 0.7 - toolFailRate * 0.3);
}

function ruleFromFriction(topic: string | undefined, evidence: string): string {
  for (const hint of RULE_HINTS) {
    if (hint.re.test(evidence) || (topic && hint.re.test(topic))) {
      return hint.rule;
    }
  }
  const area = topic ? `When working on ${topic}, c` : "C";
  return `${area}onfirm the intended approach before large edits — this direction was corrected repeatedly.`;
}

// ── Finding (recommendation) generation ──────────────────────────────────────

interface Candidate {
  severity: number;
  finding: Finding;
}

function makeCandidates(agg: ProjectAgg): Candidate[] {
  const out: Candidate[] = [];
  const topics = topTopics(agg, 5);
  const topic = topics[0];
  const reask = Math.round(
    (agg.corrections / Math.max(1, agg.userTurns)) * 100
  );
  const health = agg.config.contextHealth;
  const agentsChars = agg.config.agentsMd.length;
  const agentsLines = lineCount(agg.config.agentsMd);

  // 0 · Context hygiene: long AGENTS.md should split durable detail into rules.md.
  if (
    agg.config.hasAgentsMd &&
    !agg.config.hasRulesMd &&
    (agentsChars > 6_000 || agentsLines > 120)
  ) {
    const line =
      "Move detailed project rules and long-lived decisions into rules.md; keep AGENTS.md focused on routing, safety, test commands, and links to deeper context.";
    out.push({
      severity: agentsChars > 9_000 || agentsLines > 160 ? 88 : 72,
      finding: baseFinding(agg, {
        id: `context-split-${agg.path}`,
        type: "risk",
        title: `AGENTS.md is carrying too much context in ${agg.name}`,
        body: `${agg.name} loads ${compactChars(agentsChars)} across ${agentsLines} AGENTS.md lines and has no rules.md split. That makes high-priority instructions easier to miss.`,
        action: `Create rules.md for ${agg.name} and move detailed guidance out of AGENTS.md.`,
        improvement:
          "A smaller AGENTS.md stays readable while rules.md holds durable details the user can maintain deliberately.",
        category: "contextdoc",
        frictionType: "config-conflict",
        evidence: `${compactChars(agentsChars)} AGENTS.md · ${agentsLines} lines · no rules.md`,
        patch: contextRulesPatch(agg.config, line, agg.name),
      }),
    });
  }

  // 0b · Too many skills can create routing noise before the agent starts work.
  if (health.localSkillCount > 8 || health.skillCount > 22) {
    const rule = `Skill routing for ${agg.name}: prefer project-local skills that match the task, and do not load a global skill unless its description directly fits the current request.`;
    out.push({
      severity: 68 + Math.min(20, health.skillCount),
      finding: baseFinding(agg, {
        id: `skill-noise-${agg.path}`,
        type: "opportunity",
        title: `Skill routing may be noisy in ${agg.name}`,
        body: `${agg.name} sees ${health.skillCount} skills (${health.localSkillCount} project, ${health.globalSkillCount} global). A small routing rule reduces accidental skill selection.`,
        action: `Add a skill-routing rule for ${agg.name} and review rarely used skills.`,
        improvement:
          "Constraining skill selection keeps the agent from loading irrelevant instructions before it understands the task.",
        category: "agentsmd",
        frictionType: "missing-skill",
        evidence: `${health.skillCount} available skills`,
        patch: agentsPatch(agg.config, "agentsmd", rule, agg.name),
      }),
    });
  }

  // 0c · Large home-level Claude/Codex context competes with project guidance.
  if (health.globalChars > 10_000) {
    const line = `For ${agg.name}, keep project-specific guidance in this repo's AGENTS.md, CLAUDE.md, or rules.md; keep home Claude/Codex instructions for global defaults only.`;
    out.push({
      severity: 74,
      finding: baseFinding(agg, {
        id: `home-context-${agg.path}`,
        type: "risk",
        title: `Home Claude/Codex context is heavy for ${agg.name}`,
        body: `The cycle found ${compactChars(health.globalChars)} of home-directory Claude/Codex context before project instructions. Project-specific guidance should live closer to the repo.`,
        action: `Move ${agg.name}-specific guidance out of home Claude/Codex memory and into project files.`,
        improvement:
          "Keeping home context global and project context local makes the next session's instruction stack easier to reason about.",
        category: "claudemd",
        frictionType: "config-conflict",
        evidence: `${compactChars(health.globalChars)} home Claude/Codex context`,
        patch: claudePatch(agg.config, line, agg.name),
      }),
    });
  }

  // 0d · Claude memory can be missing or too scattered to serve as useful recall.
  if (
    health.memoryFiles > 10 ||
    health.memoryChars > 16_000 ||
    (health.memoryFiles === 0 && agg.corrections >= 2)
  ) {
    const line =
      health.memoryFiles === 0
        ? "Memory handoff: after repeated corrections, record the durable decision in MEMORY.md or rules.md so the next session does not rediscover it."
        : "Memory consolidation: keep durable facts in a short indexed MEMORY.md, and prune duplicate or stale Claude memory notes before adding new ones.";
    out.push({
      severity: health.memoryFiles === 0 ? 66 : 76,
      finding: baseFinding(agg, {
        id: `memory-hygiene-${agg.path}`,
        type: "opportunity",
        title:
          health.memoryFiles === 0
            ? `No durable memory handoff in ${agg.name}`
            : `Claude memory needs consolidation for ${agg.name}`,
        body:
          health.memoryFiles === 0
            ? `${agg.name} had repeated corrections, but no MEMORY.md or Claude memory file was found for durable handoff.`
            : `${agg.name} has ${health.memoryFiles} memory files totaling ${compactChars(health.memoryChars)}. Consolidation keeps recall sharp.`,
        action:
          health.memoryFiles === 0
            ? `Create a memory handoff rule for ${agg.name}.`
            : `Consolidate Claude memory for ${agg.name}.`,
        improvement:
          "Memory stays useful when durable facts are indexed and stale context is pruned.",
        category: "contextdoc",
        frictionType: "wrong-domain",
        evidence:
          health.memoryFiles === 0
            ? `${agg.corrections} corrections · no memory files`
            : `${health.memoryFiles} memory files · ${compactChars(health.memoryChars)}`,
        patch: contextRulesPatch(agg.config, line, agg.name),
      }),
    });
  }

  // A · Missing AGENTS.md on a project with real activity.
  if (agg.turns >= 8 && !agg.config.hasAgentsMd && !agg.config.hasClaudeMd) {
    const line =
      agg.frustrationQuotes.length > 0
        ? ruleFromFriction(topic, agg.frustrationQuotes[0])
        : `Focus areas this cycle: ${topics.slice(0, 3).join(", ") || "the active workflow"}.`;
    out.push({
      severity: 70 + agg.corrections * 4,
      finding: baseFinding(agg, {
        id: `missing-agents-${agg.path}`,
        type: "opportunity",
        title: `${agg.name} has no AGENTS.md`,
        body: `The agent worked ${agg.turns} turns across ${agg.sessions} session${agg.sessions === 1 ? "" : "s"} in ${agg.name} with no durable guidance file to anchor it.`,
        action: `Create an AGENTS.md for ${agg.name} so the next agent starts with your conventions.`,
        improvement:
          "A short AGENTS.md captures the conventions you keep restating, so the agent starts aligned.",
        category: "agentsmd",
        frictionType: "missing-skill",
        evidence: agg.frustrationQuotes[0]
          ? `e.g. “${agg.frustrationQuotes[0]}”`
          : `${agg.turns} turns, no AGENTS.md or CLAUDE.md`,
        patch: agentsPatch(agg.config, "agentsmd", line, agg.name),
      }),
    });
  }

  // B · Recurring corrections → a concrete AGENTS.md rule.
  if (agg.corrections >= 2 && agg.frustrationQuotes.length > 0) {
    const evidence = agg.frustrationQuotes[0];
    const rule = ruleFromFriction(topic, evidence);
    out.push({
      severity: 80 + agg.corrections * 5,
      finding: baseFinding(agg, {
        id: `rule-${agg.path}`,
        type: "mistake",
        title: `Repeated corrections in ${agg.name}`,
        body: `You corrected the agent ${agg.corrections} times this window${topic ? ` around ${topic}` : ""}. Encoding the rule once stops the loop.`,
        action: `Add a rule to ${agg.name} AGENTS.md: ${rule}`,
        improvement:
          "Turning a repeated correction into a written rule means you stop re-typing it every session.",
        category: "agentsmd",
        frictionType: "config-conflict",
        evidence: `“${evidence}”`,
        patch: agentsPatch(agg.config, "agentsmd", rule, agg.name),
      }),
    });
  }

  // C · A recurring task → a skill.
  const recurringTask = [...agg.topicSessions.entries()]
    .filter(([t, count]) => count >= 2 && !agg.config.skills.includes(t))
    .sort((a, b) => b[1] - a[1])[0];
  if (recurringTask && agg.sessions >= 2) {
    const [task, count] = recurringTask;
    out.push({
      severity: 60 + count * 4,
      finding: baseFinding(agg, {
        id: `skill-${agg.path}-${task}`,
        type: "opportunity",
        title: `“${task}” recurs in ${agg.name}`,
        body: `“${task}” came up in ${count} separate sessions. A skill encodes the steps so the agent stops re-deriving them.`,
        action: `Add a "${task}" skill for ${agg.name} so the agent follows a known path.`,
        improvement:
          "A skill captures a repeated task once, so future sessions execute it consistently instead of improvising.",
        category: "skill",
        frictionType: "missing-skill",
        evidence: `Recurred in ${count} of ${agg.sessions} sessions`,
        patch: skillPatch(
          agg.config,
          task,
          `Steps for the recurring "${task}" task in ${agg.name}.`,
          agg.name
        ),
      }),
    });
  }

  // D · Tool failures → document the working path.
  if (agg.toolFailures >= 2) {
    const evidence = agg.toolFailQuotes[0] ?? `${agg.toolFailures} tool errors`;
    out.push({
      severity: 55 + agg.toolFailures * 4,
      finding: baseFinding(agg, {
        id: `toolfail-${agg.path}`,
        type: "risk",
        title: `Tool errors slowed ${agg.name}`,
        body: `${agg.toolFailures} tool calls surfaced errors this window. Capturing the working command keeps the agent from rediscovering it.`,
        action: `Document the working setup/commands for ${agg.name} so the agent avoids the failing path.`,
        improvement:
          "Recording the command that actually works converts trial-and-error into a single reliable step.",
        category: "contextdoc",
        frictionType: "wrong-domain",
        evidence: quote(evidence),
        patch: agentsPatch(
          agg.config,
          "contextdoc",
          `Known-good setup for ${topic ?? agg.name}: document the exact working command so tool calls stop failing.`,
          agg.name
        ),
      }),
    });
  }

  // E · Under-specified prompts → a prompt habit.
  if (reask >= 22 && agg.corrections >= 2) {
    out.push({
      severity: 50 + reask,
      finding: baseFinding(agg, {
        id: `prompt-${agg.path}`,
        type: "opportunity",
        title: `Re-ask rate is high in ${agg.name}`,
        body: `${reask}% of your turns were rapid corrections. Front-loading the goal and constraints cuts the back-and-forth.`,
        action: `Start ${agg.name} prompts with the goal + constraints up front to cut the ${reask}% re-ask rate.`,
        improvement:
          "Stating the goal and constraints in the first prompt removes the rounds spent narrowing intent.",
        category: "prompthabit",
        frictionType: "unclear-prompt",
        evidence: `${agg.corrections} rapid corrections · ${reask}% re-ask`,
      }),
    });
  }

  // F · Agent uncertainty → a context doc.
  if (agg.hedges >= 3) {
    const evidence = agg.hedgeQuotes[0] ?? `${agg.hedges} hedges`;
    out.push({
      severity: 45 + agg.hedges * 2,
      finding: baseFinding(agg, {
        id: `hedge-${agg.path}`,
        type: "opportunity",
        title: `The agent hedged in ${agg.name}`,
        body: `${agg.hedges} uncertainty signals${topic ? ` around ${topic}` : ""} suggest a knowledge gap a short context note would close.`,
        action: `Write a short context note on ${topic ?? agg.name} to remove the agent's ${agg.hedges} hedges.`,
        improvement:
          "A few lines of context on the ambiguous area replaces guessing with grounded answers.",
        category: "contextdoc",
        frictionType: "wrong-domain",
        evidence: quote(evidence),
      }),
    });
  }

  return out;
}

function baseFinding(
  agg: ProjectAgg,
  fields: {
    id: string;
    type: Finding["type"];
    title: string;
    body: string;
    action: string;
    improvement: string;
    category: Finding["category"];
    frictionType: FrictionType;
    evidence: string;
    patch?: Finding["patch"];
  }
): Finding {
  return {
    id: fields.id,
    type: fields.type,
    title: fields.title,
    body: fields.body,
    improvement: fields.improvement,
    agentBenefit:
      fields.category === "agentsmd"
        ? "The agent loads durable, project-local guidance before it picks tools or a plan."
        : fields.category === "skill"
          ? "The agent follows a known routine instead of re-deriving the same steps."
          : "The agent has the context it needs and stops guessing or repeating failures.",
    userBenefit:
      "You spend fewer turns correcting assumptions, repeated questions, or missed state.",
    reflection: `Whether ${agg.name}'s ${fields.category === "agentsmd" ? "corrections" : fields.category === "skill" ? "repeated task" : "friction"} drops in the next cycle.`,
    confidence:
      fields.evidence.length > 0 &&
      (agg.corrections >= 2 || agg.toolFailures >= 2)
        ? "high"
        : "medium",
    project: agg.name,
    projectPath: agg.path,
    evidence: fields.evidence,
    action: fields.action,
    category: fields.category,
    frictionType: fields.frictionType,
    patch: fields.patch,
  };
}

function selectFindings(aggs: ProjectAgg[]): Finding[] {
  const candidates = aggs.flatMap(makeCandidates);
  candidates.sort((a, b) => b.severity - a.severity);
  // Dedupe by (category, project) — keep the strongest of each.
  const seen = new Set<string>();
  const picked: Finding[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.finding.category}:${candidate.finding.projectPath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(candidate.finding);
    // Keep it a *small* set of improvements — behavior findings plus at most
    // a little context hygiene, not an exhaustive audit.
    if (picked.length >= 4) break;
  }
  return picked;
}

/**
 * Close the loop: a goal accepted in an earlier cycle is measured here. We
 * compare the target project's alignment/corrections now against the baseline
 * captured when the goal was accepted, advance it a cycle, and conclude with a
 * verdict once there's enough signal. This is what makes the *next* cycle
 * measure whether a change actually helped.
 */
function gradeCarriedExperiments(
  prev: DreamReport | null,
  insights: ProjectInsight[]
): Experiment[] {
  const running = (prev?.experiments ?? []).filter(
    (exp) => exp.status === "running"
  );
  return running.map((exp) => {
    const progress = Math.min(1, (exp.progress ?? 0) + 1 / 3);
    const cycles = Math.round(progress * 3);
    const progressLabel = `${cycles} / 3 cycles measured`;
    const now = exp.projectPath
      ? insights.find((insight) => insight.path === exp.projectPath)
      : undefined;
    const base = exp.baseline;

    if (now && base) {
      // Judge on alignment only — it's a rate, so it's comparable across
      // windows of different lengths. Raw correction counts are not. For
      // context-hygiene changes, also compare the deterministic context score.
      const alignmentDelta = now.alignment - base.alignment;
      const contextDelta =
        base.contextScore != null && now.contextHealth
          ? now.contextHealth.score - base.contextScore
          : null;
      const helped =
        alignmentDelta > 0 || (contextDelta != null && contextDelta > 0);
      const worse =
        alignmentDelta < 0 && (contextDelta == null || contextDelta <= 0);
      const sign = alignmentDelta >= 0 ? "+" : "";
      const contextNote =
        contextDelta == null || base.contextScore == null || !now.contextHealth
          ? ""
          : ` · Context ${base.contextScore} → ${now.contextHealth.score} (${contextDelta >= 0 ? "+" : ""}${contextDelta})`;
      const note = `Alignment ${base.alignment} → ${now.alignment} (${sign}${alignmentDelta})${contextNote}`;
      return {
        ...exp,
        status: "concluded",
        verdict: helped ? "helped" : worse ? "worse" : "no-change",
        verdictNote: note,
        progress,
        progressLabel,
      };
    }

    if (progress >= 1) {
      return {
        ...exp,
        status: "concluded",
        verdict: "no-change",
        verdictNote: "No activity in the target project to measure against.",
        progress,
        progressLabel,
      };
    }
    return {
      ...exp,
      progress,
      progressLabel,
      verdictNote: "Waiting for new activity in the target project.",
    };
  });
}

// ── Rings, metrics, alignment ────────────────────────────────────────────────

interface Totals {
  sessions: number;
  turns: number;
  userTurns: number;
  corrections: number;
  toolCalls: number;
  toolFailures: number;
  hedges: number;
}

function totalsOf(aggs: ProjectAgg[]): Totals {
  return aggs.reduce<Totals>(
    (acc, agg) => ({
      sessions: acc.sessions + agg.sessions,
      turns: acc.turns + agg.turns,
      userTurns: acc.userTurns + agg.userTurns,
      corrections: acc.corrections + agg.corrections,
      toolCalls: acc.toolCalls + agg.toolCalls,
      toolFailures: acc.toolFailures + agg.toolFailures,
      hedges: acc.hedges + agg.hedges,
    }),
    {
      sessions: 0,
      turns: 0,
      userTurns: 0,
      corrections: 0,
      toolCalls: 0,
      toolFailures: 0,
      hedges: 0,
    }
  );
}

function makeRings(t: Totals, prev: DreamReport | null): Ring[] {
  // Rate-based so scores reflect collaboration quality, not window size: a long
  // productive day shouldn't score worse than a short rough one just for volume.
  const userTurns = Math.max(1, t.userTurns);
  const assistantTurns = Math.max(1, t.turns - t.userTurns);
  const reaskRate = (t.corrections / userTurns) * 100;
  const toolFailRate = (t.toolFailures / Math.max(1, t.toolCalls)) * 100;
  const hedgeRate = (t.hedges / assistantTurns) * 100;
  const alignment = clampScore(
    96 - reaskRate * 0.7 - toolFailRate * 0.3 - hedgeRate * 0.4
  );
  const efficiency = clampScore(95 - reaskRate * 0.45 - toolFailRate * 0.9);
  const effectiveness = clampScore(
    93 - reaskRate * 0.3 - hedgeRate * 0.6 - toolFailRate * 0.4
  );
  const prevScore = (key: string): number =>
    prev?.rings.find((ring) => ring.key === key)?.score ?? 0;
  const delta = (key: string, score: number): number =>
    prev ? clamp(score - prevScore(key), -40, 40) : 0;
  return [
    {
      key: "efficiency",
      label: "Efficiency",
      score: efficiency,
      delta: delta("efficiency", efficiency),
      hint: "Tool retries, re-asks, and avoidable rework",
    },
    {
      key: "effectiveness",
      label: "Effectiveness",
      score: effectiveness,
      delta: delta("effectiveness", effectiveness),
      hint: "Sessions completed with fewer uncertainty signals",
    },
    {
      key: "alignment",
      label: "Alignment",
      score: alignment,
      delta: delta("alignment", alignment),
      hint: "How closely agent behavior tracked your intent",
    },
  ];
}

function makeMetrics(
  t: Totals,
  aggs: ProjectAgg[],
  findingCount: number
): Metric[] {
  const reask = Math.round((t.corrections / Math.max(1, t.userTurns)) * 100);
  const toolSuccess = clamp(
    100 - (t.toolFailures / Math.max(1, t.toolCalls)) * 100,
    0,
    100
  );
  const withAgents = aggs.filter((agg) => agg.config.hasAgentsMd).length;
  const coverage = Math.round((withAgents / Math.max(1, aggs.length)) * 100);
  const contextChars =
    aggs.reduce((sum, agg) => sum + agg.config.contextHealth.projectChars, 0) +
    Math.max(0, ...aggs.map((agg) => agg.config.contextHealth.globalChars));
  const overloadedContexts = aggs.filter(
    (agg) => agg.config.contextHealth.status === "overloaded"
  ).length;
  return [
    {
      key: "reask",
      label: "Re-ask rate",
      value: `${reask}%`,
      delta: reask,
      trend: reask > 18 ? "up" : "down",
      good: reask <= 18,
    },
    {
      key: "tool_success",
      label: "Tool success",
      value: `${toolSuccess}%`,
      delta: -t.toolFailures,
      trend: t.toolFailures > 0 ? "down" : "flat",
      good: toolSuccess >= 90,
    },
    {
      key: "context_load",
      label: "Context load",
      value: compactChars(contextChars),
      delta: overloadedContexts,
      trend: overloadedContexts > 0 ? "up" : "flat",
      good: overloadedContexts === 0,
    },
    {
      key: "tokens_per_change",
      label: "Rework load",
      value: `${t.corrections}`,
      delta: t.corrections,
      trend: t.corrections > 4 ? "up" : "flat",
      good: t.corrections <= 4,
    },
    {
      key: "cache",
      label: "AGENTS.md coverage",
      value: `${coverage}%`,
      delta: coverage,
      trend: coverage >= 60 ? "up" : "down",
      good: coverage >= 60,
    },
    {
      key: "recommendations",
      label: "Recommendations",
      value: `${findingCount}`,
      delta: findingCount,
      trend: "up",
      good: findingCount > 0,
    },
    {
      key: "sessions",
      label: "Sessions reviewed",
      value: `${t.sessions}`,
      delta: 0,
      trend: "flat",
      good: true,
    },
  ];
}

function makeAlignment(
  t: Totals,
  aggs: ProjectAgg[],
  findings: Finding[],
  score: number
): AlignmentDetail {
  const reask = Math.round((t.corrections / Math.max(1, t.userTurns)) * 100);
  const busiest = [...aggs].sort((a, b) => b.turns - a.turns)[0];
  const topic = busiest ? topTopics(busiest, 1)[0] : undefined;
  const humanSignals = aggs.flatMap((agg) => agg.frustrationQuotes).slice(0, 3);
  return {
    score,
    band: score >= 80 ? "collaborating" : score >= 45 ? "friction" : "fighting",
    human: {
      mood:
        reask > 22
          ? "frustrated"
          : t.corrections > 2
            ? "scattered"
            : "deep-focus",
      question: topic
        ? `How do I get the agent to handle ${topic} without repeated corrections?`
        : "How do I keep the agent aligned with my intent across sessions?",
      signals:
        humanSignals.length > 0
          ? humanSignals
          : [`${t.corrections} corrections`, `${reask}% re-ask`],
    },
    agent: {
      mood:
        t.hedges > 4
          ? "uncertain"
          : t.toolFailures > 2
            ? "overloaded"
            : "confident",
      question: topic
        ? `What's the intended approach for ${topic} here?`
        : "What conventions should I carry into the next session?",
      signals: [
        `${t.hedges} uncertainty signals`,
        `${t.toolFailures} tool errors`,
        `${t.toolCalls} tool-bearing turns`,
      ],
    },
    friction: findings
      .filter((finding) => finding.frictionType)
      .slice(0, 5)
      .map((finding) => ({
        type: finding.frictionType ?? "wrong-domain",
        example: finding.evidence,
        findingId: finding.id,
      })),
  };
}

// ── Window + report assembly ─────────────────────────────────────────────────

function computeWindow(
  sessions: LocalSession[],
  start: number,
  end: number,
  basis: WindowBasis
): CycleWindow {
  let earliest = end;
  let latest = start;
  let turns = 0;
  let sessionCount = 0;
  for (const session of sessions) {
    let sessionTurns = 0;
    for (const turn of session.turns) {
      if (
        turn.timestamp < start ||
        turn.timestamp > end ||
        turn.kind === "tool_result"
      )
        continue;
      turns += 1;
      sessionTurns += 1;
      if (turn.timestamp < earliest) earliest = turn.timestamp;
      if (turn.timestamp > latest) latest = turn.timestamp;
    }
    if (sessionTurns > 0) sessionCount += 1;
  }
  const spanMs = sessionCount > 0 ? Math.max(0, latest - earliest) : 0;
  const basisLabel =
    basis === "since-last-cycle" ? `Since ${fmtTime(start)}` : "Last 24 hours";
  const label =
    sessions.length > 0
      ? `${basisLabel} · ${fmtDuration(spanMs)} of activity`
      : `${basisLabel} · quiet`;
  return {
    start,
    end,
    basis,
    label,
    sessionsInWindow: sessionCount,
    turnsInWindow: turns,
  };
}

function projectInsightsOf(aggs: ProjectAgg[]): ProjectInsight[] {
  return aggs
    .map((agg) => ({
      name: agg.name,
      path: agg.path,
      sources: [...agg.sources] as ProjectInsight["sources"],
      sessions: agg.sessions,
      turns: agg.turns,
      corrections: agg.corrections,
      toolFailures: agg.toolFailures,
      hedges: agg.hedges,
      alignment: projectAlignment(agg),
      topics: topTopics(agg, 4),
      hasAgentsMd: agg.config.hasAgentsMd,
      hasClaudeMd: agg.config.hasClaudeMd,
      hasRulesMd: agg.config.hasRulesMd,
      skillCount: agg.config.skills.length,
      contextHealth: agg.config.contextHealth,
    }))
    .sort(
      (a, b) =>
        b.turns - a.turns || a.contextHealth.score - b.contextHealth.score
    );
}

function contextSummaryOf(
  insights: ProjectInsight[]
): DreamReport["contextHealth"] {
  if (insights.length === 0) return undefined;
  const scores = insights.map((insight) => insight.contextHealth?.score ?? 100);
  const score = Math.round(
    scores.reduce((sum, value) => sum + value, 0) / Math.max(1, scores.length)
  );
  const overloadedProjects = insights.filter(
    (insight) => insight.contextHealth?.status === "overloaded"
  ).length;
  const riskCount = insights.reduce(
    (sum, insight) => sum + (insight.contextHealth?.risks.length ?? 0),
    0
  );
  const suggestions = [
    ...new Set(
      insights.flatMap((insight) => insight.contextHealth?.suggestions ?? [])
    ),
  ].slice(0, 3);
  return {
    score,
    status: score >= 82 ? "clear" : score >= 62 ? "watch" : "overloaded",
    overloadedProjects,
    riskCount,
    chars:
      insights.reduce(
        (sum, insight) => sum + (insight.contextHealth?.projectChars ?? 0),
        0
      ) +
      Math.max(
        0,
        ...insights.map((insight) => insight.contextHealth?.globalChars ?? 0)
      ),
    memoryFiles: insights.reduce(
      (sum, insight) => sum + (insight.contextHealth?.memoryFiles ?? 0),
      0
    ),
    skillCount: insights.reduce(
      (sum, insight) => sum + (insight.contextHealth?.localSkillCount ?? 0),
      0
    ),
    suggestions,
  };
}

function quietReport(
  window: CycleWindow,
  projects: AnalysisProject[],
  prev: DreamReport | null,
  now: number,
  aggs: ProjectAgg[]
): DreamReport {
  const enabled = projects.filter((project) => project.enabled);
  const totals: Totals = {
    sessions: 0,
    turns: 0,
    userTurns: 0,
    corrections: 0,
    toolCalls: 0,
    toolFailures: 0,
    hedges: 0,
  };
  const rings = makeRings(totals, prev);
  const contextFindings = selectFindings(aggs);
  const findings =
    contextFindings.length > 0
      ? contextFindings
      : [
          {
            id: `quiet-${now}`,
            type: "win",
            title: "Quiet window — nothing new to review",
            body: `No agent activity in the ${enabled.length} tracked project${enabled.length === 1 ? "" : "s"} since the last Sleep Cycle.`,
            improvement:
              "Keep your project scope current so the next active window is captured.",
            agentBenefit:
              "Nothing to change — the agent had no friction to learn from.",
            userBenefit:
              "A calm cycle is a healthy one; review resumes when work does.",
            reflection:
              "Whether the next window picks up fresh sessions to analyze.",
            confidence: "high",
            project: enabled[0]?.name ?? "workspace",
            projectPath: enabled[0]?.path,
            evidence: `0 sessions in ${window.label.toLowerCase()}`,
            action: "No action needed this cycle",
            category: "contextdoc",
          } satisfies Finding,
        ];
  const insights = projectInsightsOf(aggs);
  const contextHealth = contextSummaryOf(insights);
  const digest =
    contextFindings.length > 0
      ? `No new agent activity, but the context review found ${contextFindings.length} cleanup recommendation${contextFindings.length === 1 ? "" : "s"} across ${insights.length} tracked project${insights.length === 1 ? "" : "s"}.`
      : "No new agent activity in this window. The Sleep Cycle stayed quiet — nothing to accept or change.";
  return {
    id: `cycle_${now}`,
    timestamp: now,
    reviewStatus: "unreviewed",
    rangeLabel: `${window.label} · quiet`,
    sessions: 0,
    projects: insights.length || enabled.length,
    harness: "Local agent data",
    digest,
    rings,
    metrics: makeMetrics(totals, aggs, contextFindings.length),
    findings,
    experiments: gradeCarriedExperiments(prev, insights),
    window,
    projectInsights: insights,
    contextHealth,
    alignment: {
      score: rings.find((ring) => ring.key === "alignment")?.score ?? 80,
      band: "collaborating",
      human: {
        mood: "deep-focus",
        question:
          contextFindings.length > 0
            ? "Which context cleanup should happen before the next session?"
            : "Nothing pending — what should the next window watch?",
        signals:
          contextFindings.length > 0
            ? contextFindings.slice(0, 3).map((finding) => finding.evidence)
            : ["0 sessions", window.label],
      },
      agent: {
        mood: contextFindings.length > 0 ? "overloaded" : "confident",
        question:
          contextFindings.length > 0
            ? "Which instructions are global, project-local, or detailed reference context?"
            : "No open questions this window.",
        signals:
          contextHealth && contextFindings.length > 0
            ? [
                `${compactChars(contextHealth.chars)} context load`,
                `${contextHealth.riskCount} context risks`,
                `${contextHealth.skillCount} project skills`,
              ]
            : ["0 friction points"],
      },
      friction: findings
        .filter((finding) => finding.frictionType)
        .slice(0, 5)
        .map((finding) => ({
          type: finding.frictionType ?? "wrong-domain",
          example: finding.evidence,
          findingId: finding.id,
        })),
    },
  };
}

export interface CycleOptions {
  /** Epoch ms of the previous cycle, if any (window start, capped at 24h). */
  since?: number | null;
  now?: number;
  prev?: DreamReport | null;
  privacyMode?: PrivacyMode;
  analysisDepth?: "light" | "standard" | "deep";
  remRunner?: RemRunnerConfig;
  /**
   * "sleep" (default) is the full overnight pass. "nap" is a fast Deep-Sleep-only
   * check-in over this morning, capped to the top couple of nudges.
   */
  kind?: CycleKind;
}

/**
 * Run a full Sleep Cycle over the enabled projects' windowed activity.
 * Returns null only when no projects are enabled (so callers can fall back to
 * the onboarding sample); a quiet-but-real report is returned when projects are
 * enabled but had no activity in the window.
 */
export function runSleepCycle(
  projects: AnalysisProject[],
  options: CycleOptions = {}
): DreamReport | null {
  const enabled = projects.filter((project) => project.enabled);
  if (enabled.length === 0) return null;

  const now = options.now ?? Date.now();
  const prev = options.prev ?? null;
  const isNap = options.kind === "nap";
  const floor = now - DAY_MS;
  const since = options.since ?? null;
  // A nap reviews just this morning; a sleep reviews since the last cycle (24h cap).
  const start = isNap
    ? Math.max(startOfDay(now), floor)
    : since && since > floor
      ? since
      : floor;
  const basis: WindowBasis =
    isNap || (since && since > floor) ? "since-last-cycle" : "last-24h";

  const sessions = ingestSelectedSessions(projects, start, now);
  const window = computeWindow(sessions, start, now, basis);
  const boundedSessions = sessions
    .map((session) => ({
      ...session,
      turns: session.turns.filter(
        (turn) => turn.timestamp >= start && turn.timestamp <= now
      ),
    }))
    .filter((session) =>
      session.turns.some((turn) => turn.kind !== "tool_result")
    );

  if (boundedSessions.length === 0) {
    return quietReport(window, projects, prev, now, enabled.map(configOnlyAgg));
  }

  const signals = boundedSessions.map((session) =>
    analyzeSession(session, start)
  );
  const aggs = [...aggregate(signals).values()].filter((agg) => agg.turns > 0);
  const totals = totalsOf(aggs);
  const rem =
    !isNap && options.privacyMode === "cloud" && options.remRunner
      ? runRemAnalysis(
          enabled,
          boundedSessions,
          options.analysisDepth ?? "standard",
          options.remRunner
        )
      : null;
  const heuristicFindings = selectFindings(aggs);
  const allFindings =
    rem && rem.findings.length > 0 ? rem.findings : heuristicFindings;
  // A nap surfaces only the top couple of quick wins.
  const findings = isNap ? allFindings.slice(0, 2) : allFindings;
  const rings = makeRings(totals, prev);
  const alignmentScore =
    rings.find((ring) => ring.key === "alignment")?.score ?? 70;
  const insights = projectInsightsOf(aggs);
  const contextHealth = contextSummaryOf(insights);
  const sources = [...new Set(aggs.flatMap((agg) => [...agg.sources]))];
  const topTopicsAll = [
    ...new Set(insights.flatMap((insight) => insight.topics)),
  ].slice(0, 3);
  const recCount = findings.length;
  // Lead with the health signal, frame findings as a small set of improvements
  // to review — not an alarming raw count of corrections.
  const bandPhrase =
    alignmentScore >= 80
      ? "A smooth day with the agent"
      : alignmentScore >= 45
        ? "Some friction with the agent today"
        : "A rough day with the agent";
  const focus =
    topTopicsAll.length > 0 ? ` around ${topTopicsAll.join(", ")}` : "";
  const digest =
    recCount > 0
      ? `${bandPhrase} — alignment ${alignmentScore}. ${recCount} improvement${recCount === 1 ? "" : "s"} to review from ${totals.sessions} session${totals.sessions === 1 ? "" : "s"}${focus}.`
      : `${bandPhrase} — alignment ${alignmentScore}. ${totals.sessions} session${totals.sessions === 1 ? "" : "s"} reviewed, nothing to change.`;

  return {
    id: `cycle_${now}`,
    timestamp: now,
    kind: options.kind ?? "sleep",
    reviewStatus: "unreviewed",
    rangeLabel: `${window.label} · ${totals.sessions} session${totals.sessions === 1 ? "" : "s"}${topTopicsAll.length > 0 ? ` · ${topTopicsAll.join(", ")}` : ""}`,
    sessions: totals.sessions,
    projects: insights.length,
    harness: sources.join(" + ") || "Local agent data",
    digest,
    rings,
    metrics: makeMetrics(totals, aggs, recCount),
    findings,
    experiments: gradeCarriedExperiments(prev, insights),
    window,
    projectInsights: insights,
    contextHealth,
    alignment: makeAlignment(totals, aggs, findings, alignmentScore),
    cloudRedactionPreview: rem
      ? { ...rem.redactionPreview, error: rem.error }
      : undefined,
  };
}
