import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import type { ConfigPatchPreview } from "../shared/types";
import {
  CLAUDE_MANAGED_END,
  CLAUDE_MANAGED_START,
  CONTEXT_MANAGED_END,
  CONTEXT_MANAGED_START,
  MANAGED_END,
  MANAGED_START,
  applyAgentsBlock,
  applyClaudeBlock,
  applyContextDocBlock,
  applySkillFile,
} from "./agentConfig";

const roots: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "hd-agent-config-test-"));
  roots.push(root);
  return root;
}

function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("agent config patch helpers", () => {
  test("creates and updates the managed AGENTS.md block without removing user content", () => {
    const file = path.join(tempRoot(), "AGENTS.md");
    writeFileSync(file, "# Agent Guidance\n\nKeep this local note.\n", "utf8");

    expect(applyAgentsBlock(file, ["Run pnpm check before reports."])).toBe(
      file
    );
    let content = readFileSync(file, "utf8");
    expect(content).toContain("Keep this local note.");
    expect(content).toContain("Run pnpm check before reports.");
    expect(count(content, MANAGED_START)).toBe(1);
    expect(count(content, MANAGED_END)).toBe(1);

    expect(applyAgentsBlock(file, ["Run pnpm test before reports."])).toBe(
      file
    );
    content = readFileSync(file, "utf8");
    expect(content).toContain("Keep this local note.");
    expect(content).toContain("Run pnpm test before reports.");
    expect(content).not.toContain("Run pnpm check before reports.");
    expect(count(content, MANAGED_START)).toBe(1);
  });

  test("writes CLAUDE.md and context managed blocks idempotently", () => {
    const root = tempRoot();
    const claude = path.join(root, "CLAUDE.md");
    const rules = path.join(root, "rules.md");

    expect(applyClaudeBlock(claude, ["Prefer project-local skills."])).toBe(
      claude
    );
    expect(
      applyContextDocBlock(rules, ["Move long details out of AGENTS."])
    ).toBe(rules);
    expect(applyClaudeBlock(claude, ["Prefer project-local skills."])).toBe(
      claude
    );
    expect(
      applyContextDocBlock(rules, ["Move long details out of AGENTS."])
    ).toBe(rules);

    const claudeText = readFileSync(claude, "utf8");
    const rulesText = readFileSync(rules, "utf8");
    expect(count(claudeText, CLAUDE_MANAGED_START)).toBe(1);
    expect(count(claudeText, CLAUDE_MANAGED_END)).toBe(1);
    expect(count(rulesText, CONTEXT_MANAGED_START)).toBe(1);
    expect(count(rulesText, CONTEXT_MANAGED_END)).toBe(1);
  });

  test("creates a skill file once and leaves existing skill content intact", () => {
    const file = path.join(
      tempRoot(),
      ".claude",
      "skills",
      "deploy",
      "SKILL.md"
    );
    const patch: ConfigPatchPreview = {
      target: "skill",
      file,
      label: "New skill - deploy",
      snippet: "---\nname: deploy\n---\n\n# Deploy\n",
      creates: true,
    };

    expect(applySkillFile(patch)).toBe(file);
    expect(applySkillFile({ ...patch, snippet: "changed" })).toBe(null);
    expect(readFileSync(file, "utf8")).toBe(patch.snippet);
  });
});
