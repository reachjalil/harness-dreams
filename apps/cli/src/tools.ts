import readline from "node:readline";

import { discoverAnalysisProjects } from "../../desktop/src/main/localIngest.ts";
import {
  applyAgentsBlock,
  applyClaudeBlock,
  applyContextDocBlock,
  applySkillFile,
} from "../../desktop/src/main/agentConfig.ts";
import { runSleepCycle } from "../../desktop/src/main/cycleEngine.ts";
import type { DreamReport, Finding } from "../../desktop/src/shared/types.ts";
import { readConfig, writeConfig } from "./config.js";
import { bold, cyan, dim, green, hr, red, yellow } from "./fmt.js";

/** In-process cache for the last dream report, reset between sessions. */
let cachedReport: DreamReport | null = null;

// ── Tool: discover_projects ──────────────────────────────────────────────────

export interface DiscoverResult {
  found: number;
  enabled: number;
  projects: Array<{ name: string; path: string; sources: string[] }>;
}

export function discoverProjects(): DiscoverResult {
  const discovered = discoverAnalysisProjects();
  const config = readConfig();

  // Merge discovered projects into config, preserving enabled state
  const existing = new Map(config.projects.map((p) => [p.path, p]));
  for (const d of discovered) {
    if (!existing.has(d.path)) {
      existing.set(d.path, {
        path: d.path,
        name: d.name,
        sources: d.sources,
        enabled: true,
        addedAt: Date.now(),
      });
    }
  }
  const projects = Array.from(existing.values());
  writeConfig({ ...config, projects });

  const enabled = projects.filter((p) => p.enabled);
  return {
    found: projects.length,
    enabled: enabled.length,
    projects: projects.map((p) => ({
      name: p.name,
      path: p.path,
      sources: p.sources,
    })),
  };
}

// ── Tool: run_dream ──────────────────────────────────────────────────────────

export interface DreamResult {
  rings: Array<{ key: string; label: string; score: number; delta: number }>;
  findingCount: number;
  digest: string;
  sessionCount: number;
}

export function runDream(): DreamResult {
  const config = readConfig();
  if (config.projects.filter((p) => p.enabled).length === 0) {
    throw new Error(
      "No projects configured. Run discover_projects first to find your coding sessions."
    );
  }

  const report = runSleepCycle(config.projects, {
    since: config.lastDreamAt ?? undefined,
  });

  cachedReport = report;
  writeConfig({ ...config, lastDreamAt: Date.now() });

  return {
    rings: report.rings.map((r) => ({
      key: r.key,
      label: r.label,
      score: r.score,
      delta: r.delta,
    })),
    findingCount: report.findings.length,
    digest: report.digest ?? "No summary available.",
    sessionCount: report.sessions ?? 0,
  };
}

// ── Tool: get_suggestions ────────────────────────────────────────────────────

export interface Suggestion {
  index: number;
  title: string;
  body: string;
  action: string;
  target: string;
  file: string;
  project: string;
}

export function getSuggestions(): Suggestion[] {
  if (!cachedReport) {
    throw new Error(
      "No dream report available. Run run_dream first to analyze your sessions."
    );
  }
  return cachedReport.findings
    .filter((f): f is Finding & { patch: NonNullable<Finding["patch"]> } =>
      Boolean(f.patch)
    )
    .map((f, i) => ({
      index: i,
      title: f.title,
      body: f.body,
      action: f.action,
      target: f.patch.target,
      file: f.patch.file,
      project: f.project,
    }));
}

// ── Tool: apply_patch ────────────────────────────────────────────────────────

export interface ApplyResult {
  applied: boolean;
  file: string | null;
  message: string;
}

export async function applyPatch(findingIndex: number): Promise<ApplyResult> {
  if (!cachedReport) {
    throw new Error("No dream report available. Run run_dream first.");
  }
  const patchable = cachedReport.findings.filter((f) => Boolean(f.patch));
  const finding = patchable[findingIndex];
  if (!finding?.patch) {
    return {
      applied: false,
      file: null,
      message: `No finding at index ${findingIndex}. Use get_suggestions to see available patches.`,
    };
  }

  const patch = finding.patch;
  const rule = finding.improvement || finding.action;

  // Show preview
  console.log("\n" + hr());
  console.log(bold(cyan(`  Patch preview: ${patch.label}`)));
  console.log(hr());
  console.log(dim(`  File: ${patch.file}`));
  if (patch.creates) console.log(yellow("  (new file)"));
  console.log("");
  console.log(dim("  Snippet:"));
  for (const line of patch.snippet.split("\n")) {
    console.log(`  ${green("+")} ${line}`);
  }
  console.log("\n" + hr());

  const confirmed = await prompt("  Apply this patch? [y/N] ");
  if (!confirmed) {
    return { applied: false, file: null, message: "Patch skipped by user." };
  }

  let written: string | null = null;
  if (patch.target === "skill") {
    written = applySkillFile(patch);
  } else if (patch.target === "claudemd") {
    written = applyClaudeBlock(patch.file, [rule]);
  } else if (patch.target === "contextdoc") {
    written = applyContextDocBlock(patch.file, [rule]);
  } else {
    written = applyAgentsBlock(patch.file, [rule]);
  }

  if (written) {
    return { applied: true, file: written, message: `Written to ${written}` };
  }
  return {
    applied: false,
    file: null,
    message: "Failed to write patch — check file permissions.",
  };
}

// ── Shared prompt helper ─────────────────────────────────────────────────────

function prompt(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

// ── Print helpers (for agent to call directly) ───────────────────────────────

export function printDiscoverResult(result: DiscoverResult): void {
  console.log(`\n${bold("Projects discovered")}: ${result.found} total, ${result.enabled} enabled`);
  for (const p of result.projects) {
    console.log(`  ${green("•")} ${bold(p.name)} ${dim(p.path)}`);
    console.log(`    ${dim("sources: " + p.sources.join(", "))}`);
  }
}

export function printDreamResult(result: DreamResult): void {
  console.log(`\n${bold("Sleep Cycle complete")} — ${result.sessionCount} sessions analyzed`);
  console.log(dim(`  ${result.digest}`));
  console.log("");
  for (const ring of result.rings) {
    const arrow = ring.delta > 0 ? green(`+${ring.delta}`) : ring.delta < 0 ? red(`${ring.delta}`) : dim("±0");
    console.log(`  ${cyan(ring.label.padEnd(16))} ${bold(String(ring.score).padStart(3))} ${arrow}`);
  }
  console.log(`\n  ${result.findingCount} finding(s) available — ask for suggestions to review them.`);
}

export function printSuggestions(suggestions: Suggestion[]): void {
  if (suggestions.length === 0) {
    console.log(`\n${dim("No actionable patches in the current report.")}`);
    return;
  }
  console.log(`\n${bold("Suggestions")} (${suggestions.length} patchable):\n`);
  for (const s of suggestions) {
    console.log(`  ${yellow(`[${s.index}]`)} ${bold(s.title)}`);
    console.log(`       ${dim(s.body)}`);
    console.log(`       ${dim("→")} ${s.action}`);
    console.log(`       ${dim(`target: ${s.target} · ${s.file}`)}`);
    console.log("");
  }
}

export function printApplyResult(result: ApplyResult): void {
  if (result.applied) {
    console.log(`\n${green("✓")} ${result.message}`);
  } else {
    console.log(`\n${dim("–")} ${result.message}`);
  }
}
