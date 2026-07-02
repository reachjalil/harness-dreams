import { Platform } from 'react-native';

export const healthTokens = {
  color: {
    background: 'systemBackground',
    groupedBackground: 'systemGroupedBackground',
    cardBackground: 'secondarySystemGroupedBackground',
    labelPrimary: 'label',
    labelSecondary: 'secondaryLabel',
    separator: 'separator',
    accent: '#0A84FF',
    success: '#30D158',
    warning: '#FFD60A',
    destructive: '#FF453A',

    // Brand-owned ring colors. Do not copy Apple assets or exact artwork.
    ringPrimary: '#FF3B5F',
    ringSecondary: '#35D15F',
    ringTertiary: '#32ADE6',
  },
  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    card: 18,
    pill: 999,
    sheet: 24,
    widget: 22,
  },
  typography: {
    largeTitle: { fontSize: 34, fontWeight: '700' as const, lineHeight: 41 },
    title1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
    title2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
    headline: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
    body: { fontSize: 17, fontWeight: '400' as const, lineHeight: 22 },
    callout: { fontSize: 16, fontWeight: '400' as const, lineHeight: 21 },
    footnote: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
    caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
    metricHero: { fontSize: 48, fontWeight: '700' as const, lineHeight: 54 },
  },
  motion: {
    durationFast: 180,
    durationNormal: 320,
    durationSlow: 520,
    springGentle: { damping: 18, stiffness: 160 },
    springCelebration: { damping: 12, stiffness: 220 },
  },
};

export function systemFontFamily() {
  // Do not bundle Apple font files. Let the platform supply the system font.
  return Platform.select({ ios: undefined, android: 'sans-serif', default: undefined });
}
