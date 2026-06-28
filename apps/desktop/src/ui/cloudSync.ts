import type { IconName } from "./icons";

/**
 * One source of truth for Cloud Sync copy, shared by the onboarding step and
 * the always-present dialog.
 *
 * The product promise, stated once: Cloud Sync carries only the cycle signal —
 * scores, summaries, findings, and action choices — to MongoDB Atlas so phone
 * and watch clients can read it. Transcripts, code, secrets, local repo paths,
 * and patch snippets never leave the Mac.
 */

/** Headline used wherever we introduce the feature. */
export const CLOUD_SYNC_TAGLINE =
  "Read your harness health on iPhone & Apple Watch with MongoDB Atlas-backed sync.";

export interface CloudSyncBenefit {
  icon: IconName;
  title: string;
  body: string;
}

export const CLOUD_SYNC_BENEFITS: CloudSyncBenefit[] = [
  {
    icon: "iphone",
    title: "Your harness health, on iPhone & Apple Watch",
    body: "Check Sleep Cycle history, scores, summaries, and goals from your wrist — and accept tomorrow's improvements on the go.",
  },
  {
    icon: "privacy",
    title: "Your code never leaves your Mac",
    body: "Cloud Sync carries only the cycle signal. Transcripts, code, local repo paths, patch snippets, and secrets stay local.",
  },
  {
    icon: "opensource",
    title: "Continuous conflict resolution",
    body: "Desktop, phone, and watch choices use a simple newest-decision-wins rule per finding, then the desktop applies accepted changes when it reconnects.",
  },
];

/** Short reassurance line shown under the upgrade call-to-action. */
export const CLOUD_SYNC_FOOTNOTE =
  "Use the same Atlas database and user id on every device.";
