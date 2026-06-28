import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type {
  ActionCategory,
  AnalysisDepth,
  AnalysisProject,
  Finding,
  RemRunnerConfig,
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
const SECRET_RE =
  /\b(sk-[A-Za-z0-9_-]{20,}|[A-Za-z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD)[A-Za-z0-9_]*\s*[:=]\s*["']?[^"'\s]+|gh[pousr]_[A-Za-z0-9_]{20,})\b/g;

interface RemProjectPayload {
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

interface RemJsonFinding {
  title?: string;
  body?: string;
  evidenceQuote?: string;
  configGap?: string;
  target?: "agentsmd" | "claudemd" | "contextdoc" | "skill";
  ruleOrDescription?: string;
  skillName?: string;
}

interface RemJson {
  findings?: RemJsonFinding[];
}

export interface RemAnalysisResult {
  findings: Finding[];
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

function resolveBinary(
  provider: RemRunnerConfig["provider"],
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
          process.env.HARNESS_DREAMS_CODEX_BIN,
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
          process.env.HARNESS_DREAMS_CLAUDE_BIN,
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

function promptFor(payload: RemProjectPayload[], depth: AnalysisDepth): string {
  return [
    "You are the Harness Dreams REM analyzer. Return only valid JSON.",
    "Analyze real windowed coding-agent turns plus project AGENTS.md, CLAUDE.md, and skills.",
    "Also inspect contextHealth, which summarizes project files, Claude home memory, Codex home context, rules.md, and skill counts.",
    "Find config-versus-behavior gaps where a durable rule, context doc, or skill would reduce future friction.",
    "Requirements:",
    "- Return at most 3 findings.",
    "- Every finding must include evidenceQuote copied verbatim from a provided turn.",
    "- Name the specific configGap.",
    "- target must be agentsmd, claudemd, contextdoc, or skill.",
    "- ruleOrDescription must be an exact apply-ready rule/description, not generic advice.",
    `Analysis depth: ${depth}.`,
    'JSON shape: {"findings":[{"title":"","body":"","evidenceQuote":"","configGap":"","target":"agentsmd|claudemd|contextdoc|skill","ruleOrDescription":"","skillName":""}]}',
    "",
    JSON.stringify({ projects: payload }),
  ].join("\n");
}

function argvFor(config: RemRunnerConfig, prompt: string): string[] {
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

function parseJson(stdout: string): RemJson | null {
  try {
    const parsed = JSON.parse(stdout) as unknown;
    if (parsed && typeof parsed === "object" && "result" in parsed) {
      const result = (parsed as { result?: unknown }).result;
      if (typeof result === "string") return parseJson(result);
    }
    return parsed && typeof parsed === "object" ? (parsed as RemJson) : null;
  } catch {
    const match = stdout.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as RemJson;
    } catch {
      return null;
    }
  }
}

function categoryFor(target: RemJsonFinding["target"]): ActionCategory {
  if (target === "claudemd") return "claudemd";
  if (target === "contextdoc") return "contextdoc";
  if (target === "skill") return "skill";
  return "agentsmd";
}

function makePayload(
  projects: AnalysisProject[],
  sessions: LocalSession[]
): { payload: RemProjectPayload[]; redactions: number } {
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
  parsed: RemJson,
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
            item.skillName?.trim() || item.title?.trim() || "rem-analysis",
            rule,
            evidence.project
          )
        : category === "contextdoc"
          ? contextRulesPatch(config, rule, evidence.project)
          : category === "claudemd"
            ? claudePatch(config, rule, evidence.project)
            : agentsPatch(config, "agentsmd", rule, evidence.project);
    out.push({
      id: `rem-${index + 1}-${Buffer.from(evidence.projectPath).toString("hex").slice(0, 8)}`,
      type: category === "skill" ? "opportunity" : "mistake",
      title: short(item.title || item.configGap || "REM finding", 72),
      body:
        item.body ||
        item.configGap ||
        "The REM pass found a config-versus-behavior gap.",
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

export function runRemAnalysis(
  projects: AnalysisProject[],
  sessions: LocalSession[],
  depth: AnalysisDepth,
  config: RemRunnerConfig
): RemAnalysisResult | null {
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
    cwd: os.homedir(),
    encoding: "utf8",
    timeout: config.timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, HARNESS_DREAMS_REM: "1" },
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
      error:
        proc.error?.message || proc.stderr || `runner exited ${proc.status}`,
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
    redactionPreview: preview,
  };
}
