import { z } from "zod";

/**
 * Zod schemas validating everything that crosses renderer → main.
 * Main-process only (do not import from the sandboxed preload).
 */

export const PrivacyModeSchema = z.enum(["local", "cloud"]);
export const AnalysisDepthSchema = z.enum(["light", "standard", "deep"]);
export const ScheduleModeSchema = z.enum(["nightly", "manual"]);
export const AnalysisSourceSchema = z.enum(["claude-code", "codex", "code"]);
export const RemRunnerProviderSchema = z.enum(["claude-code", "codex"]);
export const CloudSyncDeviceKindSchema = z.enum(["iphone", "ipad", "watch"]);
export const CloudSyncDeviceStatusSchema = z.enum([
  "pending",
  "active",
  "revoked",
]);

const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const CloudSyncDeviceSchema = z.object({
  deviceId: z.string().min(1),
  deviceName: z.string().min(1),
  kind: CloudSyncDeviceKindSchema,
  status: CloudSyncDeviceStatusSchema,
  tokenHash: z.string().min(1),
  createdAt: z.number(),
  lastTokenIssuedAt: z.number(),
  lastSeenAt: z.number().optional(),
  revokedAt: z.number().optional(),
});
const CloudSyncSchema = z.object({
  enabled: z.boolean(),
  paidPlan: z.boolean(),
  devBypassPaidPlan: z.boolean(),
  atlasUri: z.string(),
  databaseName: z.string().min(1),
  userId: z.string(),
  jwtSecret: z.string(),
  deviceId: z.string(),
  deviceName: z.string(),
  syncIntervalMs: z.number().int().min(5_000),
  devices: z.array(CloudSyncDeviceSchema),
});

export const AppConfigSchema = z.object({
  onboarded: z.boolean(),
  demoMode: z.boolean(),
  showOnboardingOnLaunch: z.boolean(),
  privacyMode: PrivacyModeSchema,
  schedule: z.object({
    mode: ScheduleModeSchema,
    time: TimeSchema,
  }),
  notifications: z.boolean(),
  analysisDepth: AnalysisDepthSchema,
  remRunner: z.object({
    provider: RemRunnerProviderSchema,
    model: z.string().min(1),
    claudePath: z.string(),
    codexPath: z.string(),
    timeoutMs: z.number().int().positive(),
  }),
  launchAtLogin: z.boolean(),
  reduceMotion: z.boolean(),
  cloudSync: CloudSyncSchema,
  cloudSyncInterest: z.boolean(),
  connectors: z.object({
    claudeCode: z.boolean(),
    codex: z.boolean(),
    cursor: z.boolean(),
  }),
  projects: z.array(
    z.object({
      path: z.string(),
      name: z.string(),
      sources: z.array(AnalysisSourceSchema),
      enabled: z.boolean(),
      addedAt: z.number(),
    })
  ),
});

/** A partial config patch from a renderer; deep-merged + re-validated in main. */
export const ConfigPatchSchema = z
  .object({
    onboarded: z.boolean(),
    demoMode: z.boolean(),
    showOnboardingOnLaunch: z.boolean(),
    privacyMode: PrivacyModeSchema,
    schedule: z
      .object({
        mode: ScheduleModeSchema,
        time: TimeSchema,
      })
      .partial(),
    notifications: z.boolean(),
    analysisDepth: AnalysisDepthSchema,
    remRunner: z
      .object({
        provider: RemRunnerProviderSchema,
        model: z.string().min(1),
        claudePath: z.string(),
        codexPath: z.string(),
        timeoutMs: z.number().int().positive(),
      })
      .partial(),
    launchAtLogin: z.boolean(),
    reduceMotion: z.boolean(),
    cloudSync: CloudSyncSchema.partial(),
    cloudSyncInterest: z.boolean(),
    connectors: z
      .object({
        claudeCode: z.boolean(),
        codex: z.boolean(),
        cursor: z.boolean(),
      })
      .partial(),
    projects: z.array(
      z.object({
        path: z.string(),
        name: z.string(),
        sources: z.array(AnalysisSourceSchema),
        enabled: z.boolean(),
        addedAt: z.number(),
      })
    ),
  })
  .partial();
export type ConfigPatch = z.infer<typeof ConfigPatchSchema>;
