import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { app } from "electron";

import { AppConfigSchema } from "../shared/schemas";
import type { AppConfig } from "../shared/types";

/**
 * Tiny dependency-free config store: a single validated JSON file in the
 * app's userData dir. Mirrors the SpeechGlow pattern — atomic write via a
 * temp file + rename, deep-merge of patches, re-validation with Zod.
 */

export const DEFAULT_CONFIG: AppConfig = {
  onboarded: false,
  privacyMode: "local",
  schedule: { mode: "nightly", time: "03:00" },
  notifications: true,
  analysisDepth: "standard",
  launchAtLogin: false,
  connectors: { claudeCode: true, codex: false, cursor: false },
};

type Listener = (config: AppConfig) => void;

let config: AppConfig = DEFAULT_CONFIG;
let filePath = "";
const listeners = new Set<Listener>();

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch)) {
    const current = out[key];
    if (isPlainObject(value) && isPlainObject(current)) {
      out[key] = deepMerge(current, value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as T;
}

function persist(): void {
  try {
    mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(config, null, 2), "utf8");
    renameSync(tmp, filePath);
  } catch (err) {
    console.error("[store] failed to persist config", err);
  }
}

export function initStore(): AppConfig {
  filePath = path.join(app.getPath("userData"), "harness-dreams-config.json");
  try {
    if (existsSync(filePath)) {
      const raw: unknown = JSON.parse(readFileSync(filePath, "utf8"));
      config = AppConfigSchema.parse(deepMerge(DEFAULT_CONFIG, raw));
    } else {
      config = DEFAULT_CONFIG;
      persist();
    }
  } catch (err) {
    console.error("[store] invalid config, using defaults", err);
    config = DEFAULT_CONFIG;
  }
  return config;
}

export function getConfig(): AppConfig {
  return config;
}

/** Deep-merge a (validated) patch, re-validate, persist, notify. */
export function setConfig(patch: unknown): AppConfig {
  config = AppConfigSchema.parse(deepMerge(config, patch ?? {}));
  persist();
  for (const listener of listeners) listener(config);
  return config;
}

export function onConfigChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
