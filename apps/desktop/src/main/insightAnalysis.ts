import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type {
  ActionCategory,
  AnalysisDepth,
  AnalysisProject,
  Finding,
  InsightRunnerConfig,
  RingKey,
} from "../shared/types";
import {
  agentsPatch,
  claudePatch,
  contextRulesPatch,
  readProjectConfig,
  skillPatch,
} from "./agentConfig";
import type { LocalSession } from "./localIngest";

const MAX_TURNS_PER_PROJECT = 80;
const MAX_TURN_CHARS = 1400;
const MAX_ERROR_CHARS = 1400;
const SECRET_RE =
  /\b(sk-[A-Za-z0-9_-]{20,}|[A-Za-z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD)[A-Za-z0-9_]*\s*[:=]\s*["']?[^"'\s]+|gh[pousr]_[A-Za-z0-9_]{20,})\b/g;

interface InsightProjectPayload {
  path: string;
  name: string;
  config: {
    agentsMd: string;
    claudeMd: string;
    skills: Array<{ name: string; file: string; content: string }>;
    contextHealth: {
      score: number;
      status: string;
      totalChars: number;
      projectChars: number;
      globalChars: number;
      memoryFiles: number;
      skillCount: number;
      risks: string[];
      suggestions: string[];
      sources: Array<{
        kind: string;
        label: string;
        chars: number;
        lines: number;
      }>;
    };
  };
  turns: Array<{
    sessionId: string;
    file: string;
    kind: string;
    timestamp: string;
    content: string;
  }>;
}

interface InsightJsonFinding {
  title?: string;
  body?: string;
  evidenceQuote?: string;
  configGap?: string;
  target?: "agentsmd" | "claudemd" | "contextdoc" | "skill";
  ruleOrDescription?: string;
  skillName?: string;
}

interface InsightJson {
  digest?: string;
  alignmentScore?: number;
  efficiencyScore?: number;
  effectivenessScore?: number;
  findings?: InsightJsonFinding[];
}

export interface InsightAnalysisResult {
  findings: Finding[];
  digest?: string;
  scores?: Partial<Record<RingKey, number>>;
  redactionPreview: {
    runner: string;
    model: string;
    redactions: number;
    payloadChars: number;
    projects: number;
  };
  error?: string;
}

function short(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

function redact(text: string, count: { value: number }): string {
  return text.replace(SECRET_RE, () => {
    count.value += 1;
    return "[REDACTED]";
  });
}

function runnerErrorSummary(
  error: Error | undefined,
  stderr: string,
  status: number | null
): string {
  if (error) return short(error.message, MAX_ERROR_CHARS);
  const diagnosticLines = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        /\b(ERROR|WARN|not supported|exited|failed|permission|trusted|auth|invalid_request_error)\b/i.test(
          line
        ) && !line.startsWith('{"projects"')
    )
    .slice(-12);
  if (diagnosticLines.length > 0) {
    return short(diagnosticLines.join("\n"), MAX_ERROR_CHARS);
  }
  return `runner exited ${status}`;
}

function resolveBinary(
  provider: InsightRunnerConfig["provider"],
  configured: string
): string {
  if (
    configured &&
    configured !== (provider === "codex" ? "codex" : "claude")
  ) {
    return configured;
  }
  const home = os.homedir();
  const candidates =
    provider === "codex"
      ? [
          process.env.HARNESS_HEALTH_CODEX_BIN,
          process.env.CODEX_BIN,
          path.join(
            home,
            ".codex",
            "packages",
            "standalone",
            "current",
            "bin",
            "codex"
          ),
          path.join(home, ".local", "bin", "codex"),
          process.platform === "darwin"
            ? "/Applications/Codex.app/Contents/Resources/codex"
            : "",
          "codex",
        ]
      : [
          process.env.HARNESS_HEALTH_CLAUDE_BIN,
          process.env.CLAUDE_BIN,
          path.join(home, ".local", "bin", "claude"),
          "claude",
        ];
  return (
    candidates.filter(Boolean).find((candidate) => {
      if (!candidate || candidate === "codex" || candidate === "claude")
        return true;
      return existsSync(candidate);
    }) ?? configured
  );
}

function safeIsDirectory(file: string): boolean {
  try {
    return statSync(file).isDirectory();
  } catch {
    return false;
  }
}

function runnerCwd(projects: AnalysisProject[]): string {
  return (
    projects
      .filter((project) => project.enabled)
      .map((project) => project.path)
      .find(
        (projectPath) => existsSync(projectPath) && safeIsDirectory(projectPath)
      ) ?? os.homedir()
  );
}

function promptFor(
  payload: InsightProjectPayload[],
  depth: AnalysisDepth
): string {
  return [
    "You are the Harness Health review analyzer. Return only valid JSON.",
    "Analyze real windowed coding-agent turns plus project AGENTS.md, CLAUDE.md, and skills.",
    "Also inspect contextHealth, which summarizes project files, Claude home memory, Codex home context, rules.md, and skill counts.",
    "Find config-versus-behavior gaps where a durable rule, context doc, or skill would reduce future friction.",
    "Requirements:",
    "- Return at most 3 findings.",
    "- Build digest, alignmentScore, efficiencyScore, and effectivenessScore from the provided real turns only.",
    "- Scores must be integers from 0 to 100.",
    "- Suggest an improvement only when it would change future agent behavior, reduce repeated user correction, or preserve a durable project convention.",
    "- Prefer file-backed improvements: AGENTS.md rules for project behavior, CLAUDE.md rules for Claude-specific behavior, rules.md/context docs for durable project context, and skills for repeated workflows.",
    "- Do not suggest vague habits. ruleOrDescription must be specific enough that it can be written into the target file exactly as-is.",
    "- If the evidence only shows a one-off task with no reusable lesson, return no finding for it.",
    "- Every finding must include evidenceQuote copied verbatim from a provided turn.",
    "- Name the specific configGap.",
    "- target must be agentsmd, claudemd, contextdoc, or skill.",
    "- ruleOrDescription must be an exact apply-ready rule/description, not generic advice.",
    `Analysis depth: ${depth}.`,
    'JSON shape: {"digest":"","alignmentScore":0,"efficiencyScore":0,"effectivenessScore":0,"findings":[{"title":"","body":"","evidenceQuote":"","configGap":"","target":"agentsmd|claudemd|contextdoc|skill","ruleOrDescription":"","skillName":""}]}',
    "",
    JSON.stringify({ projects: payload }),
  ].join("\n");
}

function argvFor(config: InsightRunnerConfig, prompt: string): string[] {
  if (config.provider === "codex") {
    return ["exec", ...(config.model ? ["--model", config.model] : []), prompt];
  }
  return [
    "-p",
    "--output-format",
    "json",
    ...(config.model ? ["--model", config.model] : []),
    prompt,
  ];
}

function parseJson(stdout: string): InsightJson | null {
  try {
    const parsed = JSON.parse(stdout) as unknown;
    if (parsed && typeof parsed === "object" && "result" in parsed) {
      const result = (parsed as { result?: unknown }).result;
      if (typeof result === "string") return parseJson(result);
    }
    return parsed && typeof parsed === "object"
      ? (parsed as InsightJson)
      : null;
  } catch {
    const match = stdout.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as InsightJson;
    } catch {
      return null;
    }
  }
}

function scoreFrom(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoresFrom(parsed: InsightJson): Partial<Record<RingKey, number>> {
  const scores: Partial<Record<RingKey, number>> = {};
  const alignment = scoreFrom(parsed.alignmentScore);
  const efficiency = scoreFrom(parsed.efficiencyScore);
  const effectiveness = scoreFrom(parsed.effectivenessScore);
  if (alignment != null) scores.alignment = alignment;
  if (efficiency != null) scores.efficiency = efficiency;
  if (effectiveness != null) scores.effectiveness = effectiveness;
  return scores;
}

function categoryFor(target: InsightJsonFinding["target"]): ActionCategory {
  if (target === "claudemd") return "claudemd";
  if (target === "contextdoc") return "contextdoc";
  if (target === "skill") return "skill";
  return "agentsmd";
}

function makePayload(
  projects: AnalysisProject[],
  sessions: LocalSession[]
): { payload: InsightProjectPayload[]; redactions: number } {
  const count = { value: 0 };
  const byProject = new Map<string, LocalSession[]>();
  for (const session of sessions) {
    byProject.set(session.projectPath, [
      ...(byProject.get(session.projectPath) ?? []),
      session,
    ]);
  }
  const payload = projects
    .filter((project) => project.enabled && byProject.has(project.path))
    .map((project) => {
      const config = readProjectConfig(project.path);
      const turns = (byProject.get(project.path) ?? [])
        .flatMap((session) =>
          session.turns
            .filter((turn) => turn.kind !== "tool_result")
            .map((turn) => ({
              sessionId: session.id,
              file: session.rawPath,
              kind: turn.kind,
              timestamp: new Date(turn.timestamp).toISOString(),
              content: redact(short(turn.content, MAX_TURN_CHARS), count),
            }))
        )
        .slice(-MAX_TURNS_PER_PROJECT);
      return {
        path: project.path,
        name: project.name,
        config: {
          agentsMd: redact(short(config.agentsMd, 6000), count),
          claudeMd: redact(short(config.claudeMd, 6000), count),
          skills: config.skillFiles.slice(0, 12).map((skill) => ({
            name: skill.name,
            file: skill.file,
            content: redact(short(skill.content, 3000), count),
          })),
          contextHealth: {
            score: config.contextHealth.score,
            status: config.contextHealth.status,
            totalChars: config.contextHealth.totalChars,
            projectChars: config.contextHealth.projectChars,
            globalChars: config.contextHealth.globalChars,
            memoryFiles: config.contextHealth.memoryFiles,
            skillCount: config.contextHealth.skillCount,
            risks: config.contextHealth.risks,
            suggestions: config.contextHealth.suggestions,
            sources: config.contextFiles.slice(0, 24).map((source) => ({
              kind: source.kind,
              label: source.label,
              chars: source.chars,
              lines: source.lines,
            })),
          },
        },
        turns,
      };
    });
  return { payload, redactions: count.value };
}

function findEvidence(
  quote: string,
  sessions: LocalSession[]
): { projectPath: string; project: string; file: string } | null {
  const needle = quote.trim();
  if (!needle) return null;
  for (const session of sessions) {
    if (session.turns.some((turn) => turn.content.includes(needle))) {
      return {
        projectPath: session.projectPath,
        project: session.projectName,
        file: session.rawPath,
      };
    }
  }
  return null;
}

function findingsFromJson(
  parsed: InsightJson,
  sessions: LocalSession[]
): Finding[] {
  const out: Finding[] = [];
  for (const [index, item] of (parsed.findings ?? []).entries()) {
    const quote = item.evidenceQuote?.trim() ?? "";
    const evidence = findEvidence(quote, sessions);
    if (!evidence) continue;
    const category = categoryFor(item.target);
    const config = readProjectConfig(evidence.projectPath);
    const rule =
      item.ruleOrDescription?.trim() ||
      item.configGap?.trim() ||
      "Add project guidance for this recurring friction.";
    const patch =
      category === "skill"
        ? skillPatch(
            config,
            item.skillName?.trim() || item.title?.trim() || "insight-analysis",
            rule,
            evidence.project
          )
        : category === "contextdoc"
          ? contextRulesPatch(config, rule, evidence.project)
          : category === "claudemd"
            ? claudePatch(config, rule, evidence.project)
            : agentsPatch(config, "agentsmd", rule, evidence.project);
    out.push({
      id: `insight-${index + 1}-${Buffer.from(evidence.projectPath).toString("hex").slice(0, 8)}`,
      type: category === "skill" ? "opportunity" : "mistake",
      title: short(item.title || item.configGap || "Insight finding", 72),
      body:
        item.body ||
        item.configGap ||
        "The insight pass found a config-versus-behavior gap.",
      improvement: rule,
      agentBenefit:
        "The CLI runner writes the missing durable instruction before the next session.",
      userBenefit: "You spend fewer turns correcting the same behavior.",
      reflection:
        "Whether alignment improves after this managed change is accepted.",
      confidence: "high",
      project: evidence.project,
      projectPath: evidence.projectPath,
      evidence: quote,
      evidenceFile: evidence.file,
      configGap: item.configGap,
      action:
        category === "skill" ? `Scaffold skill: ${rule}` : `Add rule: ${rule}`,
      category,
      frictionType: category === "skill" ? "missing-skill" : "config-conflict",
      patch,
    });
    if (out.length >= 3) break;
  }
  return out;
}

export function runInsightAnalysis(
  projects: AnalysisProject[],
  sessions: LocalSession[],
  depth: AnalysisDepth,
  config: InsightRunnerConfig
): InsightAnalysisResult | null {
  if (sessions.length === 0) return null;
  const { payload, redactions } = makePayload(projects, sessions);
  if (payload.length === 0) return null;
  const prompt = promptFor(payload, depth);
  const bin = resolveBinary(
    config.provider,
    config.provider === "codex" ? config.codexPath : config.claudePath
  );
  const args = argvFor(config, prompt);
  const proc = spawnSync(bin, args, {
    cwd: runnerCwd(projects),
    encoding: "utf8",
    timeout: config.timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, HARNESS_HEALTH_INSIGHT: "1" },
  });
  const preview = {
    runner: `${config.provider}:${bin}`,
    model: config.model,
    redactions,
    payloadChars: prompt.length,
    projects: payload.length,
  };
  if (proc.error || proc.status !== 0) {
    return {
      findings: [],
      redactionPreview: preview,
      error: runnerErrorSummary(proc.error, proc.stderr, proc.status),
    };
  }
  const parsed = parseJson(proc.stdout);
  if (!parsed) {
    return {
      findings: [],
      redactionPreview: preview,
      error: "runner did not return parseable JSON",
    };
  }
  return {
    findings: findingsFromJson(parsed, sessions),
    digest:
      typeof parsed.digest === "string" && parsed.digest.trim()
        ? short(parsed.digest, 260)
        : undefined,
    scores: scoresFrom(parsed),
    redactionPreview: preview,
  };
}
