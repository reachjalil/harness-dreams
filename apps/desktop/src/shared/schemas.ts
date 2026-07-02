import { z } from "zod";

/**
 * Zod schemas validating everything that crosses renderer → main.
 * Main-process only (do not import from the sandboxed preload).
 */

export const PrivacyModeSchema = z.enum(["local", "cloud"]);
export const AnalysisDepthSchema = z.enum(["light", "standard", "deep"]);
export const GuidanceApplyModeSchema = z.enum(["branch", "direct"]);
export const ScheduleModeSchema = z.enum(["daily", "manual"]);
export const AnalysisSourceSchema = z.enum(["claude-code", "codex", "code"]);
export const HarnessKindSchema = z.enum([
  "claude-code",
  "codex",
  "cursor",
  "code",
]);
export const InsightRunnerProviderSchema = z.enum(["claude-code", "codex"]);
export const CloudSyncDeviceKindSchema = z.enum([
  "desktop",
  "iphone",
  "ipad",
  "watch",
]);
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
  secretHash: z.string().min(1),
  secretCiphertext: z.string().optional(),
  createdAt: z.number(),
  secretIssuedAt: z.number(),
  lastSeenAt: z.number().optional(),
  revokedAt: z.number().optional(),
  lastAckedRevision: z.number().int().min(0).optional(),
});
const BackupKeyRecordSchema = z.object({
  keyId: z.string().min(1),
  backupKey: z.string().min(1),
  backupEpochId: z.string().min(1),
  retiredAt: z.number(),
});
const CloudSyncSchema = z.object({
  enabled: z.boolean(),
  paidPlan: z.boolean(),
  devBypassPaidPlan: z.boolean(),
  cloudApiBaseUrl: z.string(),
  cloudUserId: z.string(),
  deviceId: z.string(),
  deviceName: z.string(),
  devices: z.array(CloudSyncDeviceSchema),
  backupEnabled: z.boolean(),
  backupKey: z.string(),
  backupKeyId: z.string(),
  backupRetainedKeys: z.array(BackupKeyRecordSchema),
  backupEpochId: z.string(),
  backupRetentionDays: z.number().int().min(1).max(365),
  lastBackupAt: z.number().optional(),
  lastBackupRevision: z.number().int().min(0).optional(),
  lastBackupFailureAt: z.number().optional(),
  lastBackupFailureRevision: z.number().int().min(0).optional(),
  nextBackupRetryAt: z.number().optional(),
  backupRetryAttempt: z.number().int().min(0).optional(),
  lastBackupError: z.string().optional(),
});
const TelemetryPricePointSchema = z.object({
  inputPerMTok: z.number().min(0),
  outputPerMTok: z.number().min(0),
  cacheReadPerMTok: z.number().min(0).optional(),
  cacheCreatePerMTok: z.number().min(0).optional(),
});
const TelemetrySchema = z.object({
  enabled: z.boolean(),
  watch: z.boolean(),
  retentionDays: z.number().int().min(1).max(365),
  rawTextRetention: z.boolean(),
  priceTable: z.record(z.string(), TelemetryPricePointSchema),
});

export const AppConfigSchema = z.object({
  onboarded: z.boolean(),
  userName: z.string(),
  demoMode: z.boolean(),
  showOnboardingOnLaunch: z.boolean(),
  privacyMode: PrivacyModeSchema,
  schedule: z.object({
    mode: ScheduleModeSchema,
    time: TimeSchema,
  }),
  notifications: z.boolean(),
  analysisDepth: AnalysisDepthSchema,
  guidanceApplyMode: GuidanceApplyModeSchema,
  insightRunner: z.object({
    provider: InsightRunnerProviderSchema,
    model: z.string(),
    claudePath: z.string(),
    codexPath: z.string(),
    timeoutMs: z.number().int().positive(),
  }),
  launchAtLogin: z.boolean(),
  reduceMotion: z.boolean(),
  telemetry: TelemetrySchema,
  cloudSync: CloudSyncSchema,
  companionSyncInterest: z.boolean(),
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
    userName: z.string(),
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
    guidanceApplyMode: GuidanceApplyModeSchema,
    insightRunner: z
      .object({
        provider: InsightRunnerProviderSchema,
        model: z.string(),
        claudePath: z.string(),
        codexPath: z.string(),
        timeoutMs: z.number().int().positive(),
      })
      .partial(),
    launchAtLogin: z.boolean(),
    reduceMotion: z.boolean(),
    telemetry: TelemetrySchema.partial(),
    cloudSync: CloudSyncSchema.partial(),
    companionSyncInterest: z.boolean(),
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

export const TelemetryMetricDetailInputSchema = z.object({
  metricId: z.string().min(1),
  range: z.enum(["24h", "7d", "30d", "90d"]).optional(),
  filters: z
    .object({
      source: HarnessKindSchema.optional(),
      projectPath: z.string().optional(),
      model: z.string().optional(),
    })
    .optional(),
});

export const TelemetryRefreshInputSchema = z
  .object({
    reason: z.string().optional(),
  })
  .optional();
