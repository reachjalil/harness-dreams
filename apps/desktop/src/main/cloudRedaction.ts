import type {
  ActionQueueEntry,
  AlignmentDetail,
  DreamReport,
  Finding,
  ProjectInsight,
} from "../shared/types";

const LOCAL_EVIDENCE = "Evidence retained locally on desktop.";

const SECRET_RE =
  /\b(sk-[A-Za-z0-9_-]{20,}|[A-Za-z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD)[A-Za-z0-9_]*\s*[:=]\s*["']?[^"'\s]+|gh[pousr]_[A-Za-z0-9_]{20,})\b/g;
const ABSOLUTE_PATH_RE =
  /(?:\/Users\/[^\s"'`),;]+|\/home\/[^\s"'`),;]+|\/var\/folders\/[^\s"'`),;]+|~\/[^\s"'`),;]+|[A-Za-z]:\\[^\s"'`),;]+)/g;
const CODE_FENCE_RE = /```[\s\S]*?```/g;

function safeText(value: string): string;
function safeText(value: undefined): undefined;
function safeText(value: string | undefined): string | undefined;
function safeText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value
    .replace(CODE_FENCE_RE, "[redacted code block]")
    .replace(SECRET_RE, "[redacted secret]")
    .replace(ABSOLUTE_PATH_RE, "[redacted path]");
}

export function sanitizeCloudText(value: string): string {
  return safeText(value);
}

function safeTextArray(values: string[]): string[] {
  return values.map((value) => safeText(value));
}

function sanitizeFinding(finding: Finding): unknown {
  const {
    evidence: _evidence,
    evidenceFile: _evidenceFile,
    projectPath: _projectPath,
    patch: _patch,
    ...safe
  } = finding;
  return {
    ...safe,
    title: safeText(safe.title),
    body: safeText(safe.body),
    improvement: safeText(safe.improvement),
    agentBenefit: safeText(safe.agentBenefit),
    userBenefit: safeText(safe.userBenefit),
    reflection: safeText(safe.reflection),
    project: safeText(safe.project),
    configGap: safe.configGap ? safeText(safe.configGap) : undefined,
    action: safeText(safe.action),
    evidence: LOCAL_EVIDENCE,
  };
}

function sanitizeDecision(
  entry: ActionQueueEntry
): Omit<ActionQueueEntry, "projectPath" | "patch" | "reviewBranch"> {
  const {
    projectPath: _projectPath,
    patch: _patch,
    reviewBranch: _reviewBranch,
    ...safe
  } = entry;
  return {
    ...safe,
    action: safeText(safe.action),
    project: safeText(safe.project),
  };
}

function sanitizeAlignment(alignment: AlignmentDetail): AlignmentDetail {
  return {
    ...alignment,
    human: {
      ...alignment.human,
      question: safeText(alignment.human.question),
      signals: safeTextArray(alignment.human.signals),
    },
    agent: {
      ...alignment.agent,
      question: safeText(alignment.agent.question),
      signals: safeTextArray(alignment.agent.signals),
    },
    friction: alignment.friction.map((point) => ({
      ...point,
      example: LOCAL_EVIDENCE,
    })),
  };
}

function sanitizeProjectInsight(insight: ProjectInsight): unknown {
  const { path: _path, contextHealth, ...safe } = insight;
  return {
    ...safe,
    name: safeText(safe.name),
    sources: safe.sources.map((source) => safeText(source)),
    topics: safeTextArray(safe.topics),
    contextHealth: contextHealth
      ? {
          ...contextHealth,
          risks: safeTextArray(contextHealth.risks),
          suggestions: safeTextArray(contextHealth.suggestions),
          oversizedFiles: contextHealth.oversizedFiles.map(
            ({ path: _sourcePath, ...source }) => ({
              ...source,
              label: safeText(source.label),
            })
          ),
        }
      : undefined,
  };
}

function sanitizeRedactionPreview(
  preview: DreamReport["cloudRedactionPreview"]
): DreamReport["cloudRedactionPreview"] {
  if (!preview) return undefined;
  const [provider] = preview.runner.split(":");
  return {
    ...preview,
    runner:
      provider && provider !== preview.runner ? safeText(provider) : "runner",
    model: safeText(preview.model),
  };
}

export function sanitizeReportForCloud(report: DreamReport): unknown {
  return {
    id: report.id,
    timestamp: report.timestamp,
    reviewStatus: report.reviewStatus,
    reviewedAt: report.reviewedAt,
    rangeLabel: safeText(report.rangeLabel),
    sessions: report.sessions,
    projects: report.projects,
    harness: safeText(report.harness),
    digest: safeText(report.digest),
    rings: report.rings.map((ring) => ({
      ...ring,
      label: safeText(ring.label),
      hint: safeText(ring.hint),
    })),
    metrics: report.metrics.map((metric) => ({
      ...metric,
      label: safeText(metric.label),
      value: safeText(metric.value),
    })),
    findings: report.findings.map(sanitizeFinding),
    experiments: report.experiments.map(({ projectPath: _path, ...safe }) => ({
      ...safe,
      title: safeText(safe.title),
      hypothesis: safeText(safe.hypothesis),
      agentBenefit: safeText(safe.agentBenefit),
      userBenefit: safeText(safe.userBenefit),
      reflection: safeText(safe.reflection),
      metric: safeText(safe.metric),
      progressLabel: safeText(safe.progressLabel),
      verdictNote: safeText(safe.verdictNote),
    })),
    reviewDecisions: report.reviewDecisions?.map(sanitizeDecision),
    alignment: report.alignment
      ? sanitizeAlignment(report.alignment)
      : undefined,
    window: report.window
      ? {
          ...report.window,
          label: safeText(report.window.label),
        }
      : undefined,
    projectInsights: report.projectInsights?.map(sanitizeProjectInsight),
    contextHealth: report.contextHealth
      ? {
          ...report.contextHealth,
          suggestions: safeTextArray(report.contextHealth.suggestions),
        }
      : undefined,
    cloudRedactionPreview: sanitizeRedactionPreview(
      report.cloudRedactionPreview
    ),
  };
}
