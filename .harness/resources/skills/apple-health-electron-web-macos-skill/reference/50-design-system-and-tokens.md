# Design System and Tokens

The design system should feel Apple-platform-native without copying Apple assets.

## Token principles

- Use semantic tokens, not one-off colors.
- Respect light/dark/high-contrast modes.
- Use system font stacks.
- Use density and spacing appropriate for desktop.
- Use subtle surfaces, separators, and focus states.
- Use chart/ring colors consistently but never as the only status indicator.

## CSS token baseline

```css
:root {
  color-scheme: light dark;

  --font-system: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
  --font-mono: "SF Mono", ui-monospace, Menlo, Consolas, monospace;

  --radius-card: 18px;
  --radius-control: 10px;
  --radius-pill: 999px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  --surface-window: #f5f5f7;
  --surface-sidebar: color-mix(in srgb, var(--surface-window), white 40%);
  --surface-card: rgba(255, 255, 255, 0.82);
  --surface-card-hover: rgba(255, 255, 255, 0.94);
  --separator: rgba(60, 60, 67, 0.18);
  --text-primary: #1d1d1f;
  --text-secondary: rgba(60, 60, 67, 0.72);
  --text-tertiary: rgba(60, 60, 67, 0.48);
  --accent: #0a84ff;
  --focus-ring: color-mix(in srgb, var(--accent), transparent 30%);

  --ring-move: #ff2d55;
  --ring-exercise: #32d74b;
  --ring-stand: #64d2ff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface-window: #101014;
    --surface-sidebar: rgba(28, 28, 30, 0.72);
    --surface-card: rgba(44, 44, 46, 0.76);
    --surface-card-hover: rgba(58, 58, 60, 0.86);
    --separator: rgba(235, 235, 245, 0.16);
    --text-primary: #f5f5f7;
    --text-secondary: rgba(235, 235, 245, 0.72);
    --text-tertiary: rgba(235, 235, 245, 0.48);
  }
}
```

Use the SF Pro name only as part of the system stack. Do not bundle Apple fonts.

## Typography hierarchy

| Role | Desktop size | Notes |
| --- | ---: | --- |
| Window title / page title | 24-32 | Use sparingly; desktop titlebars already provide context |
| Section title | 18-22 | For Summary sections and detail headers |
| Card metric value | 28-48 | Large and readable, tabular numerals if available |
| Card label | 13-15 | Use sentence case |
| Secondary explanation | 13-15 | Avoid tiny gray text for health-like content |
| Table/sample detail | 12-14 | Allow resize/zoom and accessible contrast |

Useful CSS:

```css
.metric-value {
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
}
```

## Layout tokens

Desktop Health-style windows need generous whitespace but not mobile padding.

```css
:root {
  --sidebar-width: 236px;
  --toolbar-height: 52px;
  --content-max-width: 1180px;
  --card-min-width: 240px;
  --card-padding: 18px;
  --grid-gap: 16px;
}
```

## Component visual language

### Cards

- rounded 16-22px;
- subtle border/separator;
- no heavy shadows;
- hover states only on interactive cards;
- clear focus ring;
- top label, large value, small trend/explanation;
- optional source/provenance footer.

### Sidebars

- selected state is clear but calm;
- icons are optional and should be custom or licensed;
- group categories logically;
- include import/status affordance near bottom if data is local.

### Toolbars

- keep primary actions visible but restrained;
- use native app menu for less frequent commands;
- provide search/command palette for keyboard users;
- never crowd traffic lights.

### Rings

- use high-saturation colors only for active progress;
- support dark mode by adjusting track opacity;
- include value and label next to or inside ring;
- render text fallback for screen readers.

### Badges

- make your own badge art system;
- distinguish locked, unlocked, in-progress, and expired states;
- include rule explanation and unlock date;
- avoid mimicking Apple award shapes exactly.

## Accessibility tokens

- Minimum interactive target: 28x28 on dense desktop, 36x36 preferred.
- Focus ring visible on keyboard focus.
- Reduced motion changes ring sweep to immediate or short opacity transition.
- High-contrast mode increases separators and disables low-opacity text.
- All charts and rings have textual summaries.

## Brand safety

Allowed:

- system font stack;
- semantic colors;
- rounded cards;
- sidebar/toolbar patterns;
- custom symbols inspired by your domain;
- ring-style goal visualization.

Not allowed:

- shipping Apple SF font files;
- copying Apple Health icons, app icon, badge artwork, or screenshots;
- copying exact screen layouts and wording;
- using Apple trademarks in a way that implies affiliation.
