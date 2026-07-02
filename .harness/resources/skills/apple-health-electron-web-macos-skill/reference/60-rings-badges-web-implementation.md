# Rings and Badges for Web/Electron

Rings and badges should be generic domain components. They should not be hardcoded to Move/Exercise/Stand unless the product is explicitly an activity tracker.

## Domain model

```ts
export interface RingGoal {
  id: string;
  label: string;
  unit: string;
  value: number;
  goal: number;
  colorToken: string;
  schedule: 'daily' | 'weekly' | 'monthly' | 'custom';
}

export interface RingProgress extends RingGoal {
  ratio: number;       // value / goal
  percent: number;     // ratio * 100
  completed: boolean;
  overflowTurns: number;
  accessibleLabel: string;
}
```

## SVG rendering strategy

SVG is the best default for shared web/Electron rings:

- crisp at any desktop size;
- works in browser and Electron;
- easy to animate with CSS or Motion;
- accessible with ARIA labels;
- easier to export as SVG or embed in reports.

Use Canvas only for very dense visualizations or large numbers of animated rings.

## Ring math

```ts
const circumference = 2 * Math.PI * radius;
const normalized = Math.max(0, value / goal);
const displayedRatio = Math.min(normalized, 1);
const dash = displayedRatio * circumference;
const gap = circumference - dash;
```

Overflow options:

1. Add glow/cap marker after 100%.
2. Draw a second thinner orbit for overflow.
3. Show `128%` text and keep ring full.
4. Use partial second lap only when users understand the metaphor.

## Animation rules

- Enter: staggered sweep, 500-900ms max.
- Update: spring or eased tween of stroke dash offset.
- Completion: short glow or scale, not confetti by default.
- Reduced motion: no sweep, no glow, direct value change.
- Avoid animating many large rings during window resize.

## Ring states

| State | UI |
| --- | --- |
| empty | muted track, clear label, value `0 / goal` |
| in progress | colored arc, current value, remaining text |
| complete | full ring, completed label, optional subtle glow |
| overflow | full ring + overflow marker/text |
| no data | dashed/empty track and import/source explanation |
| partial source | warning/provenance chip |

## Badges

Badge logic should be replayable from facts.

```ts
export interface BadgeRule {
  id: string;
  title: string;
  description: string;
  category: 'streak' | 'milestone' | 'record' | 'challenge' | 'consistency';
  evaluate: (ctx: BadgeContext) => BadgeEvaluation;
}

export interface BadgeEvaluation {
  unlocked: boolean;
  progress: number;
  progressMax: number;
  unlockedAt?: string;
  reason: string;
}
```

## Badge examples

- First day completing all rings.
- Seven-day streak for a selected goal.
- Personal best for weekly minutes.
- Monthly challenge based on previous baseline.
- Recovery badge for returning after a missed week.
- Consistency badge for low variance.

## Desktop badge UI

Desktop badge views can be richer than mobile:

- grid of unlocked and locked badges;
- detail inspector with rule, history, and related metrics;
- timeline of recent unlocks;
- challenge progress cards;
- filters by category;
- export/share image generated from custom brand artwork.

## Accessibility requirements

Rings and badges must not rely on color alone.

For rings:

```tsx
<svg role="img" aria-labelledby={titleId descId}>
  <title id={titleId}>Focus ring</title>
  <desc id={descId}>42 of 60 minutes complete, 70 percent of daily goal.</desc>
</svg>
```

For badges:

- label locked/unlocked state;
- state reason in text;
- progress value in text;
- keyboard navigable grid;
- no badge art required to understand status.
