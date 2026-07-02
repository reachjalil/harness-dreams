import type {
  ActionCategory,
  AlignmentBand,
  AlignmentDetail,
  HealthReport,
  Experiment,
  Finding,
  FindingType,
  FrictionType,
  Metric,
  Ring,
} from "./types";

type SerializedDate = string | { $date?: string };

interface HealthLogRecommendation {
  target?: string;
  action?: string;
  reason?: string;
}

interface HealthLogFriction {
  type?: string;
  description?: string;
  evidence?: string;
}

interface HealthLogFrictionDelta {
  description?: string;
  status?: string;
  days_persisting?: number;
}

interface HealthLogMindNode {
  topic?: string;
  weight?: number;
  is_new?: boolean;
}

interface HealthLogModelUsage {
  source?: string;
  model?: string;
  session_count?: number;
}

interface HealthLogEntry {
  _id?: { $oid?: string };
  date?: string;
  acted_on_recommendations?: string[];
  agent_mood?: { label?: string; summary?: string; evidence?: string };
  agent_question?: { question?: string; evidence?: string };
  alignment_label?: string;
  alignment_score?: number;
  friction_deltas?: HealthLogFrictionDelta[];
  friction_points?: HealthLogFriction[];
  mind_map_nodes?: HealthLogMindNode[];
  model_usage?: HealthLogModelUsage[];
  recommendations?: HealthLogRecommendation[];
  seven_day_pattern?: Array<{
    date?: string;
    alignment_score?: number;
    alignment_label?: string;
  }>;
  synthesis_context?: string;
  synthesized_at?: SerializedDate;
}

const FRICTION_TYPE: Record<string, FrictionType> = {
  "config-conflict": "config-conflict",
  "missing-skill": "missing-skill",
  "unclear-prompt": "unclear-prompt",
  "wrong-domain": "wrong-domain",
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function pct(score: number | undefined): number {
  if (typeof score !== "number" || !Number.isFinite(score)) return 50;
  return score <= 1 ? clamp(score * 100) : clamp(score);
}

function bandFor(score: number): AlignmentBand {
  if (score >= 80) return "collaborating";
  if (score >= 45) return "friction";
  return "fighting";
}

function parseDate(
  value: SerializedDate | undefined,
  fallback: number
): number {
  const raw = typeof value === "string" ? value : value?.$date;
  const parsed = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function short(text: string, max = 94): string {
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function categoryFor(target: string | undefined): ActionCategory {
  const normalized = (target ?? "").toLowerCase();
  if (normalized.includes("agent")) return "agentsmd";
  if (normalized.includes("mcp") || normalized.includes("skill"))
    return "skill";
  if (normalized.includes("workflow")) return "prompthabit";
  return "contextdoc";
}

function frictionTypeFor(type: string | undefined): FrictionType {
  return FRICTION_TYPE[(type ?? "").toLowerCase()] ?? "wrong-domain";
}

function findingTypeFor(category: ActionCategory, reason: string): FindingType {
  const lower = reason.toLowerCase();
  if (lower.includes("failed") || lower.includes("breakdown")) return "risk";
  if (lower.includes("persisted") || lower.includes("friction")) {
    return "mistake";
  }
  return category === "agentsmd" ? "opportunity" : "risk";
}

function makeRings(entry: HealthLogEntry): Ring[] {
  const alignment = pct(entry.alignment_score);
  const frictionCount = entry.friction_points?.length ?? 0;
  const persistent = (entry.friction_deltas ?? []).filter(
    (delta) => delta.status === "persisting"
  ).length;
  const toolFailures = (entry.friction_points ?? []).filter(
    (point) => point.type === "missing-skill"
  ).length;
  return [
    {
      key: "efficiency",
      label: "Efficiency",
      score: clamp(82 - frictionCount * 5 - toolFailures * 8),
      delta: -clamp(toolFailures * 4 + persistent * 2, 0, 40),
      hint: "Tool retries, latency, and avoidable rework",
    },
    {
      key: "effectiveness",
      label: "Effectiveness",
      score: clamp(
        78 - persistent * 7 + (entry.acted_on_recommendations?.length ?? 0) * 4
      ),
      delta: clamp(
        (entry.acted_on_recommendations?.length ?? 0) * 3 - persistent * 4,
        -40,
        40
      ),
      hint: "Recommendations acted on vs. recurring issues",
    },
    {
      key: "alignment",
      label: "Alignment",
      score: alignment,
      delta: Math.round(
        alignment -
          pct(
            entry.seven_day_pattern?.[0]?.alignment_score ??
              entry.alignment_score
          )
      ),
      hint: "Human intent and agent behavior agreement",
    },
  ];
}

function makeMetrics(entry: HealthLogEntry): Metric[] {
  const friction = entry.friction_points?.length ?? 0;
  const recs = entry.recommendations?.length ?? 0;
  const persisting = (entry.friction_deltas ?? []).filter(
    (delta) => delta.status === "persisting"
  ).length;
  const toolFailures = (entry.friction_points ?? []).filter(
    (point) => point.type === "missing-skill"
  ).length;
  const sessions = Math.max(
    1,
    (entry.model_usage ?? []).reduce(
      (sum, item) => sum + (item.session_count ?? 0),
      0
    ) || recs + friction
  );
  const reask = clamp(friction * 9 + persisting * 4, 0, 99);
  const toolSuccess = clamp(100 - toolFailures * 18 - friction * 2);

  return [
    {
      key: "reask",
      label: "Re-ask rate",
      value: `${reask}%`,
      delta: persisting * 3,
      trend: reask > 18 ? "up" : "down",
      good: reask <= 18,
    },
    {
      key: "tool_success",
      label: "Tool success",
      value: `${toolSuccess}%`,
      delta: -toolFailures * 8,
      trend: toolFailures > 0 ? "down" : "flat",
      good: toolSuccess >= 90,
    },
    {
      key: "tokens_per_change",
      label: "Rework load",
      value: `${friction}`,
      delta: friction - recs,
      trend: friction > recs ? "up" : "down",
      good: friction <= recs,
    },
    {
      key: "cache",
      label: "Context reuse",
      value: `${clamp(72 - persisting * 7 + (entry.acted_on_recommendations?.length ?? 0) * 6)}%`,
      delta: (entry.acted_on_recommendations?.length ?? 0) * 4 - persisting * 3,
      trend: persisting > 0 ? "down" : "up",
      good: persisting === 0,
    },
    {
      key: "recommendations",
      label: "Recommendations",
      value: `${recs}`,
      delta: recs,
      trend: "up",
      good: recs > 0,
    },
    {
      key: "sessions",
      label: "Evidence items",
      value: `${sessions}`,
      delta: 0,
      trend: "flat",
      good: true,
    },
  ];
}

function recommendationFinding(
  rec: HealthLogRecommendation,
  index: number,
  friction: HealthLogFriction | undefined
): Finding {
  const category = categoryFor(rec.target);
  const action = rec.action ?? "Review and tighten the agent workflow.";
  const reason = rec.reason ?? "The Health Review found recurring friction.";
  const frictionType = frictionTypeFor(friction?.type);
  return {
    id: `real_rec_${index + 1}`,
    type: findingTypeFor(category, reason),
    title: short(action, 72),
    body: reason,
    improvement: action,
    agentBenefit:
      category === "agentsmd"
        ? "The agent starts with durable local guidance before choosing tools or plans."
        : "The agent gets a clearer execution path and fewer ambiguous state transitions.",
    userBenefit:
      "You spend fewer turns correcting assumptions, repeated questions, or missed state.",
    reflection:
      "The next Health Review should verify whether this recommendation was applied and whether the same friction persisted.",
    confidence: friction ? "high" : "medium",
    project: rec.target ?? "workflow",
    evidence: friction?.evidence ?? friction?.description ?? reason,
    action,
    category,
    frictionType,
  };
}

function fallbackFinding(point: HealthLogFriction, index: number): Finding {
  return {
    id: `real_friction_${index + 1}`,
    type: point.type === "missing-skill" ? "risk" : "mistake",
    title: short(point.description ?? "Friction point"),
    body: point.description ?? "The Health Review found a collaboration issue.",
    improvement: "Convert the failure mode into explicit workflow guidance.",
    agentBenefit: "The agent can avoid repeating the same failure mode.",
    userBenefit: "You get fewer corrections on similar work.",
    reflection: "Watch whether this friction point appears again tomorrow.",
    confidence: "medium",
    project: point.type ?? "workflow",
    evidence:
      point.evidence ?? point.description ?? "Health log friction point",
    action: "Track and document this friction point",
    category: "contextdoc",
    frictionType: frictionTypeFor(point.type),
  };
}

function makeFindings(entry: HealthLogEntry): Finding[] {
  const friction = entry.friction_points ?? [];
  const fromRecommendations = (entry.recommendations ?? []).map((rec, index) =>
    recommendationFinding(rec, index, friction[index])
  );
  if (fromRecommendations.length > 0) return fromRecommendations;
  return friction.map(fallbackFinding);
}

function makeExperiments(entry: HealthLogEntry): Experiment[] {
  return (entry.acted_on_recommendations ?? []).map((action, index) => ({
    id: `acted_${index + 1}`,
    title: short(action.replace(/^\[[^\]]+\]\s*/, ""), 82),
    hypothesis:
      "Acted-on recommendations should reduce repeated corrections in future Reviews.",
    agentBenefit:
      "The harness can compare future behavior against an already-applied recommendation.",
    userBenefit:
      "You can see whether prior changes actually improved collaboration.",
    reflection:
      "Keep measuring repeated friction, re-ask rate, and tool failure rate.",
    metric: "friction recurrence · re-ask rate · tool success",
    status: "running",
    progress: 0.2,
    progressLabel: "1 / 5 reviews",
  }));
}

function makeAlignment(
  entry: HealthLogEntry,
  findings: Finding[],
  score: number
): AlignmentDetail {
  return {
    score,
    band: bandFor(score),
    human: {
      mood: score < 45 ? "frustrated" : "scattered",
      question:
        "How do I keep agent execution aligned with the product loop without repeated corrections?",
      signals: (entry.friction_deltas ?? [])
        .slice(0, 3)
        .map((delta) => delta.description ?? "Recurring friction"),
    },
    agent: {
      mood: entry.agent_mood?.label ?? "uncertain",
      question:
        entry.agent_question?.question ?? "What should be optimized next?",
      signals: [
        entry.agent_mood?.summary,
        entry.agent_question?.evidence,
        entry.agent_mood?.evidence,
      ].filter((item): item is string => Boolean(item)),
    },
    friction: findings
      .filter((finding) => finding.frictionType)
      .map((finding) => ({
        type: finding.frictionType ?? "wrong-domain",
        example: finding.evidence,
        findingId: finding.id,
      })),
  };
}

export function reportsFromHealthLogs(
  input: unknown,
  now = Date.now()
): HealthReport[] {
  const entries = Array.isArray(input) ? (input as HealthLogEntry[]) : [];
  return entries
    .map((entry, index) => {
      const timestamp = parseDate(
        entry.synthesized_at,
        now - index * 86_400_000
      );
      const date = entry.date ?? new Date(timestamp).toISOString().slice(0, 10);
      const findings = makeFindings(entry);
      const rings = makeRings(entry);
      const alignmentScore =
        rings.find((ring) => ring.key === "alignment")?.score ??
        pct(entry.alignment_score);
      const topics = (entry.mind_map_nodes ?? [])
        .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
        .slice(0, 3)
        .map((node) => node.topic)
        .filter((topic): topic is string => Boolean(topic));
      return {
        id: `health_log_${entry._id?.$oid ?? date}`,
        timestamp,
        reviewStatus:
          index === 0 ? ("unreviewed" as const) : ("reviewed" as const),
        reviewedAt: index === 0 ? undefined : timestamp + 1_800_000,
        rangeLabel: `${date} · ${findings.length} recommendation${findings.length === 1 ? "" : "s"}`,
        sessions: Math.max(
          1,
          findings.length + (entry.acted_on_recommendations?.length ?? 0)
        ),
        projects: new Set(findings.map((finding) => finding.project)).size,
        harness: "Codex execution review",
        digest:
          entry.synthesis_context ??
          `Health Review found ${findings.length} recommendation${findings.length === 1 ? "" : "s"} across ${topics.join(", ") || "the active workflow"}.`,
        rings,
        metrics: makeMetrics(entry),
        findings,
        experiments: makeExperiments(entry),
        alignment: makeAlignment(entry, findings, alignmentScore),
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}
