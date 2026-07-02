# 50 — Activity Rings Engine

A production ring system should be generic, not hardcoded to Apple’s Move, Exercise, and Stand.

## Generic ring model

```ts
export interface RingDefinition {
  id: string;
  label: string;
  metricId: string;
  goal: number;
  unit: string;
  cadence: 'daily' | 'weekly' | 'monthly' | 'custom';
  colorToken: string;
  order: number;
  supportsOverflow: boolean;
}

export interface RingProgress {
  ringId: string;
  value: number;
  goal: number;
  progress: number; // value / goal, may exceed 1
  completed: boolean;
  overflowLaps: number;
  remainder: number;
}
```

## Ring behavior

Support:

- 0% empty state.
- 1–99% partial sweep.
- 100% closed ring.
- Above 100% overflow lap or glow/completion indicator.
- Reduced Motion fallback.
- VoiceOver label like: “Focus ring, 42 of 60 minutes, 70 percent complete.”
- Dynamic labels and units.
- Dark and light mode contrast.

## Visual anatomy

```text
outer radius
  stroke width
    ring track
    active arc
    rounded cap
    gradient or solid accent
center gap
```

## Animation states

| State | Motion |
| --- | --- |
| First load | Stagger rings from 0 to current progress |
| Increment | Animate only changed arc segment |
| Completion | Subtle scale/haptic/confetti-lite; avoid overwhelming motion |
| Overflow | Continue lap or show secondary highlight |
| Goal edit | Animate old target to new target |
| Reduced Motion | Crossfade or static update |

## Why build custom with Skia

`react-native-activity-rings` is useful as a study reference. For production, custom Skia gives better control over:

- Rounded caps.
- Sweep gradients.
- Overflow progress.
- Pixel-perfect stroke math.
- Animated path interpolation.
- Watch-sized variants.
- Accessibility overlays.

## Component API

```tsx
<ActivityRings
  rings={ringProgress}
  size={220}
  strokeWidth={18}
  gap={6}
  animate
  reducedMotion={isReduceMotionEnabled}
  onRingPress={(ring) => navigateToMetric(ring.metricId)}
/>
```

## Non-fitness examples

### Learning app

- Read ring: pages read / daily goal.
- Practice ring: minutes practiced / daily goal.
- Review ring: spaced-repetition reviews completed / daily goal.

### Productivity app

- Focus ring: deep-work minutes.
- Recovery ring: breaks taken.
- Planning ring: tasks triaged.

### Hydration app

- Water ring: ounces/liters consumed.
- Consistency ring: logging windows completed.
- Electrolyte ring: optional nutrition goal.

## Ring rendering checklist

- Stroke caps are rounded.
- Ring gaps remain visually even at all sizes.
- Values above 100% do not look broken.
- Labels are readable at large Dynamic Type.
- Rings remain distinguishable without color alone.
- Loading/sync states do not imply missing progress.
- Watch variant can render at 130–170 points.
