import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  configArtifactInsights,
  scanHarnessConfig,
} from "./harnessConfigScanner";

let tempRoot = "";

async function writeText(filePath: string, text: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, text, "utf8");
}

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "hd-config-test-"));
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe("scanHarnessConfig", () => {
  test("inventories durable guidance and excludes secrets/local runtime files", async () => {
    const repo = path.join(tempRoot, "repo");
    const homeDir = path.join(tempRoot, "home");
    await writeText(path.join(repo, "AGENTS.md"), "# Agent guidance\n");
    await writeText(path.join(repo, "rules.md"), "# Rules\n");
    await writeText(
      path.join(repo, ".harness", "harness.toml"),
      "name = 'test'\n"
    );
    await writeText(
      path.join(repo, ".agents", "skills", "health", "SKILL.md"),
      "# Health skill\n"
    );
    await writeText(path.join(repo, ".claude", "settings.json"), "{}\n");
    await writeText(
      path.join(repo, ".claude", "settings.local.json"),
      '{"token":"secret"}\n'
    );
    await writeText(path.join(repo, ".env"), "API_TOKEN=secret\n");
    await writeText(
      path.join(homeDir, ".claude", "settings.json"),
      '{"mcpServers":{}}\n'
    );

    const artifacts = await scanHarnessConfig({
      projectPaths: [repo],
      workspacePath: repo,
      homeDir,
      now: 1_783_000_000_000,
    });

    const paths = artifacts.map((artifact) => artifact.path);
    expect(paths).toContain(path.join(repo, "AGENTS.md"));
    expect(paths).toContain(path.join(repo, "rules.md"));
    expect(paths).toContain(path.join(repo, ".harness", "harness.toml"));
    expect(paths).toContain(
      path.join(repo, ".agents", "skills", "health", "SKILL.md")
    );
    expect(paths).toContain(path.join(repo, ".claude", "settings.json"));
    expect(paths).toContain(path.join(homeDir, ".claude", "settings.json"));
    expect(
      paths.some((filePath) => filePath.includes("settings.local.json"))
    ).toBe(false);
    expect(paths.some((filePath) => filePath.endsWith(".env"))).toBe(false);
    expect(
      artifacts.find((artifact) => artifact.path.endsWith("AGENTS.md"))?.kind
    ).toBe("agents-md");

    const insights = configArtifactInsights(artifacts, 1_783_000_000_000);
    expect(
      insights.some((insight) => insight.id === "config-missing-root-guidance")
    ).toBe(false);
  });
});
