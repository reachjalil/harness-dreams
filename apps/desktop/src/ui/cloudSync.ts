import type { IconName } from "./icons";

/**
 * One source of truth for Private Device Sync copy, shared by onboarding and
 * the always-present dialog.
 *
 * The default product promise, stated once: Cloudflare routes only transient
 * encrypted WebRTC signaling. The optional offline fallback stores only an
 * encrypted latest snapshot that devices decrypt locally.
 */

/** Headline used wherever we introduce the feature. */
export const CLOUD_SYNC_TAGLINE =
  "Connect this Mac directly to iPhone and Apple Watch for companion review.";

export interface CloudSyncBenefit {
  icon: IconName;
  title: string;
  body: string;
}

export const CLOUD_SYNC_BENEFITS: CloudSyncBenefit[] = [
  {
    icon: "iphone",
    title: "Your harness health, on iPhone & Apple Watch",
    body: "Check Health Review history, scores, summaries, and goals from your phone or wrist after pairing with the local desktop app.",
  },
  {
    icon: "privacy",
    title: "Direct by default, encrypted fallback by choice",
    body: "Cloudflare is only a temporary signaling room unless you opt in to encrypted fallback snapshots. Reports and decisions decrypt only on your devices.",
  },
  {
    icon: "opensource",
    title: "2-week trial",
    body: "Local Mac use stays free. The paid plan starts only when you keep the iPhone and Apple Watch connection after the trial.",
  },
];

/** Short reassurance line shown under the upgrade call-to-action. */
export const CLOUD_SYNC_FOOTNOTE =
  "Pair with the QR code; this Mac remains the sync authority.";
