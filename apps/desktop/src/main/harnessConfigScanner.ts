import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { ConfigArtifact, LiveInsight } from "../shared/types";

export interface ConfigScanInput {
  projectPaths: string[];
  workspacePath?: string;
  homeDir?: string;
  now?: number;
}

const MAX_SCAN_DEPTH = 6;
const MAX_FILE_BYTES = 512 * 1024;
const OVERSIZED_CONTEXT_CHARS = 24_000;

const SECRET_PATTERNS = [
  /\.env(?:\.|$)/i,
  /\.pem$/i,
  /\.key$/i,
  /settings\.local\.json$/i,
  /session[-_]env/i,
  /token/i,
  /credential/i,
  /secret/i,
  /auth/i,
];

const IGNORE_SEGMENTS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".turbo",
  ".vite",
  ".next",
  "coverage",
  "logs",
  "cache",
  "caches",
  "generated_images",
]);
const HOME_RUNTIME_SEGMENTS = new Set([
  "projects",
  "sessions",
  "archived_sessions",
  "logs",
  "todos",
  "statsig",
]);

const TARGET_ROOT_FILES = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "rules.md",
  "MEMORY.md",
  "memory.md",
]);

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function toId(filePath: string): string {
  return hashText(filePath);
}

function sourceFor(
  filePath: string,
  homeDir: string
): ConfigArtifact["source"] {
  if (filePath.startsWith(path.join(homeDir, ".harness"))) return "harness";
  if (filePath.startsWith(homeDir)) return "home";
  return "project";
}

function hasSecretPath(filePath: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(filePath));
}

function shouldSkipDir(dirPath: string, root: string): boolean {
  const rootBase = path.basename(root);
  if (rootBase === ".claude" || rootBase === ".codex") {
    const first = path.relative(root, dirPath).split(path.sep)[0];
    if (HOME_RUNTIME_SEGMENTS.has(first)) return true;
  }
  return dirPath
    .split(path.sep)
    .some((segment) => IGNORE_SEGMENTS.has(segment));
}

function classify(filePath: string): ConfigArtifact["kind"] | null {
  const normalized = filePath.split(path.sep).join("/");
  const base = path.basename(filePath);
  if (base === "AGENTS.md") return "agents-md";
  if (base === "CLAUDE.md") return "claude-md";
  if (base === "rules.md") return "rules";
  if (/memory\.md$/i.test(base) || normalized.includes("/memory/")) {
    return "memory";
  }
  if (normalized.includes("/.harness/")) return "harness";
  if (/\/\.agents\/skills\/[^/]+\/SKILL\.md$/.test(normalized)) {
    return "skill";
  }
  if (/\/\.claude\/skills\/[^/]+\/SKILL\.md$/.test(normalized)) {
    return "skill";
  }
  if (/mcp/i.test(base) && /\.(json|jsonc|toml|ya?ml)$/i.test(base)) {
    return "mcp";
  }
  if (/hook/i.test(base) && /\.(json|jsonc|toml|ya?ml|sh)$/i.test(base)) {
    return "hook";
  }
  if (
    /settings/i.test(base) &&
    /\.(json|jsonc|toml|ya?ml)$/i.test(base) &&
    !/local/i.test(base)
  ) {
    return "settings";
  }
  return null;
}

function shouldRead(filePath: string, root: string): boolean {
  if (hasSecretPath(filePath)) return false;
  const rel = path.relative(root, filePath).split(path.sep).join("/");
  const base = path.basename(filePath);
  if (TARGET_ROOT_FILES.has(base) && !rel.includes("/")) return true;
  if (rel.startsWith(".harness/")) return /\.(md|toml|json|jsonc)$/i.test(base);
  if (/^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(rel)) return true;
  if (/^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(rel)) return true;
  if (/^\.claude\/(commands|agents|hooks)\//.test(rel)) {
    return /\.(md|json|jsonc|toml|ya?ml|sh)$/i.test(base);
  }
  if (/^\.claude\/settings\.json$/.test(rel)) return true;
  return classify(filePath) != null;
}

async function collectFiles(
  root: string,
  maxDepth = MAX_SCAN_DEPTH
): Promise<string[]> {
  const out: string[] = [];

  async function walk(current: string, depth: number): Promise<void> {
    if (depth > maxDepth || shouldSkipDir(current, root)) return;
    let entries: Dirent[];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1);
        continue;
      }
      if (entry.isFile() && shouldRead(fullPath, root)) out.push(fullPath);
    }
  }

  await walk(root, 0);
  return out;
}

async function readArtifact(
  filePath: string,
  homeDir: string,
  now: number
): Promise<ConfigArtifact | null> {
  if (hasSecretPath(filePath)) return null;
  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size > MAX_FILE_BYTES) return null;
    const text = await readFile(filePath, "utf8");
    const lines = text.length === 0 ? 0 : text.split(/\r?\n/).length;
    return {
      id: toId(filePath),
      kind: classify(filePath) ?? "other",
      path: filePath,
      label: path.basename(filePath),
      chars: text.length,
      lines,
      hash: hashText(text),
      lastReadAt: now,
      source: sourceFor(filePath, homeDir),
    };
  } catch {
    return null;
  }
}

function uniqueExisting(paths: string[]): string[] {
  return [...new Set(paths.map((p) => path.resolve(p)))].filter((p) =>
    existsSync(p)
  );
}

export async function scanHarnessConfig(
  input: ConfigScanInput
): Promise<ConfigArtifact[]> {
  const now = input.now ?? Date.now();
  const homeDir = input.homeDir ?? os.homedir();
  const roots = uniqueExisting([
    input.workspacePath ?? process.cwd(),
    ...input.projectPaths,
    path.join(homeDir, ".harness"),
    path.join(homeDir, ".claude"),
    path.join(homeDir, ".agents"),
    path.join(homeDir, ".codex"),
  ]);
  const files = (
    await Promise.all(
      roots.map((root) =>
        collectFiles(root, root === homeDir ? 3 : MAX_SCAN_DEPTH)
      )
    )
  ).flat();
  const artifacts = (
    await Promise.all(
      files.map((filePath) => readArtifact(filePath, homeDir, now))
    )
  ).filter((artifact): artifact is ConfigArtifact => artifact != null);
  return artifacts.sort((a, b) => a.path.localeCompare(b.path));
}

export function configArtifactInsights(
  artifacts: ConfigArtifact[],
  now = Date.now()
): LiveInsight[] {
  const insights: LiveInsight[] = [];
  const contextArtifacts = artifacts.filter((artifact) =>
    ["agents-md", "claude-md", "rules", "memory", "skill", "harness"].includes(
      artifact.kind
    )
  );
  const totalChars = contextArtifacts.reduce(
    (sum, artifact) => sum + artifact.chars,
    0
  );
  const oversized = contextArtifacts.filter(
    (artifact) => artifact.chars >= OVERSIZED_CONTEXT_CHARS
  );
  const currentWindow = { start: now - 24 * 60 * 60 * 1000, end: now };

  if (oversized.length > 0) {
    insights.push({
      id: "config-oversized-context",
      metricIds: ["context.load", "config.artifacts"],
      type: "recommendation",
      severity: "warning",
      title: "Large context files may be slowing sessions",
      explanation: `${oversized.length} guidance file${oversized.length === 1 ? "" : "s"} exceed the local context size threshold.`,
      recommendation:
        "Split durable guidance by project or skill, and keep root instructions focused on routing and non-negotiables.",
      comparison: { currentWindow, delta: totalChars },
      confidence: "high",
      sourceSampleCount: oversized.length,
      deepLink: "config",
      createdAt: now,
    });
  }

  const skillCount = artifacts.filter(
    (artifact) => artifact.kind === "skill"
  ).length;
  if (skillCount > 20) {
    insights.push({
      id: "config-noisy-skill-routing",
      metricIds: ["config.skills", "context.load"],
      type: "recommendation",
      severity: "warning",
      title: "Skill routing may be noisy",
      explanation: `${skillCount} local skills are visible to the harness.`,
      recommendation:
        "Move rarely used skills behind explicit names, and keep skill descriptions narrow enough for deterministic routing.",
      comparison: { currentWindow, delta: skillCount },
      confidence: "medium",
      sourceSampleCount: skillCount,
      deepLink: "config",
      createdAt: now,
    });
  }

  const hasRootGuidance = artifacts.some((artifact) =>
    ["agents-md", "claude-md", "rules"].includes(artifact.kind)
  );
  if (!hasRootGuidance) {
    insights.push({
      id: "config-missing-root-guidance",
      metricIds: ["config.artifacts"],
      type: "recommendation",
      severity: "neutral",
      title: "No root guidance file found",
      explanation:
        "The scanner did not find AGENTS.md, CLAUDE.md, or rules.md in the enabled project roots.",
      recommendation:
        "Add a short root guidance file that states branch policy, edit boundaries, and validation commands.",
      comparison: { currentWindow },
      confidence: "high",
      sourceSampleCount: artifacts.length,
      deepLink: "config",
      createdAt: now,
    });
  }

  return insights;
}
