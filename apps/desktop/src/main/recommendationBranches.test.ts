import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import type { ActionQueueEntry } from "../shared/types";
import {
  applyAcceptedRecommendationsAsBranches,
  applyAcceptedRecommendationsDirectly,
} from "./recommendationBranches";

const roots: string[] = [];

function tempProject(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "harness-health-test-"));
  roots.push(root);
  return root;
}

function acceptedEntry(projectPath: string): ActionQueueEntry {
  return {
    findingId: "finding-1",
    category: "agentsmd",
    action: "Add rule: Always run the real CLI before writing the report.",
    project: "non-git-project",
    state: "accepted",
    projectPath,
    patch: {
      target: "agentsmd",
      file: path.join(projectPath, "AGENTS.md"),
      label: "AGENTS.md",
      snippet:
        "<!-- harness-health:start -->\n## Harness Health - accepted guidance\n\n- Always run the real CLI before writing the report.\n<!-- harness-health:end -->\n",
      creates: true,
    },
  };
}

function git(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  expect(result.status).toBe(0);
  return (result.stdout ?? "").trim();
}

describe("recommendation apply modes", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("direct mode writes accepted guidance into the target file", () => {
    const projectPath = tempProject();
    const result = applyAcceptedRecommendationsDirectly([
      acceptedEntry(projectPath),
    ]);

    const applied = result.get("finding-1");
    expect(applied).toMatchObject({
      mode: "direct",
      appliedDirectly: true,
      changedFiles: ["AGENTS.md"],
      previousFiles: [
        {
          relativePath: "AGENTS.md",
          existed: false,
        },
      ],
    });
    expect(readFileSync(path.join(projectPath, "AGENTS.md"), "utf8")).toContain(
      "Always run the real CLI before writing the report."
    );
  });

  test("branch mode falls back to direct edits for non-git projects", () => {
    const projectPath = tempProject();
    const worktreesRoot = tempProject();
    const result = applyAcceptedRecommendationsAsBranches(
      [acceptedEntry(projectPath)],
      worktreesRoot
    );

    const applied = result.get("finding-1");
    expect(applied).toMatchObject({
      mode: "direct",
      appliedDirectly: true,
      changedFiles: ["AGENTS.md"],
    });
    expect(readFileSync(path.join(projectPath, "AGENTS.md"), "utf8")).toContain(
      "Always run the real CLI before writing the report."
    );
  });

  test("branch mode creates a reviewable worktree branch for git projects", () => {
    const projectPath = tempProject();
    const worktreesRoot = tempProject();
    git(projectPath, ["init"]);
    git(projectPath, ["config", "user.email", "test@example.local"]);
    git(projectPath, ["config", "user.name", "Harness Health Test"]);
    writeFileSync(path.join(projectPath, "README.md"), "test repo\n", "utf8");
    git(projectPath, ["add", "README.md"]);
    git(projectPath, ["commit", "-m", "Initial commit"]);

    const result = applyAcceptedRecommendationsAsBranches(
      [acceptedEntry(projectPath)],
      worktreesRoot
    );

    const applied = result.get("finding-1");
    expect(applied).toMatchObject({
      mode: "branch",
      baseBranch: git(projectPath, ["branch", "--show-current"]),
      pushed: false,
      error: "repo has no origin remote",
    });
    expect(applied?.branch).toMatch(/^codex\/harness-health-/);
    expect(applied?.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(applied?.worktreePath).toBeTruthy();
    expect(
      readFileSync(path.join(applied?.worktreePath ?? "", "AGENTS.md"), "utf8")
    ).toContain("Always run the real CLI before writing the report.");
    expect(git(applied?.worktreePath ?? "", ["log", "-1", "--pretty=%s"])).toBe(
      "Apply Harness Health recommendations"
    );
  });
});
