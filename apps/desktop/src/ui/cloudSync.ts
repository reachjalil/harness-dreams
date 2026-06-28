import type { IconName } from "./icons";

/**
 * One source of truth for the (coming-soon) Cloud Sync upgrade copy, shared by
 * the onboarding step and the always-present upgrade dialog so the price and
 * the privacy promise never drift between the two surfaces.
 *
 * The product promise, stated once: Cloud Sync is a paid convenience that syncs
 * only the *cycle signal* — your scores, findings, and goals — to an iPhone and
 * Apple Watch app. Your transcripts, code, and secrets never leave your Mac, and
 * the app stays open source. Local is, and always will be, free.
 */

export const CLOUD_SYNC_PRICE = "$5";
export const CLOUD_SYNC_CADENCE = "/mo";
export const CLOUD_SYNC_PRICE_LABEL = `${CLOUD_SYNC_PRICE}${CLOUD_SYNC_CADENCE}`;

/** Headline used wherever we introduce the feature. */
export const CLOUD_SYNC_TAGLINE =
  "Read your harness health on iPhone & Apple Watch — like a sleep app for your coding agents.";

export interface CloudSyncBenefit {
  icon: IconName;
  title: string;
  body: string;
}

export const CLOUD_SYNC_BENEFITS: CloudSyncBenefit[] = [
  {
    icon: "iphone",
    title: "Your harness health, on iPhone & Apple Watch",
    body: "Check your sleep cycle, scores, and goals from your wrist — and accept tomorrow's improvements on the go, just like reviewing last night's sleep.",
  },
  {
    icon: "privacy",
    title: "Your code never leaves your Mac",
    body: "Cloud Sync carries only the cycle signal — scores, findings, and goals. Transcripts, code, and secrets stay local; the analysis still runs on your machine.",
  },
  {
    icon: "opensource",
    title: "Open source, always",
    body: "Harness Dreams is open source and will stay that way. Cloud Sync is an optional convenience — never a lock-in, never a paywall around your own data.",
  },
];

/** Short reassurance line shown under the upgrade call-to-action. */
export const CLOUD_SYNC_FOOTNOTE =
  "Local-only stays free, forever. You can keep everything on this Mac.";
