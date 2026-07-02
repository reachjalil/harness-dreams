import type { RingKey } from "../domain/types";

export const colors = {
  accent: "#0a84ff",
  accentMuted: "rgba(10, 132, 255, 0.16)",
  background: "#f6f8fb",
  blue: "#0a84ff",
  card: "#ffffff",
  elevated: "#f9fbff",
  green: "#34c759",
  groupedBackground: "#eef2f7",
  heroBorder: "rgba(10, 132, 255, 0.22)",
  heroSurface: "rgba(10, 132, 255, 0.1)",
  label: "#111827",
  onAccent: "#ffffff",
  orange: "#ff9500",
  progressTrack: "rgba(17, 24, 39, 0.12)",
  red: "#ff3b30",
  redMuted: "rgba(255, 59, 48, 0.18)",
  ringAlignment: "#af52de",
  ringEffectiveness: "#30d158",
  ringEfficiency: "#64d2ff",
  secondary: "#4b5563",
  separator: "rgba(17, 24, 39, 0.1)",
  separatorStrong: "rgba(17, 24, 39, 0.22)",
  shadow: "#0f172a",
  tertiary: "#7b8794",
  violet: "#5856d6",
  yellow: "#ffcc00",
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};

export function ringColor(key: RingKey): string {
  if (key === "efficiency") return colors.ringEfficiency;
  if (key === "effectiveness") return colors.ringEffectiveness;
  return colors.ringAlignment;
}

export function ringMutedColor(key: RingKey): string {
  return `${ringColor(key)}33`;
}
