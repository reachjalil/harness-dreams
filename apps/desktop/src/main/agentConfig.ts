import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ActionCategory, ConfigPatchPreview } from "../shared/types";

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

export interface ProjectConfig {
  path: string;
  agentsMdPath: string;
  claudeMdPath: string;
  hasAgentsMd: boolean;
  hasClaudeMd: boolean;
  agentsMd: string;
  claudeMd: string;
  /** Project-local skills directory (~/project/.claude/skills). */
  skillsDir: string;
  /** Skill names found project-local + globally. */
  skills: string[];
  /** Project-local and global skill files with contents for cloud REM context. */
  skillFiles: Array<{ name: string; file: string; content: string }>;
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

function skillFilesIn(dir: string): Array<{ name: string; file: string; content: string }> {
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

/** Inspect a single project's harness config on disk (read-only). */
export function readProjectConfig(projectPath: string): ProjectConfig {
  const agentsMdPath = path.join(projectPath, "AGENTS.md");
  const claudeMdPath = path.join(projectPath, "CLAUDE.md");
  const skillsDir = path.join(projectPath, ".claude", "skills");
  const agents = read(agentsMdPath);
  const claude = read(claudeMdPath);
  const localSkillFiles = skillFilesIn(skillsDir);
  const globalSkillFiles = skillFilesIn(path.join(HOME, ".claude", "skills"));
  const skills = [
    ...skillNamesIn(skillsDir),
    ...skillNamesIn(path.join(HOME, ".claude", "skills")),
  ];
  return {
    path: projectPath,
    agentsMdPath,
    claudeMdPath,
    hasAgentsMd: agents.trim().length > 0,
    hasClaudeMd: claude.trim().length > 0,
    agentsMd: agents,
    claudeMd: claude,
    skillsDir,
    skills: [...new Set(skills)],
    skillFiles: [...localSkillFiles, ...globalSkillFiles],
    managedBlockPresent: agents.includes(MANAGED_START),
    existingGuidance: `${agents}\n${claude}`.toLowerCase(),
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
  title: string
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
    "## Harness Dreams — accepted guidance"
  );
}

export function buildClaudeBlock(lines: string[]): string {
  return buildManagedBlock(
    lines,
    CLAUDE_MANAGED_START,
    CLAUDE_MANAGED_END,
    "## Harness Dreams — Claude guidance"
  );
}

/** A concrete AGENTS.md patch preview for one guidance line. */
export function agentsPatch(
  config: ProjectConfig,
  category: ActionCategory,
  line: string,
  projectName: string
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
  projectName: string
): ConfigPatchPreview {
  return {
    target: "claudemd",
    file: config.claudeMdPath,
    label: `CLAUDE.md · ${projectName}`,
    snippet: buildClaudeBlock([line]),
    creates: !config.hasClaudeMd,
  };
}

/** A concrete new-skill patch preview (a scaffolded SKILL.md). */
export function skillPatch(
  config: ProjectConfig,
  taskLabel: string,
  description: string,
  projectName: string
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
  lines: string[]
): string | null {
  if (lines.length === 0) return null;
  const block = buildAgentsBlock(lines);
  const existing = existsSync(agentsMdPath)
    ? read(agentsMdPath)
    : "# Agent Guidance\n\n";
  const next = existing.includes(MANAGED_START)
    ? existing.replace(
        new RegExp(`${MANAGED_START}[\\s\\S]*?${MANAGED_END}\\n?`),
        block
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
  lines: string[]
): string | null {
  if (lines.length === 0) return null;
  const block = buildClaudeBlock(lines);
  const existing = existsSync(claudeMdPath)
    ? read(claudeMdPath)
    : "# Claude Guidance\n\n";
  const next = existing.includes(CLAUDE_MANAGED_START)
    ? existing.replace(
        new RegExp(
          `${CLAUDE_MANAGED_START}[\\s\\S]*?${CLAUDE_MANAGED_END}\\n?`
        ),
        block
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
