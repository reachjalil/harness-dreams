# 100 — Design System Tokens

The visual goal is **Apple-platform native**, not Apple-branded.

## Token categories

```text
color
  background
  groupedBackground
  cardBackground
  labelPrimary
  labelSecondary
  separator
  accent
  success
  warning
  destructive
  ringMoveInspired
  ringExerciseInspired
  ringStandInspired

spacing
  xxs xs sm md lg xl xxl

radius
  card
  pill
  sheet
  widget

typography
  largeTitle
  title1
  title2
  headline
  body
  callout
  footnote
  caption
  metricHero

motion
  durationFast
  durationNormal
  durationSlow
  springGentle
  springCelebration
```

## Typography pattern

Health-style metric cards often need:

- Small uppercase or semibold label.
- Huge number.
- Unit attached but visually secondary.
- Subtitle with context.
- Chart or progress visual.

Example:

```text
STEPS
6,420
Today · 82% of goal
```

## Color strategy

Use semantic colors and dynamic platform colors where possible.

Do:

- Use system background colors.
- Support dark mode.
- Use accessible contrast.
- Create brand-owned ring colors.
- Test under increased contrast and color filters.

Do not:

- Copy Apple app icons.
- Bundle Apple font files.
- Use Apple badges without following guidelines.
- Rely on color alone to distinguish rings.

## Card style

```ts
card: {
  borderRadius: 18,
  padding: 16,
  minHeight: 96,
}
```

Health-style cards are generous, readable, and calm. Avoid dense dashboards.

## Layout rhythm

Top-level screens:

- 16–20 px horizontal padding.
- 12–16 px card gaps.
- Large title.
- Scrollable grouped sections.
- Cards before raw tables.

Detail pages:

- Hero metric.
- Chart.
- Highlights/trends.
- Related data.
- Sources and settings.

## Icon strategy

For iOS-native icons, use SF Symbols through platform-native rendering where available, or use a custom icon set with the same semantic clarity. Do not redistribute Apple symbol/font files in your repo or artifact.

## Motion style

- Calm, responsive, short.
- Rings can animate on first load, but should not replay aggressively.
- Badge unlock can be celebratory but brief.
- All motion respects Reduce Motion.

## Watch sizing

Watch UI needs:

- fewer cards.
- larger touch targets.
- no dense charts.
- one primary action.
- immediate legibility.
