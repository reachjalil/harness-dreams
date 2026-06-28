import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
  const root = mkdtempSync(path.join(os.tmpdir(), "harness-dreams-test-"));
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
        "<!-- harness-dreams:start -->\n## Harness Dreams - accepted guidance\n\n- Always run the real CLI before writing the report.\n<!-- harness-dreams:end -->\n",
      creates: true,
    },
  };
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
});
