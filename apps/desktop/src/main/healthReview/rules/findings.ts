import type { Finding, FrictionType } from "../../../shared/types";
import {
  agentsPatch,
  claudePatch,
  contextRulesPatch,
  skillPatch,
} from "../../agentConfig";
import { compactChars, lineCount, quote } from "../format";
import type { ProjectAgg } from "../types";

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

interface Candidate {
  severity: number;
  finding: Finding;
}

export function topTopics(agg: ProjectAgg, limit: number): string[] {
  return [...agg.topicSessions.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([topic]) => topic);
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
    reflection: `Whether ${agg.name}'s ${fields.category === "agentsmd" ? "corrections" : fields.category === "skill" ? "repeated task" : "friction"} drops in the next review.`,
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

  if (health.globalChars > 10_000) {
    const line = `For ${agg.name}, keep project-specific guidance in this repo's AGENTS.md, CLAUDE.md, or rules.md; keep home Claude/Codex instructions for global defaults only.`;
    out.push({
      severity: 74,
      finding: baseFinding(agg, {
        id: `home-context-${agg.path}`,
        type: "risk",
        title: `Home Claude/Codex context is heavy for ${agg.name}`,
        body: `The review found ${compactChars(health.globalChars)} of home-directory Claude/Codex context before project instructions. Project-specific guidance should live closer to the repo.`,
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

  if (agg.turns >= 8 && !agg.config.hasAgentsMd && !agg.config.hasClaudeMd) {
    const line =
      agg.frustrationQuotes.length > 0
        ? ruleFromFriction(topic, agg.frustrationQuotes[0])
        : `Focus areas this review: ${topics.slice(0, 3).join(", ") || "the active workflow"}.`;
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

export function selectFindings(aggs: ProjectAgg[]): Finding[] {
  const candidates = aggs.flatMap(makeCandidates);
  candidates.sort((a, b) => b.severity - a.severity);
  const seen = new Set<string>();
  const picked: Finding[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.finding.category}:${candidate.finding.projectPath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(candidate.finding);
    if (picked.length >= 4) break;
  }
  return picked;
}
