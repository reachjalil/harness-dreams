import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

import type { ActionQueueEntry, ConfigPatchPreview } from "../shared/types";
import { applyAgentsBlock, applyClaudeBlock, applySkillFile } from "./agentConfig";

interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  status: number | null;
}

interface BranchGroup {
  repoRoot: string;
  entries: ActionQueueEntry[];
}

type ReviewBranch = NonNullable<ActionQueueEntry["reviewBranch"]>;

function git(cwd: string, args: string[], timeout = 30_000): GitResult {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
    status: result.status,
  };
}

function safeSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 44) || "recommendation"
  );
}

function shortHash(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, 8);
}

function repoRoot(projectPath: string | undefined): string | null {
  if (!projectPath) return null;
  const found = git(projectPath, ["rev-parse", "--show-toplevel"]);
  return found.ok ? found.stdout : null;
}

function githubUrl(remote: string): string | null {
  const patterns = [
    /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/,
    /^https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/,
    /^ssh:\/\/git@github\.com\/([^/]+)\/(.+?)(?:\.git)?$/,
  ];
  for (const pattern of patterns) {
    const match = remote.match(pattern);
    if (!match) continue;
    return `https://github.com/${match[1]}/${match[2].replace(/\.git$/, "")}`;
  }
  return null;
}

function compareUrl(remote: string, baseBranch: string, branch: string): string | undefined {
  const repo = githubUrl(remote);
  if (!repo) return undefined;
  return `${repo}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(branch)}?expand=1`;
}

function relativeInside(root: string, file: string): string | null {
  const rel = path.relative(root, file);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel;
}

function mapPatchFile(
  patch: ConfigPatchPreview | undefined,
  repoRootPath: string,
  worktreePath: string
): string | null {
  if (!patch) return null;
  const rel = relativeInside(repoRootPath, patch.file);
  return rel ? path.join(worktreePath, rel) : null;
}

function guidanceFromAction(action: string): string {
  const clean = action.replace(/\s+/g, " ").trim();
  const prefixed = clean.match(
    /^(?:add (?:a )?rule(?: to [^:]+)?|scaffold skill):\s*(.+)$/i
  );
  return prefixed?.[1]?.trim() || clean;
}

function guidanceLines(entry: ActionQueueEntry): string[] {
  const snippetLines =
    entry.patch?.snippet
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2).trim())
      .filter(Boolean) ?? [];
  return snippetLines.length > 0
    ? snippetLines
    : [guidanceFromAction(entry.action)];
}

function applyGroupChanges(
  entries: ActionQueueEntry[],
  repoRootPath: string,
  worktreePath: string
): string[] {
  const changed = new Set<string>();
  const agentsByFile = new Map<string, string[]>();
  const claudeByFile = new Map<string, string[]>();

  for (const entry of entries) {
    if (entry.category === "skill") continue;
    const file =
      mapPatchFile(entry.patch, repoRootPath, worktreePath) ??
      path.join(
        worktreePath,
        entry.category === "claudemd" ? "CLAUDE.md" : "AGENTS.md"
      );
    const lines = guidanceLines(entry);
    if (entry.category === "claudemd") {
      claudeByFile.set(file, [...(claudeByFile.get(file) ?? []), ...lines]);
    } else {
      agentsByFile.set(file, [...(agentsByFile.get(file) ?? []), ...lines]);
    }
  }

  for (const [file, lines] of agentsByFile) {
    if (applyAgentsBlock(file, lines)) {
      const rel = relativeInside(worktreePath, file);
      if (rel) changed.add(rel);
    }
  }
  for (const [file, lines] of claudeByFile) {
    if (applyClaudeBlock(file, lines)) {
      const rel = relativeInside(worktreePath, file);
      if (rel) changed.add(rel);
    }
  }
  for (const entry of entries) {
    if (entry.category !== "skill" || !entry.patch) continue;
    const file = mapPatchFile(entry.patch, repoRootPath, worktreePath);
    if (!file) continue;
    applySkillFile({ ...entry.patch, file });
    const rel = relativeInside(worktreePath, file);
    if (rel) changed.add(rel);
  }

  return [...changed];
}

function branchGroup(
  group: BranchGroup,
  worktreesRoot: string,
  stamp: string
): ReviewBranch {
  const baseBranch =
    git(group.repoRoot, ["branch", "--show-current"]).stdout ||
    git(group.repoRoot, ["rev-parse", "--short", "HEAD"]).stdout ||
    "main";
  const idSeed = group.entries.map((entry) => entry.findingId).join("-");
  const branch = `codex/harness-dreams-${stamp}-${safeSlug(group.entries[0]?.project ?? "repo")}-${shortHash(idSeed)}`;
  const worktreePath = path.join(
    worktreesRoot,
    `${path.basename(group.repoRoot)}-${stamp}-${shortHash(group.repoRoot + idSeed)}`
  );
  mkdirSync(path.dirname(worktreePath), { recursive: true });

  const add = git(group.repoRoot, [
    "worktree",
    "add",
    "-b",
    branch,
    worktreePath,
    baseBranch,
  ]);
  if (!add.ok) {
    return {
      branch,
      baseBranch,
      worktreePath,
      pushed: false,
      error: add.stderr || add.stdout || "failed to create git worktree",
    };
  }

  const changedFiles = applyGroupChanges(group.entries, group.repoRoot, worktreePath);
  if (changedFiles.length === 0) {
    return {
      branch,
      baseBranch,
      worktreePath,
      pushed: false,
      error: "accepted recommendations produced no file changes",
    };
  }

  const addFiles = git(worktreePath, ["add", "--", ...changedFiles]);
  if (!addFiles.ok) {
    return {
      branch,
      baseBranch,
      worktreePath,
      pushed: false,
      error: addFiles.stderr || "failed to stage recommendation changes",
    };
  }

  const diff = git(worktreePath, ["diff", "--cached", "--quiet"]);
  if (diff.status === 0) {
    return {
      branch,
      baseBranch,
      worktreePath,
      pushed: false,
      error: "accepted recommendations were already present",
    };
  }

  const hasGitIdentity =
    git(worktreePath, ["config", "user.email"]).ok &&
    git(worktreePath, ["config", "user.name"]).ok;
  const commit = git(worktreePath, [
    ...(hasGitIdentity
      ? []
      : [
          "-c",
          "user.email=harness-dreams@example.local",
          "-c",
          "user.name=Harness Dreams",
        ]),
    "commit",
    "-m",
    "Apply Harness Dreams recommendations",
  ]);
  if (!commit.ok) {
    return {
      branch,
      baseBranch,
      worktreePath,
      pushed: false,
      error: commit.stderr || "failed to commit recommendation changes",
    };
  }

  const commitSha = git(worktreePath, ["rev-parse", "HEAD"]).stdout;
  const remote = git(worktreePath, ["remote", "get-url", "origin"]).stdout;
  const prUrl = remote ? compareUrl(remote, baseBranch, branch) : undefined;
  let pushed = false;
  let error: string | undefined;
  if (remote) {
    const push = git(worktreePath, ["push", "-u", "origin", branch], 45_000);
    pushed = push.ok;
    if (!push.ok) error = push.stderr || push.stdout || "failed to push branch";
  } else {
    error = "repo has no origin remote";
  }

  return {
    branch,
    baseBranch,
    worktreePath,
    commit: commitSha,
    remote: remote || undefined,
    prUrl,
    pushed,
    error,
  };
}

function groupByRepo(entries: ActionQueueEntry[]): {
  groups: BranchGroup[];
  failures: Map<string, ReviewBranch>;
} {
  const byRoot = new Map<string, ActionQueueEntry[]>();
  const failures = new Map<string, ReviewBranch>();
  for (const entry of entries) {
    const root = repoRoot(entry.projectPath);
    if (!root) {
      failures.set(entry.findingId, {
        branch: "",
        pushed: false,
        error: entry.projectPath
          ? "project is not inside a git repository"
          : "recommendation has no project path",
      });
      continue;
    }
    byRoot.set(root, [...(byRoot.get(root) ?? []), entry]);
  }
  return {
    groups: [...byRoot.entries()].map(([root, groupEntries]) => ({
      repoRoot: root,
      entries: groupEntries,
    })),
    failures,
  };
}

export function applyAcceptedRecommendationsAsBranches(
  accepted: ActionQueueEntry[],
  worktreesRoot: string
): Map<string, ReviewBranch> {
  const result = new Map<string, ReviewBranch>();
  const { groups, failures } = groupByRepo(accepted);
  for (const [findingId, failure] of failures) result.set(findingId, failure);

  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  for (const group of groups) {
    const reviewBranch = branchGroup(group, worktreesRoot, stamp);
    for (const entry of group.entries) {
      result.set(entry.findingId, reviewBranch);
    }
  }
  return result;
}
