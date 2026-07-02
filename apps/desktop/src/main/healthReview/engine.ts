import type {
  AlignmentDetail,
  AnalysisProject,
  AnalysisSource,
  HealthReviewKind,
  ReviewWindow,
  ReviewProvenance,
  HealthReport,
  Experiment,
  Finding,
  Metric,
  ProjectInsight,
  Ring,
  WindowBasis,
} from "../../shared/types";
import { startOfDay } from "../../shared/timeOfDay";
import { readProjectConfig } from "../agentConfig";
import {
  ingestSelectedSessions,
  type LocalSession,
  type LocalTurn,
} from "../localIngest";
import {
  runInsightAnalysis,
  type InsightAnalysisResult,
} from "../insightAnalysis";
import {
  clamp,
  clampScore,
  compactChars,
  fmtDuration,
  fmtTime,
  quote,
} from "./format";
import { selectFindings, topTopics } from "./rules/findings";
import type {
  ProjectAgg,
  ReviewOptions,
  SessionSignals,
  Totals,
} from "./types";

/**
 * The real Health Review engine. Given the enabled projects and the time since
 * the last review, it ingests only the windowed sessions (capped at 24h),
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
  "user",
  "request",
  "mentioned",
  "codex",
  "clipboard",
  "image",
  "attached",
]);

function cleanUserSignal(text: string): string {
  return text
    .replace(/<image[\s\S]*?<\/image>/g, " ")
    .split(/\r?\n/)
    .filter((line) => {
      const clean = line.trim();
      if (!clean) return false;
      if (/^#\s*Files mentioned by the user/i.test(clean)) return false;
      if (/^##\s*My request for Codex/i.test(clean)) return false;
      if (/^##\s*codex-clipboard-[\w-]+\.(?:png|jpe?g|webp)/i.test(clean)) {
        return false;
      }
      if (/^<image\b/i.test(clean) || /^<\/image>/i.test(clean)) return false;
      return true;
    })
    .join(" ")
    .replace(
      /codex-clipboard-[\w-]+\.(?:png|jpe?g|webp)[^\s"'`),;]*/gi,
      "attached image"
    )
    .replace(/\/var\/folders\/[^\s"'`),;]+/g, "local attachment")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulSignal(text: string): boolean {
  if (text.length < 12) return false;
  if (/files mentioned by the user/i.test(text)) return false;
  if (/codex-clipboard|\/var\/folders|<image\b/i.test(text)) return false;
  return true;
}

// ── Per-session + per-project signal detection ───────────────────────────────

function topicsFrom(turns: LocalTurn[], counter: Map<string, number>): void {
  for (const turn of turns) {
    const content =
      turn.kind === "user" ? cleanUserSignal(turn.content) : turn.content;
    if (!content) continue;
    const seen = new Set<string>();
    for (const raw of content.toLowerCase().split(/[^a-z0-9-]+/)) {
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
      const cleanContent = cleanUserSignal(turn.content);
      if (!cleanContent) continue;
      const isFrustrated = FRUSTRATION_RE.test(cleanContent);
      const isRapid = prevUserAt > 0 && turn.timestamp - prevUserAt < RAPID_MS;
      if (isFrustrated) {
        corrections += 1;
        const signal = quote(cleanContent);
        if (frustration.length < 4 && isUsefulSignal(signal)) {
          frustration.push(signal);
        }
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

function projectAlignment(agg: ProjectAgg): number {
  const reask = (agg.corrections / Math.max(1, agg.userTurns)) * 100;
  const toolFailRate = (agg.toolFailures / Math.max(1, agg.toolCalls)) * 100;
  return clampScore(96 - reask * 0.7 - toolFailRate * 0.3);
}

/**
 * Close the loop: a goal accepted in an earlier review is measured here. We
 * compare the target project's alignment/corrections now against the baseline
 * captured when the goal was accepted, advance it a review, and conclude with a
 * verdict once there's enough signal. This is what makes the *next* review
 * measure whether a change actually helped.
 */
function gradeCarriedExperiments(
  prev: HealthReport | null,
  insights: ProjectInsight[]
): Experiment[] {
  const running = (prev?.experiments ?? []).filter(
    (exp) => exp.status === "running" && exp.disposition !== "retired"
  );
  return running.map((exp) => {
    const progress = Math.min(1, (exp.progress ?? 0) + 1 / 3);
    const reviews = Math.round(progress * 3);
    const progressLabel = `${reviews} / 3 reviews measured`;
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

function makeRings(t: Totals, prev: HealthReport | null): Ring[] {
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

function makeRingsFromInsight(
  t: Totals,
  prev: HealthReport | null,
  insight: InsightAnalysisResult | null
): Ring[] {
  const rings = makeRings(t, prev);
  if (!insight || insight.error || !insight.scores) return rings;
  return rings.map((ring) => {
    const score = insight.scores?.[ring.key];
    if (score == null) return ring;
    const next = clampScore(score);
    const previous =
      prev?.rings.find((prevRing) => prevRing.key === ring.key)?.score ?? 0;
    return {
      ...ring,
      score: next,
      delta: prev ? clamp(next - previous, -40, 40) : 0,
    };
  });
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

function categoryLabel(category: Finding["category"]): string {
  if (category === "agentsmd") return "project guidance";
  if (category === "claudemd") return "Claude guidance";
  if (category === "contextdoc") return "project context";
  if (category === "skill") return "skill routing";
  if (category === "prompthabit") return "prompt habit";
  return "guidance";
}

function alignmentHumanSignals(
  t: Totals,
  aggs: ProjectAgg[],
  findings: Finding[],
  reask: number,
  topic: string | undefined
): string[] {
  const signals: string[] = [];
  if (t.corrections > 0) {
    signals.push(`${t.corrections} correction signals (${reask}% re-ask)`);
  }
  const correctionProject = [...aggs]
    .filter((agg) => agg.corrections > 0)
    .sort((a, b) => b.corrections - a.corrections)[0];
  if (correctionProject) {
    signals.push(
      `${correctionProject.name}: ${correctionProject.corrections} correction${correctionProject.corrections === 1 ? "" : "s"} across ${correctionProject.userTurns} user turn${correctionProject.userTurns === 1 ? "" : "s"}`
    );
  }
  const primaryFinding = findings.find((finding) => finding.frictionType);
  if (primaryFinding) {
    const gap = primaryFinding.configGap || primaryFinding.title;
    signals.push(
      `Best fix found: ${categoryLabel(primaryFinding.category)} - ${quote(gap, 72)}`
    );
  }
  if (topic) signals.push(`Main thread: ${topic}`);
  if (signals.length === 0) {
    signals.push(
      `${t.sessions} session${t.sessions === 1 ? "" : "s"} reviewed`
    );
    signals.push(
      `${t.userTurns} user turn${t.userTurns === 1 ? "" : "s"} checked`
    );
  }
  return [...new Set(signals)].slice(0, 3);
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
  const humanSignals = alignmentHumanSignals(t, aggs, findings, reask, topic);
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
      signals: humanSignals,
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
): ReviewWindow {
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
    basis === "since-last-review" ? `Since ${fmtTime(start)}` : "Last 24 hours";
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
): HealthReport["contextHealth"] {
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

function provenanceFor(input: {
  mode: ReviewProvenance["mode"];
  generator: ReviewProvenance["generator"];
  sources: AnalysisSource[];
  now: number;
  insight?: InsightAnalysisResult | null;
  insightConfigured: boolean;
}): ReviewProvenance {
  const cli =
    input.insight != null
      ? {
          invoked: true,
          status: input.insight.error
            ? ("failed" as const)
            : ("executed" as const),
          runner: input.insight.redactionPreview.runner,
          model: input.insight.redactionPreview.model,
          redactions: input.insight.redactionPreview.redactions,
          payloadChars: input.insight.redactionPreview.payloadChars,
          projects: input.insight.redactionPreview.projects,
          error: input.insight.error,
        }
      : {
          invoked: false,
          status: input.insightConfigured
            ? ("skipped" as const)
            : ("not-required" as const),
        };
  return {
    mode: input.mode,
    generator: input.generator,
    usedSampleData: false,
    sources: input.sources,
    generatedAt: input.now,
    cli,
  };
}

function noDataReport(now: number, kind: HealthReviewKind): HealthReport {
  const start = now - DAY_MS;
  const window = computeWindow([], start, now, "last-24h");
  const totals: Totals = {
    sessions: 0,
    turns: 0,
    userTurns: 0,
    corrections: 0,
    toolCalls: 0,
    toolFailures: 0,
    hedges: 0,
  };
  const rings = makeRings(totals, null);
  return {
    id: `review_${now}`,
    timestamp: now,
    kind,
    reviewStatus: "unreviewed",
    rangeLabel: "Real mode · no projects",
    sessions: 0,
    projects: 0,
    harness: "Real local data",
    digest:
      "No enabled projects are selected, so this real Health Review ended without demo data or sample fixtures.",
    rings,
    metrics: makeMetrics(totals, [], 0),
    findings: [],
    experiments: [],
    window,
    projectInsights: [],
    alignment: {
      score: rings.find((ring) => ring.key === "alignment")?.score ?? 80,
      band: "collaborating",
      human: {
        mood: "deep-focus",
        question: "Which projects should Harness Health measure?",
        signals: ["0 enabled projects", "demo mode off"],
      },
      agent: {
        mood: "confident",
        question: "Where should I read real local agent sessions from?",
        signals: ["No demo data used"],
      },
      friction: [],
    },
    provenance: provenanceFor({
      mode: "real",
      generator: "no-data",
      sources: [],
      now,
      insightConfigured: false,
    }),
  };
}

function quietReport(
  window: ReviewWindow,
  projects: AnalysisProject[],
  prev: HealthReport | null,
  now: number,
  aggs: ProjectAgg[]
): HealthReport {
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
  const findings = contextFindings;
  const insights = projectInsightsOf(aggs);
  const contextHealth = contextSummaryOf(insights);
  const digest =
    contextFindings.length > 0
      ? `No new agent activity, but the context review found ${contextFindings.length} cleanup recommendation${contextFindings.length === 1 ? "" : "s"} across ${insights.length} tracked project${insights.length === 1 ? "" : "s"}.`
      : "No new agent activity in this window. The Health Review stayed quiet — nothing to accept or change.";
  return {
    id: `review_${now}`,
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
    provenance: provenanceFor({
      mode: "real",
      generator: "local-ingest",
      sources: [...new Set(enabled.flatMap((project) => project.sources))],
      now,
      insightConfigured: false,
    }),
  };
}

/**
 * Run a full Health Review over the enabled projects' windowed activity.
 * Always returns a real report. With no projects or no activity, the report is
 * explicit about that state instead of falling back to demo/sample data.
 */
export function runHealthReview(
  projects: AnalysisProject[],
  options: ReviewOptions = {}
): HealthReport {
  const now = options.now ?? Date.now();
  const enabled = projects.filter((project) => project.enabled);
  if (enabled.length === 0) return noDataReport(now, options.kind ?? "full");

  const prev = options.prev ?? null;
  const isQuick = options.kind === "quick";
  const floor = now - DAY_MS;
  const since = options.since ?? null;
  // A quick review covers just this morning; a full review covers since the last review (24h cap).
  const start = isQuick
    ? Math.max(startOfDay(now), floor)
    : since && since > floor
      ? since
      : floor;
  const basis: WindowBasis =
    isQuick || (since && since > floor) ? "since-last-review" : "last-24h";

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
  const shouldRunInsight = !isQuick && Boolean(options.insightRunner);
  const insight =
    shouldRunInsight && options.insightRunner
      ? runInsightAnalysis(
          enabled,
          boundedSessions,
          options.analysisDepth ?? "standard",
          options.insightRunner
        )
      : null;
  const insightSucceeded = insight != null && !insight.error;
  const heuristicFindings = selectFindings(aggs);
  const allFindings = insightSucceeded ? insight.findings : heuristicFindings;
  // A quick review surfaces only the top couple of quick wins.
  const findings = isQuick ? allFindings.slice(0, 2) : allFindings;
  const rings = makeRingsFromInsight(totals, prev, insight);
  const alignmentScore =
    rings.find((ring) => ring.key === "alignment")?.score ?? 70;
  const insights = projectInsightsOf(aggs);
  const contextHealth = contextSummaryOf(insights);
  const sources: AnalysisSource[] = [
    ...new Set(aggs.flatMap((agg) => [...agg.sources])),
  ];
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
  const fallbackDigest =
    recCount > 0
      ? `${bandPhrase} — alignment ${alignmentScore}. ${recCount} improvement${recCount === 1 ? "" : "s"} to review from ${totals.sessions} session${totals.sessions === 1 ? "" : "s"}${focus}.`
      : `${bandPhrase} — alignment ${alignmentScore}. ${totals.sessions} session${totals.sessions === 1 ? "" : "s"} reviewed, nothing to change.`;
  const digest =
    insightSucceeded && insight.digest ? insight.digest : fallbackDigest;

  return {
    id: `review_${now}`,
    timestamp: now,
    kind: options.kind ?? "full",
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
    cloudRedactionPreview: insight
      ? { ...insight.redactionPreview, error: insight.error }
      : undefined,
    provenance: provenanceFor({
      mode: "real",
      generator: "local-ingest",
      sources,
      now,
      insight,
      insightConfigured: shouldRunInsight,
    }),
  };
}
