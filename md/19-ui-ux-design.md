# 19 · UI/UX & Design

*Status: 🟡 Draft*

The design north star is the **Apple Health app**: dense data made calm,
legible, and personal. This doc defines the design language and the
screen-by-screen experience.

## Design principles

1. **Calm, not a cockpit.** A health app, not a trading terminal. Generous
   whitespace, a few strong summaries, depth on demand.
2. **Summary → detail.** Lead with rings and a one-line digest; every summary
   drills into real numbers and then into source evidence.
3. **Personal framing.** Everything relative to *your* baseline. "Better than
   your two-week median," never a global score.
4. **One clear action per item.** Findings and experiments each have an obvious
   primary action; avoid decision paralysis.
5. **Native macOS feel.** SF Pro type, system materials/vibrancy, light/dark,
   reduced-motion respected. It should feel like it belongs in the menu bar.
6. **Trust through transparency.** Confidence labels, evidence links, and diffs
   are always one tap away.

## Visual language

- **Rings**: three concentric rings (Efficiency / Effectiveness / Alignment) à la
  Activity, each a 0–100 baseline-normalized score with a direction and color.
  Tap → metric breakdown.
- **Color**: semantic, restrained — green (win/improved), amber (watch/mistake),
  red (regressed/risk), neutral grays for body. Color never the only signal
  (accessibility).
- **Typography**: SF Pro; large rounded numerals for headline metrics; clear
  hierarchy.
- **Sparklines & trend charts**: small multiples in the report; full charts in
  Trends with experiment/config annotations.
- **Cards**: findings and experiments are cards with type icon, title, evidence
  affordance, and a primary action.
- **Motion**: subtle. A gentle "dreaming" shimmer on the icon; rings animate on
  open; respect reduced-motion.

## Screen-by-screen

### Menu-bar glance (popover)
- Three rings + the digest sentence.
- Buttons: **Dream now**, **Open report**.
- If a report is unreviewed: a "New dream ready" banner.

### Report — Overview tab
- Header: date range, # sessions, harnesses, overall status.
- Rings (expanded) + digest.
- "Top metrics" strip: ~6 headline metrics with Δ and sparkline.
- Findings list (ranked, capped) as cards.
- Experiments section: new proposals + verdicts on running experiments.
- Memory proposals (collapsed by default).

### Report — Vitals tab
- Each ring expanded into its component metrics with formula-on-tap.
- Per-project / per-harness / per-model breakdowns (segmented control).

### Report — Trends tab
- Pick a metric → 7/30/90-day chart.
- Annotations: experiment start/stop, major config changes, notable findings.

### Finding detail
- Title, body, type, confidence, impact.
- **Evidence**: expandable list of the actual session moments (redacted per
  settings), each linking to the source.
- **Proposed action**: rendered as a diff (for config/memory) or a description;
  primary action button + secondary (snooze/reject/turn into experiment/explain).

### Experiment detail / Lab
- Hypothesis, scope, intervention, success metrics, progress ("4/5 sessions").
- For concluded: the verdict with effect size + uncertainty + guardrail check.
- Actions: enable / pause / adopt / revert.

### Settings
- **Privacy**: local-only vs cloud REM; redaction preview; raw-text retention
  toggle.
- **Schedule**: nightly time, idle trigger, catch-up.
- **Connectors**: which harnesses; paths; backfill horizon.
- **Budget**: per-dream token/cost cap; model selection.
- **Notifications**: morning nudge on/off, Focus respect.

## Empty, loading, and error states

- **First run / no data**: friendly onboarding, offer "Dream now."
- **Dreaming**: progressive — vitals first, findings stream in (`15`).
- **Partial dream**: clearly show "vitals ready, insights failed — retry."
- **Low data**: "Only 3 sessions yesterday — findings are low-confidence."
- **No findings**: a calm "Quiet night. Nothing notable — here's your trend."
  (Not every day has insights; don't manufacture them.)

## Tone of voice

Plain, specific, honest, encouraging-but-not-cloying. "Tokens-per-change dropped
12% — nice." "Re-ask rate ticked up on UI work; want to test a fix?" Never
hype, never shame. The product is a calm coach, not a dashboard or a nag.

## Design deliverables (when we build)

- A small component library (rings, metric card, finding card, experiment card,
  diff view, trend chart, segmented breakdown).
- Light/dark, reduced-motion, and VoiceOver specs for each.
- A clickable prototype of the morning ritual (glance → report → accept →
  enable) before building the engine UI.
