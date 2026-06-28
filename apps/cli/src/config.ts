import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import type { AnalysisProject } from "../../desktop/src/shared/types.ts";

export const MODELS = [
  { id: "claude-opus-4-8", label: "Opus 4.8 — most capable (recommended)" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6 — fast and capable" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5 — fastest, lowest cost" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export interface CliConfig {
  apiKey: string;
  model: ModelId;
  projects: AnalysisProject[];
  lastDreamAt: number | null;
}

const CONFIG_DIR = path.join(os.homedir(), ".harness-dreams");
const CONFIG_FILE = path.join(CONFIG_DIR, "cli-config.json");

const DEFAULT: CliConfig = {
  apiKey: "",
  model: "claude-opus-4-8",
  projects: [],
  lastDreamAt: null,
};

export function readConfig(): CliConfig {
  try {
    if (!existsSync(CONFIG_FILE)) return { ...DEFAULT };
    const raw = JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as Partial<CliConfig>;
    return {
      apiKey: raw.apiKey ?? "",
      model: raw.model ?? "claude-opus-4-8",
      projects: raw.projects ?? [],
      lastDreamAt: raw.lastDreamAt ?? null,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function writeConfig(config: CliConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const tmp = `${CONFIG_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(config, null, 2), "utf8");
  renameSync(tmp, CONFIG_FILE);
}

/** True when the user has completed first-run setup. */
export function isOnboarded(config: CliConfig): boolean {
  return Boolean(config.apiKey || process.env["ANTHROPIC_API_KEY"]);
}
