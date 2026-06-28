import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import type {
  ActionCategory,
  ConfigPatchPreview,
  ContextHealth,
  ContextSourceKind,
  ContextSourceSummary,
} from "../shared/types";

/**
 * Reads the agent-harness config files for a project — AGENTS.md, CLAUDE.md,
 * and skills — and turns accepted recommendations into concrete, idempotent
 * file changes. This is the bridge between a Sleep Cycle's findings and "true"
 * AGENTS.md / skill improvements on disk.
 */

const HOME = os.homedir();

/** Delimiters for the block Harness Dreams owns inside an AGENTS.md. */
export const MANAGED_START = "<!-- harness-dreams:start -->";
export const MANAGED_END = "<!-- harness-dreams:end -->";
export const CLAUDE_MANAGED_START = "<!-- harness-dreams:claude:start -->";
export const CLAUDE_MANAGED_END = "<!-- harness-dreams:claude:end -->";
export const CONTEXT_MANAGED_START = "<!-- harness-dreams:context:start -->";
export const CONTEXT_MANAGED_END = "<!-- harness-dreams:context:end -->";

export interface ProjectConfig {
  path: string;
  agentsMdPath: string;
  claudeMdPath: string;
  rulesMdPath: string;
  hasAgentsMd: boolean;
  hasClaudeMd: boolean;
  hasRulesMd: boolean;
  agentsMd: string;
  claudeMd: string;
  rulesMd: string;
  /** Project-local skills directory (~/project/.claude/skills). */
  skillsDir: string;
  /** Skill names found project-local + globally. */
  skills: string[];
  localSkills: string[];
  globalSkills: string[];
  /** Project-local and global skill files with contents for cloud REM context. */
  skillFiles: Array<{ name: string; file: string; content: string }>;
  /** Claude/Codex project and home context inventory without full contents. */
  contextFiles: ContextSourceSummary[];
  /** Memory-like files from ~/.claude and the project. */
  memoryFiles: ContextSourceSummary[];
  /** Deterministic score for context-load and memory hygiene. */
  contextHealth: ContextHealth;
  /** True when AGENTS.md already carries our managed block. */
  managedBlockPresent: boolean;
  /** Combined lower-cased AGENTS.md + CLAUDE.md text, for dedupe checks. */
  existingGuidance: string;
}

function read(file: string): string {
  try {
    return existsSync(file) ? readFileSync(file, "utf8") : "";
  } catch {
    return "";
  }
}

function lineCount(text: string): number {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

function sourceSummary(
  kind: ContextSourceKind,
  label: string,
  file: string,
  content = read(file),
): ContextSourceSummary | null {
  if (!content.trim()) return null;
  return {
    kind,
    label,
    path: file,
    chars: content.length,
    lines: lineCount(content),
  };
}

function skillNamesIn(dir: string): string[] {
  try {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.name.endsWith(".md"))
      .map((entry) => entry.name.replace(/\.md$/, ""));
  } catch {
    return [];
  }
}

function shallowMarkdownFilesIn(
  dir: string,
  kind: ContextSourceKind,
  labelPrefix: string,
  limit = 16,
): ContextSourceSummary[] {
  try {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .slice(0, limit)
      .map((entry) => {
        const file = path.join(dir, entry.name);
        return sourceSummary(kind, `${labelPrefix}/${entry.name}`, file);
      })
      .filter((item): item is ContextSourceSummary => Boolean(item));
  } catch {
    return [];
  }
}

function skillFilesIn(
  dir: string,
): Array<{ name: string; file: string; content: string }> {
  try {
    if (!existsSync(dir)) return [];
    const files: Array<{ name: string; file: string; content: string }> = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = entry.isDirectory()
        ? path.join(dir, entry.name, "SKILL.md")
        : entry.name.endsWith(".md")
          ? path.join(dir, entry.name)
          : "";
      if (!file || !existsSync(file)) continue;
      files.push({
        name: entry.name.replace(/\.md$/, ""),
        file,
        content: read(file),
      });
    }
    return files;
  } catch {
    return [];
  }
}

/** Read the global ~/.claude/CLAUDE.md, used as a fallback guidance source. */
export function readGlobalClaudeMd(): string {
  return read(path.join(HOME, ".claude", "CLAUDE.md"));
}

function globalClaudeContextFiles(): ContextSourceSummary[] {
  const root = path.join(HOME, ".claude");
  const candidates: Array<[ContextSourceKind, string, string]> = [
    ["claude-home", "~/.claude/CLAUDE.md", path.join(root, "CLAUDE.md")],
    ["memory", "~/.claude/MEMORY.md", path.join(root, "MEMORY.md")],
    ["memory", "~/.claude/memory.md", path.join(root, "memory.md")],
    ["rules", "~/.claude/rules.md", path.join(root, "rules.md")],
    ["settings", "~/.claude/settings.json", path.join(root, "settings.json")],
  ];
  return [
    ...candidates
      .map(([kind, label, file]) => sourceSummary(kind, label, file))
      .filter((item): item is ContextSourceSummary => Boolean(item)),
    ...shallowMarkdownFilesIn(
      path.join(root, "memory"),
      "memory",
      "~/.claude/memory",
    ),
  ];
}

function globalCodexContextFiles(): ContextSourceSummary[] {
  const root = path.join(HOME, ".codex");
  const candidates = [
    "AGENTS.md",
    "instructions.md",
    "INSTRUCTIONS.md",
    "rules.md",
    "memory.md",
    "MEMORY.md",
    "config.toml",
    "config.json",
  ];
  return candidates
    .map((name) => {
      const file = path.join(root, name);
      const kind: ContextSourceKind = name.toLowerCase().includes("config")
        ? "settings"
        : name.toLowerCase().includes("memory")
          ? "memory"
          : "codex-home";
      return sourceSummary(kind, `~/.codex/${name}`, file);
    })
    .filter((item): item is ContextSourceSummary => Boolean(item));
}

function projectMemoryFiles(projectPath: string): ContextSourceSummary[] {
  const candidates: Array<[ContextSourceKind, string, string]> = [
    ["memory", "MEMORY.md", path.join(projectPath, "MEMORY.md")],
    [
      "memory",
      ".claude/MEMORY.md",
      path.join(projectPath, ".claude", "MEMORY.md"),
    ],
    [
      "memory",
      ".claude/memory.md",
      path.join(projectPath, ".claude", "memory.md"),
    ],
  ];
  return [
    ...candidates
      .map(([kind, label, file]) => sourceSummary(kind, label, file))
      .filter((item): item is ContextSourceSummary => Boolean(item)),
    ...shallowMarkdownFilesIn(
      path.join(projectPath, "memory"),
      "memory",
      "memory",
    ),
    ...shallowMarkdownFilesIn(
      path.join(projectPath, ".claude", "memory"),
      "memory",
      ".claude/memory",
    ),
  ];
}

function compactChars(chars: number): string {
  if (chars >= 1000) return `${Math.round(chars / 1000)}k chars`;
  return `${chars} chars`;
}

function healthFrom(
  files: ContextSourceSummary[],
  memoryFiles: ContextSourceSummary[],
  localSkillCount: number,
  globalSkillCount: number,
  hasRulesMd: boolean,
): ContextHealth {
  const totalChars = files.reduce((sum, file) => sum + file.chars, 0);
  const projectChars = files
    .filter(
      (file) =>
        file.kind === "agentsmd" ||
        file.kind === "claudemd" ||
        file.kind === "rules" ||
        file.kind === "memory",
    )
    .filter((file) => !file.label.startsWith("~/"))
    .reduce((sum, file) => sum + file.chars, 0);
  const globalChars = files
    .filter((file) => file.label.startsWith("~/"))
    .reduce((sum, file) => sum + file.chars, 0);
  const memoryChars = memoryFiles.reduce((sum, file) => sum + file.chars, 0);
  const oversizedFiles = files.filter(
    (file) =>
      (file.kind === "agentsmd" && (file.chars > 9_000 || file.lines > 140)) ||
      (file.kind === "claudemd" && (file.chars > 9_000 || file.lines > 160)) ||
      (file.kind === "memory" && file.chars > 10_000) ||
      (file.label.startsWith("~/") && file.chars > 8_000),
  );
  const risks: string[] = [];
  if (oversizedFiles.length > 0) {
    risks.push(
      `${oversizedFiles.length} oversized context file${oversizedFiles.length === 1 ? "" : "s"}`,
    );
  }
  if (totalChars > 24_000) {
    risks.push(
      `context load is ${compactChars(totalChars)} before transcripts`,
    );
  }
  if (localSkillCount > 8 || localSkillCount + globalSkillCount > 22) {
    risks.push(
      `${localSkillCount + globalSkillCount} skills can make routing noisy`,
    );
  }
  if (
    !hasRulesMd &&
    files.some((file) => file.kind === "agentsmd" && file.chars > 6_000)
  ) {
    risks.push("AGENTS.md is carrying details that could move to rules.md");
  }
  if (memoryFiles.length > 10 || memoryChars > 16_000) {
    risks.push("Claude memory is scattered enough to need consolidation");
  }

  const suggestions: string[] = [];
  if (!hasRulesMd && risks.some((risk) => risk.includes("AGENTS.md"))) {
    suggestions.push(
      "Create rules.md for detailed project rules and keep AGENTS.md focused on routing, safety, and links.",
    );
  }
  if (localSkillCount > 8 || localSkillCount + globalSkillCount > 22) {
    suggestions.push(
      "Archive or project-scope rarely used skills so the agent chooses from a smaller routing set.",
    );
  }
  if (memoryFiles.length > 10 || memoryChars > 16_000) {
    suggestions.push(
      "Consolidate Claude memory into a short indexed MEMORY.md with stale notes pruned.",
    );
  }
  if (globalChars > 10_000) {
    suggestions.push(
      "Move project-specific home-directory Claude/Codex guidance into project files.",
    );
  }

  const penalty =
    oversizedFiles.length * 12 +
    (totalChars > 24_000 ? 14 : 0) +
    (localSkillCount > 8 ? 10 : 0) +
    (localSkillCount + globalSkillCount > 22 ? 10 : 0) +
    (!hasRulesMd &&
    files.some((file) => file.kind === "agentsmd" && file.chars > 6_000)
      ? 10
      : 0) +
    (memoryFiles.length > 10 || memoryChars > 16_000 ? 10 : 0);
  const score = Math.max(28, Math.min(100, Math.round(100 - penalty)));
  return {
    score,
    status: score >= 82 ? "clear" : score >= 62 ? "watch" : "overloaded",
    totalChars,
    projectChars,
    globalChars,
    memoryChars,
    skillCount: localSkillCount + globalSkillCount,
    localSkillCount,
    globalSkillCount,
    hasRulesMd,
    memoryFiles: memoryFiles.length,
    sourceCount: files.length,
    oversizedFiles,
    risks,
    suggestions,
  };
}

/** Inspect a single project's harness config on disk (read-only). */
export function readProjectConfig(projectPath: string): ProjectConfig {
  const agentsMdPath = path.join(projectPath, "AGENTS.md");
  const claudeMdPath = path.join(projectPath, "CLAUDE.md");
  const rulesMdPath = path.join(projectPath, "rules.md");
  const skillsDir = path.join(projectPath, ".claude", "skills");
  const agents = read(agentsMdPath);
  const claude = read(claudeMdPath);
  const rules = read(rulesMdPath);
  const localSkillFiles = skillFilesIn(skillsDir);
  const globalSkillFiles = skillFilesIn(path.join(HOME, ".claude", "skills"));
  const localSkills = skillNamesIn(skillsDir);
  const globalSkills = skillNamesIn(path.join(HOME, ".claude", "skills"));
  const skills = [...localSkills, ...globalSkills];
  const globalContext = [
    ...globalClaudeContextFiles(),
    ...globalCodexContextFiles(),
  ];
  const projectMemory = projectMemoryFiles(projectPath);
  const projectContext = [
    sourceSummary("agentsmd", "AGENTS.md", agentsMdPath, agents),
    sourceSummary("claudemd", "CLAUDE.md", claudeMdPath, claude),
    sourceSummary("rules", "rules.md", rulesMdPath, rules),
    ...projectMemory,
    ...localSkillFiles.map((skill) =>
      sourceSummary(
        "skill",
        `.claude/skills/${skill.name}`,
        skill.file,
        skill.content,
      ),
    ),
  ].filter((item): item is ContextSourceSummary => Boolean(item));
  const memoryFiles = [
    ...projectMemory,
    ...globalContext.filter((file) => file.kind === "memory"),
  ];
  const contextFiles = [...projectContext, ...globalContext];
  const contextHealth = healthFrom(
    contextFiles,
    memoryFiles,
    localSkills.length,
    globalSkills.length,
    rules.trim().length > 0,
  );
  return {
    path: projectPath,
    agentsMdPath,
    claudeMdPath,
    rulesMdPath,
    hasAgentsMd: agents.trim().length > 0,
    hasClaudeMd: claude.trim().length > 0,
    hasRulesMd: rules.trim().length > 0,
    agentsMd: agents,
    claudeMd: claude,
    rulesMd: rules,
    skillsDir,
    skills: [...new Set(skills)],
    localSkills: [...new Set(localSkills)],
    globalSkills: [...new Set(globalSkills)],
    skillFiles: [...localSkillFiles, ...globalSkillFiles],
    contextFiles,
    memoryFiles,
    contextHealth,
    managedBlockPresent: agents.includes(MANAGED_START),
    existingGuidance: `${agents}\n${claude}\n${rules}`.toLowerCase(),
  };
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "task"
  );
}

function buildManagedBlock(
  lines: string[],
  start: string,
  end: string,
  title: string,
): string {
  return [
    start,
    title,
    "",
    "Apply these user-approved recommendations from the latest Sleep Cycle:",
    "",
    ...lines.map((line) => `- ${line}`),
    end,
    "",
  ].join("\n");
}

/** Build the managed AGENTS.md block from a set of guidance lines. */
export function buildAgentsBlock(lines: string[]): string {
  return buildManagedBlock(
    lines,
    MANAGED_START,
    MANAGED_END,
    "## Harness Dreams — accepted guidance",
  );
}

export function buildClaudeBlock(lines: string[]): string {
  return buildManagedBlock(
    lines,
    CLAUDE_MANAGED_START,
    CLAUDE_MANAGED_END,
    "## Harness Dreams — Claude guidance",
  );
}

export function buildContextBlock(lines: string[]): string {
  return buildManagedBlock(
    lines,
    CONTEXT_MANAGED_START,
    CONTEXT_MANAGED_END,
    "## Harness Dreams — context hygiene",
  );
}

/** A concrete AGENTS.md patch preview for one guidance line. */
export function agentsPatch(
  config: ProjectConfig,
  category: ActionCategory,
  line: string,
  projectName: string,
): ConfigPatchPreview {
  return {
    target: category,
    file: config.agentsMdPath,
    label: `AGENTS.md · ${projectName}`,
    snippet: buildAgentsBlock([line]),
    creates: !config.hasAgentsMd,
  };
}

/** A concrete CLAUDE.md patch preview for one guidance line. */
export function claudePatch(
  config: ProjectConfig,
  line: string,
  projectName: string,
): ConfigPatchPreview {
  return {
    target: "claudemd",
    file: config.claudeMdPath,
    label: `CLAUDE.md · ${projectName}`,
    snippet: buildClaudeBlock([line]),
    creates: !config.hasClaudeMd,
  };
}

/** A concrete rules.md/context patch preview for context-hygiene guidance. */
export function contextRulesPatch(
  config: ProjectConfig,
  line: string,
  projectName: string,
): ConfigPatchPreview {
  return {
    target: "contextdoc",
    file: config.rulesMdPath,
    label: `rules.md · ${projectName}`,
    snippet: buildContextBlock([line]),
    creates: !config.hasRulesMd,
  };
}

/** A concrete new-skill patch preview (a scaffolded SKILL.md). */
export function skillPatch(
  config: ProjectConfig,
  taskLabel: string,
  description: string,
  projectName: string,
): ConfigPatchPreview {
  const slug = slugify(taskLabel);
  const file = path.join(config.skillsDir, slug, "SKILL.md");
  const snippet = [
    "---",
    `name: ${slug}`,
    `description: ${description}`,
    "---",
    "",
    `# ${taskLabel}`,
    "",
    `Captured by Harness Dreams from a recurring task in ${projectName}.`,
    "Fill in the steps the agent should follow so it stops re-deriving them:",
    "",
    "1. …",
    "2. …",
    "",
  ].join("\n");
  return {
    target: "skill",
    file,
    label: `New skill · ${slug}`,
    snippet,
    creates: !existsSync(file),
  };
}

/**
 * Apply a project's accepted AGENTS.md guidance as a single idempotent managed
 * block. Returns the file written, or null if nothing changed.
 */
export function applyAgentsBlock(
  agentsMdPath: string,
  lines: string[],
): string | null {
  if (lines.length === 0) return null;
  const block = buildAgentsBlock(lines);
  const existing = existsSync(agentsMdPath)
    ? read(agentsMdPath)
    : "# Agent Guidance\n\n";
  const next = existing.includes(MANAGED_START)
    ? existing.replace(
        new RegExp(`${MANAGED_START}[\\s\\S]*?${MANAGED_END}\\n?`),
        block,
      )
    : `${existing.trimEnd()}\n\n${block}`;
  try {
    mkdirSync(path.dirname(agentsMdPath), { recursive: true });
    writeFileSync(agentsMdPath, next, "utf8");
    return agentsMdPath;
  } catch {
    return null;
  }
}

/** Apply accepted CLAUDE.md guidance as a single idempotent managed block. */
export function applyClaudeBlock(
  claudeMdPath: string,
  lines: string[],
): string | null {
  if (lines.length === 0) return null;
  const block = buildClaudeBlock(lines);
  const existing = existsSync(claudeMdPath)
    ? read(claudeMdPath)
    : "# Claude Guidance\n\n";
  const next = existing.includes(CLAUDE_MANAGED_START)
    ? existing.replace(
        new RegExp(
          `${CLAUDE_MANAGED_START}[\\s\\S]*?${CLAUDE_MANAGED_END}\\n?`,
        ),
        block,
      )
    : `${existing.trimEnd()}\n\n${block}`;
  try {
    mkdirSync(path.dirname(claudeMdPath), { recursive: true });
    writeFileSync(claudeMdPath, next, "utf8");
    return claudeMdPath;
  } catch {
    return null;
  }
}

/** Apply accepted context guidance as a single idempotent managed block. */
export function applyContextDocBlock(
  contextPath: string,
  lines: string[],
): string | null {
  if (lines.length === 0) return null;
  const block = buildContextBlock(lines);
  const existing = existsSync(contextPath)
    ? read(contextPath)
    : "# Project Rules\n\n";
  const next = existing.includes(CONTEXT_MANAGED_START)
    ? existing.replace(
        new RegExp(
          `${CONTEXT_MANAGED_START}[\\s\\S]*?${CONTEXT_MANAGED_END}\\n?`,
        ),
        block,
      )
    : `${existing.trimEnd()}\n\n${block}`;
  try {
    mkdirSync(path.dirname(contextPath), { recursive: true });
    writeFileSync(contextPath, next, "utf8");
    return contextPath;
  } catch {
    return null;
  }
}

/** Create a scaffolded skill file if it doesn't already exist. */
export function applySkillFile(patch: ConfigPatchPreview): string | null {
  if (patch.target !== "skill") return null;
  if (existsSync(patch.file)) return null;
  try {
    mkdirSync(path.dirname(patch.file), { recursive: true });
    writeFileSync(patch.file, patch.snippet, "utf8");
    return patch.file;
  } catch {
    return null;
  }
}
