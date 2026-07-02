import { randomBytes, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { hostname } from "node:os";
import path from "node:path";
import { app } from "electron";
import { DEFAULT_SIGNAL_API_BASE_URL } from "@harness-health/core";

import { AppConfigSchema } from "../shared/schemas";
import type { AppConfig } from "../shared/types";

/**
 * Tiny dependency-free config store: a single validated JSON file in the
 * app's userData dir. Mirrors the SpeechGlow pattern — atomic write via a
 * temp file + rename, deep-merge of patches, re-validation with Zod.
 */

export const DEFAULT_CONFIG: AppConfig = {
  onboarded: false,
  userName: "",
  demoMode: false,
  showOnboardingOnLaunch: false,
  privacyMode: "local",
  schedule: { mode: "daily", time: "03:00" },
  notifications: true,
  analysisDepth: "standard",
  guidanceApplyMode: "direct",
  insightRunner: {
    provider: "codex",
    model: "gpt-5.5",
    claudePath: "claude",
    codexPath: "codex",
    timeoutMs: 180_000,
  },
  telemetry: {
    enabled: true,
    watch: true,
    retentionDays: 90,
    rawTextRetention: false,
    priceTable: {},
  },
  launchAtLogin: false,
  reduceMotion: false,
  cloudSync: {
    enabled: false,
    paidPlan: false,
    devBypassPaidPlan: true,
    cloudApiBaseUrl:
      process.env.HARNESS_HEALTH_CLOUD_API_BASE_URL ||
      process.env.HARNESS_HEALTH_SIGNAL_API_BASE_URL ||
      DEFAULT_SIGNAL_API_BASE_URL,
    cloudUserId: "",
    deviceId: "",
    deviceName: "",
    devices: [],
    backupEnabled: false,
    backupKey: "",
    backupEpochId: "",
    backupRetentionDays: 30,
  },
  companionSyncInterest: false,
  connectors: { claudeCode: true, codex: true, cursor: false },
  projects: [],
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

function withRuntimeDefaults(next: AppConfig): AppConfig {
  const cloudSync = next.cloudSync ?? DEFAULT_CONFIG.cloudSync;
  const backupEnabled = Boolean(cloudSync.backupEnabled);
  return {
    ...next,
    cloudSync: {
      ...cloudSync,
      cloudApiBaseUrl:
        cloudSync.cloudApiBaseUrl ||
        process.env.HARNESS_HEALTH_CLOUD_API_BASE_URL ||
        process.env.HARNESS_HEALTH_SIGNAL_API_BASE_URL ||
        DEFAULT_CONFIG.cloudSync.cloudApiBaseUrl,
      cloudUserId: cloudSync.cloudUserId || randomUUID(),
      deviceId: cloudSync.deviceId || randomUUID(),
      deviceName: cloudSync.deviceName || hostname() || "Desktop",
      devices: cloudSync.devices ?? [],
      backupEnabled,
      backupKey:
        backupEnabled && !cloudSync.backupKey
          ? randomBytes(32).toString("base64url")
          : cloudSync.backupKey || "",
      backupEpochId:
        backupEnabled && !cloudSync.backupEpochId
          ? randomUUID()
          : cloudSync.backupEpochId || "",
      backupRetentionDays:
        cloudSync.backupRetentionDays ||
        DEFAULT_CONFIG.cloudSync.backupRetentionDays,
    },
  };
}

export function initStore(): AppConfig {
  filePath = path.join(app.getPath("userData"), "harness-health-config.json");
  try {
    if (existsSync(filePath)) {
      const raw: unknown = JSON.parse(readFileSync(filePath, "utf8"));
      config = withRuntimeDefaults(
        AppConfigSchema.parse(deepMerge(DEFAULT_CONFIG, raw))
      );
      persist();
    } else {
      config = withRuntimeDefaults(DEFAULT_CONFIG);
      persist();
    }
  } catch (err) {
    console.error("[store] invalid config, using defaults", err);
    config = withRuntimeDefaults(DEFAULT_CONFIG);
  }
  return config;
}

export function getConfig(): AppConfig {
  return config;
}

/** Absolute path to the on-disk config file (for "reveal in Finder"). */
export function getConfigPath(): string {
  return filePath;
}

/** Reset everything to defaults (used by "Reset all data"). */
export function resetConfig(): AppConfig {
  config = withRuntimeDefaults(DEFAULT_CONFIG);
  persist();
  for (const listener of listeners) listener(config);
  return config;
}

/** Deep-merge a (validated) patch, re-validate, persist, notify. */
export function setConfig(patch: unknown): AppConfig {
  config = withRuntimeDefaults(
    AppConfigSchema.parse(deepMerge(config, patch ?? {}))
  );
  persist();
  for (const listener of listeners) listener(config);
  return config;
}

export function onConfigChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
