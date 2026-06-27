import { z } from "zod";

/**
 * Zod schemas validating everything that crosses renderer → main.
 * Main-process only (do not import from the sandboxed preload).
 */

export const PrivacyModeSchema = z.enum(["local", "cloud"]);
export const AnalysisDepthSchema = z.enum(["light", "standard", "deep"]);
export const ScheduleModeSchema = z.enum(["nightly", "manual"]);

const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const AppConfigSchema = z.object({
  onboarded: z.boolean(),
  privacyMode: PrivacyModeSchema,
  schedule: z.object({
    mode: ScheduleModeSchema,
    time: TimeSchema,
  }),
  notifications: z.boolean(),
  analysisDepth: AnalysisDepthSchema,
  launchAtLogin: z.boolean(),
  reduceMotion: z.boolean(),
  connectors: z.object({
    claudeCode: z.boolean(),
    codex: z.boolean(),
    cursor: z.boolean(),
  }),
});

/** A partial config patch from a renderer; deep-merged + re-validated in main. */
export const ConfigPatchSchema = z
  .object({
    onboarded: z.boolean(),
    privacyMode: PrivacyModeSchema,
    schedule: z
      .object({
        mode: ScheduleModeSchema,
        time: TimeSchema,
      })
      .partial(),
    notifications: z.boolean(),
    analysisDepth: AnalysisDepthSchema,
    launchAtLogin: z.boolean(),
    reduceMotion: z.boolean(),
    connectors: z
      .object({
        claudeCode: z.boolean(),
        codex: z.boolean(),
        cursor: z.boolean(),
      })
      .partial(),
  })
  .partial();
export type ConfigPatch = z.infer<typeof ConfigPatchSchema>;
