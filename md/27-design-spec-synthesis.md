# Harness Dreams — Synthesized Design Spec ("Clinic")

The single, implementation-ready spec. Flat, Apple-Health-grade dark UI. System sans only (no serif). Accents = teal / blue / violet only; no yellow/brown/amber. One persistent sidebar, one page-header pattern, one card vocabulary, one hero metric per page. Every surface answers: **What happened? / Why does it matter? / What next?**

The product spine is **Human ↔ Agent alignment**: an alignment score split into a human side and an agent side, categorized friction points, and findings that carry a recommended action + category, flowing through a Cycle review wizard into an action queue and the experiments loop.

**HARD CONSTRAINT — data contract preserved.** The renderer talks to main via `window.hd` + `useHarnessDreams`. Rings keyed `efficiency`/`effectiveness`/`alignment`; metric keys `tokens_per_change`/`cost`/`reask`/`cache`/`tool_success`/`sessions`; `Finding`/`Experiment`/`DreamReport` shapes are read by main (`tray.ts`, `controller.ts`, `reports.ts`). All type changes below are **ADDITIVE + OPTIONAL**; UI degrades gracefully when new fields are absent. Keep `makeReport(timestamp, seed)` and `seedReports(now)` exports in `mock.ts`. Real repo names in mock data: `agent-fleet`, `harness-dreams`, `zod-to-sql`, `waker`.

---

## 1. Design Tokens

Drop-in replacement for the `:root` block in `styles.css`. Legacy names that other code resolves (`--bg`, `--panel`, `--panel-2`, `--accent`, `--violet`, `--good`, `--warn`, `--danger`, `--ring-efficiency`, `--ring-effectiveness`, `--ring-alignment`, `--radius`, `--radius-sm`, `--radius-xs`, `--font-display`) are **kept as aliases** so nothing breaks; their values change and the serif is removed.

### 1.1 Color — ink scale (flat near-black, cool-neutral, no navy)

```css
:root {
  --ink-900: #0b0e14;  /* app background / field */
  --ink-850: #0f131b;  /* sunken / scroll well */
  --ink-800: #141925;  /* card / panel / sidebar surface */
  --ink-750: #1a2130;  /* raised card / hover fill */
  --ink-700: #222a3a;  /* pressed / selected fill */
  --ink-600: #2b333f;  /* divider-on-fill */

  /* Legacy aliases */
  --bg: var(--ink-900);
  --surface: var(--ink-850);
  --panel: var(--ink-800);
  --panel-2: var(--ink-750);

  /* Text */
  --text:   #eef1f6;   /* primary */
  --text-2: #b6c0d0;   /* secondary copy / labels */
  --muted:  #8793a6;   /* tertiary / hints */
  --faint:  #5b6678;   /* disabled / axis */

  /* Hairlines & dividers */
  --border:        rgba(255, 255, 255, 0.07);
  --border-strong: rgba(255, 255, 255, 0.13);
  --hairline:      rgba(255, 255, 255, 0.06);
}
```

### 1.2 Color — accents (teal / blue / violet only)

```css
:root {
  --teal:        #2dd4bf;  /* human side · effectiveness · positive */
  --teal-700:    #14b8a6;
  --teal-weak:   rgba(45, 212, 191, 0.14);

  --blue:        #4f7cff;  /* efficiency · informational · links */
  --blue-700:    #3b62e8;
  --blue-weak:   rgba(79, 124, 255, 0.14);

  --violet:      #8b7bff;  /* alignment · agent side · attention / active */
  --violet-700:  #7c5cfc;
  --violet-weak: rgba(139, 123, 255, 0.16);
  --violet-line: rgba(139, 123, 255, 0.40);

  /* Legacy aliases */
  --accent:      var(--blue);
  --accent-weak: var(--blue-weak);
  --accent-line: rgba(79, 124, 255, 0.45);
  --iris:        var(--violet-700);

  /* Ring channels — KEEP the three RingKeys */
  --ring-efficiency:    var(--blue);
  --ring-effectiveness: var(--teal);
  --ring-alignment:     var(--violet);

  /* Cycle/progress accents reuse violet+blue (no cyan dominance) */
  --cycle:      var(--violet);
  --cycle-2:    var(--blue);
  --cycle-soft: var(--violet-weak);
}
```

### 1.3 Color — semantics (NO yellow / brown / amber anywhere)

```css
:root {
  --positive:      var(--teal);   /* good trend · win · "improved" · Collaborating */
  --positive-weak: var(--teal-weak);
  --attention:     var(--violet); /* active · running · needs-you · Friction */
  --attention-weak:var(--violet-weak);
  --negative:      #f0726a;       /* soft rose: bad trend · mistake/risk · "regressed" · Fighting */
  --negative-weak: rgba(240, 114, 106, 0.14);
  --info:          var(--blue);
  --neutral:       var(--muted);  /* flat · inconclusive · snoozed */
  --neutral-weak:  rgba(135, 147, 166, 0.12);

  /* Legacy aliases (remap warn → violet attention, NOT amber) */
  --good:   var(--positive);
  --warn:   var(--attention);
  --danger: var(--negative);
}
```

**Mapping rules.** `Metric.good===true` → `--positive`; `false` → `--negative`; `Trend "flat"` → `--neutral`. `FindingType`: win→positive, opportunity→info(blue), mistake/risk→negative. `ExperimentVerdict`: improved→positive, regressed→negative, inconclusive→neutral. Alignment bands: ≥80 Collaborating(teal) · 45–79 Friction(violet) · <45 Fighting(rose) — band color is for the **label chip only**, never a card background. No element uses more than one accent at a time; backgrounds are never an accent hue. Active/selected = `--ink-700` fill + 2px accent left rail (the only highlight device).

### 1.4 Typography — system sans only, weight-driven hierarchy, NO serif

```css
:root {
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
          "Segoe UI", system-ui, sans-serif;
  --font-num: var(--font);                 /* tabular numerals via font-variant */
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace; /* evidence, paths, diffs */
  --font-display: var(--font);             /* alias kept; serif DELETED */

  /* Type scale — only the single hero metric goes large */
  --t-hero:    48px;  /* hero metric ONLY, one per page */
  --t-display: 30px;  /* second-tier standout number (rare) */
  --t-title:   21px;  /* page title in workspace-head */
  --t-section: 16px;  /* card / section heading */
  --t-body:    14px;  /* body copy */
  --t-label:   13px;  /* metric labels, field labels, nav */
  --t-eyebrow: 11px;  /* UPPERCASE eyebrows, kickers, status chips */
  --t-mono:    12.5px;

  /* Weights — hierarchy = weight + color, not size */
  --w-reg:  450;
  --w-med:  540;
  --w-semi: 620;
  --w-bold: 720;

  color-scheme: dark;
  font-family: var(--font);
  font-feature-settings: "tnum" 1;
}
```

| Token | Weight | Treatment | Use |
|---|---|---|---|
| `--t-hero` | `--w-bold` | tabular nums, `letter-spacing:-0.02em` | the one hero metric per page |
| `--t-display` | `--w-bold` | tabular nums | second-tier number |
| `--t-title` | `--w-semi` | `letter-spacing:-0.01em` | page title |
| `--t-section` | `--w-semi` | — | card / section titles |
| `--t-body` | `--w-reg` | `line-height:1.5` | body copy |
| `--t-label` | `--w-med` | — | metric/field labels, nav |
| `--t-eyebrow` | `--w-semi` | UPPERCASE, `letter-spacing:0.08em`, `--muted` | eyebrows, kickers, status chips |
| `--t-mono` | `--w-med` | `--font-mono` | evidence pointers, file paths, config diffs |

Delete every `font-family: var(--font-display)` serif usage (`.sidebar-score`, `.hero-date`, `.workspace-head h2`, `.improvement-hero-copy h3`, `.cycle-copy h3`, `.scorering-num`, `.review-finding-main h3`, `.queue-cell b`, `.history-score b`). Never two competing large numbers on one screen. Numerals use `font-variant-numeric: tabular-nums`.

### 1.5 Spacing — 4px base + responsive insets

```css
:root {
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
  --s-5: 20px; --s-6: 24px; --s-7: 32px; --s-8: 40px; --s-9: 56px;

  --gutter:    clamp(16px, 3vw, 28px);  /* workspace horizontal inset */
  --card-pad:  clamp(14px, 1.4vw, 18px);
  --grid-gap:  clamp(12px, 1.2vw, 16px);
  --pad-block: 20px;
  --content-max: 1120px;                /* wide dashboard, not a 720px column */
}
```

No cards-inside-cards. Nested groupings use a hairline (`border-top: 1px solid var(--hairline)`) + an eyebrow sublabel, never another bordered box. All grids use `minmax(0, 1fr)` (never `minmax(420px,…)`); cards get `min-width: 0`.

### 1.6 Radius + flat elevation

```css
:root {
  --radius:    14px;  /* cards (legacy name kept) */
  --radius-sm: 10px;  /* buttons, inputs, chips */
  --radius-xs: 7px;   /* inline pills, tags */
  --r-pill:    999px;

  /* Elevation = flat fill + hairline + at most a whisper shadow. NEVER a glow. */
  --elev-0: none;
  --elev-1: 0 1px 0 rgba(0, 0, 0, 0.30);              /* card seat */
  --elev-2: 0 6px 20px -8px rgba(0, 0, 0, 0.55);      /* menus / popovers / overlays only */
  --focus:  0 0 0 2px var(--ink-900), 0 0 0 4px var(--violet-line);
}
```

| Level | Recipe | Where |
|---|---|---|
| field | `background: var(--ink-900)` | app + scroll background |
| card | `background: var(--ink-800); border:1px solid var(--border); box-shadow:var(--elev-1)` | every card |
| card-hover | `background: var(--ink-750); border-color: var(--border-strong)` | clickable cards |
| float | `background: var(--ink-750); border:1px solid var(--border-strong); box-shadow:var(--elev-2)` | menus, tooltips only |

**Hard removals (flatness).** Delete `body` radial gradient → flat `var(--bg)`. Delete `.app.shell` linear-gradient. Delete every `box-shadow: 0 0 Npx …glow…` and `drop-shadow(0 0 Npx …)` (`.brand-mark`, `.scorering`, `.onb-mark`, `.cycle-ring`, `.map-node`). Delete every decorative `::before` sweep (`.improvement-hero::before`, `.cycle-splash::before`, `.history-hero::before`, `.workspace-identity::before`).

### 1.7 Layout frame + motion tokens

```css
:root {
  --sidebar-w: clamp(196px, 16vw, 236px);
  --sidebar-rail: 64px;       /* collapsed icon rail < 920px */
  --titlebar-h: 30px;

  --ease:   cubic-bezier(0.22, 0.61, 0.36, 1);
  --dur-1:  120ms;  /* hover / micro */
  --dur-2:  180ms;  /* enter / step / queue insert */
  --dur-3:  500ms;  /* ring & sparkline fills */
  --dur-4:  800ms;  /* hero count-up */
}
```

---

## 2. Shared Component Contract (`components.tsx`)

Keep all existing exports (`BrandMark`, `Section`, `Segmented`, `Toggle`, `Button`, `Field`, `Pill`, `Rings`, `RingLegend`, `Stat`, `ScoreRing`, `Contributors`, `Sparkline`, `VitalCard`, `Option`). The `Button` variant union stays `"default" | "ghost" | "accent" | "danger"`. The `Pill` tone union stays `"neutral" | "good" | "warn" | "danger" | "accent"`. Add the components below.

```ts
// ── App shell ────────────────────────────────────────────────────────────────
export function Sidebar(props: {
  active: Tab;
  onNavigate: (tab: Tab) => void;
  alignment: number;            // 0..100, the persistent signature number
  band: AlignmentBand;          // "collaborating" | "friction" | "fighting"
  phase: DreamPhase;            // status dot + label
  lastDreamAt: number | null;
  unreviewed: number;          // badge count on Cycle (0 = hidden)
  onDreamNow: () => void;
}): ReactElement;

export function NavItem(props: {
  icon: ReactNode;
  label: string;
  active: boolean;
  badge?: number;               // violet dot + count
  onClick: () => void;
}): ReactElement;

export function PageHeader(props: {
  eyebrow: string;              // rangeLabel / page kicker, UPPERCASE
  title: string;
  subtitle: string;             // one-line "what this page is for"
  primary?: ReactNode;          // primary action (Button)
  secondary?: ReactNode;        // optional secondary action / report selector
}): ReactElement;

// ── Health / metric atoms ────────────────────────────────────────────────────
export function SummaryCard(props: {
  eyebrow: string;
  value: string | number;       // the metric
  trend?: { delta: number; tone: "positive" | "negative" | "neutral" };
  sublabel?: string;            // "why it matters" line
  action?: ReactNode;           // optional "what next" chip/link
  size?: "hero" | "default";    // "hero" → --t-hero; one per page
}): ReactElement;

export function MetricCell(props: {
  metric: Metric;
  series?: number[];            // optional sparkline
}): ReactElement;

export function RingChip(props: { ring: Ring }): ReactElement;
// slim label + score + delta + tiny arc; replaces the giant SVG on Dashboard

// ── Alignment (the spine) ────────────────────────────────────────────────────
export function AlignmentBar(props: {
  human: number;                // 0..100
  agent: number;                // 0..100
  band: AlignmentBand;
}): ReactElement;
// single split bar: You ⟷ Agent; midpoint gap = friction magnitude

export function AlignmentSides(props: {
  human: AlignmentSide;         // mood, question, signals[]
  agent: AlignmentSide;
}): ReactElement;
// two-column "Your side / Agent side" detail (Cycle hero)

export function FrictionChip(props: {
  point: FrictionPoint;         // type + example + linked findingId
  onOpen?: (findingId: string) => void;
}): ReactElement;

// ── Findings & actions ───────────────────────────────────────────────────────
export function CategoryChip(props: { category: ActionCategory }): ReactElement;
// "AGENTS.md update" | "Context doc" | "Prompt habit" | "Skill / routing"

export function FindingCard(props: {
  finding: Finding;
  category: ActionCategory;     // derived via categorize(finding)
  state?: ActionState;          // "open" | "accepted" | "snoozed" | "queued"
  onAccept?: () => void;
  onSnooze?: () => void;
  onQueue?: () => void;
  compact?: boolean;            // Dashboard top-findings vs full Cycle panel
}): ReactElement;
// fixed field order: type+confidence+project → title → body → EVIDENCE →
//   WHY YOU (userBenefit) / WHY AGENT (agentBenefit) → RECOMMENDED ACTION (action)
//   → CategoryChip → NEXT CYCLE WATCHES (reflection, collapsed)

// ── Cycle wizard ─────────────────────────────────────────────────────────────
export function CycleProgress(props: {
  progress: number;             // state.progress 0..1
  stage: string | null;
  stages: { at: number; label: string }[]; // DREAM_STAGES
  paused: boolean;
}): ReactElement;
// linear determinate bar + named stage list. Replaces StarField + 214px ring.

export function StepRail(props: {
  steps: { id: string; label: string; state: ActionState }[];
  activeId: string;
  queueCount: number;
  onSelect: (id: string) => void;
}): ReactElement;
// vertical list (no horizontal tab overflow); last entry = "Action queue (n)"

export function ActionQueueItem(props: {
  item: ActionQueueEntry;       // decision · category · action · project
  onApply?: () => void;
  onUndo?: () => void;
}): ReactElement;

// ── History & settings ───────────────────────────────────────────────────────
export function TrendChart(props: {
  series: { id: string; values: number[]; tone: string }[];
  labels: string[];
  activeIndex?: number;
  onPick?: (index: number) => void;
}): ReactElement;
// flat line chart; dots colored by alignment band; click → select cycle

export function HistoryRow(props: {
  report: DreamReport;
  selected: boolean;
  delta?: number | null;        // alignment Δ vs previous (memoized upstream)
  onSelect: (id: string) => void;
}): ReactElement;

export function CompareStrip(props: {
  current: DreamReport;
  previous: DreamReport | null; // null → "First cycle — no comparison yet"
}): ReactElement;

export function SettingsGroup(props: {
  title: string;
  children: ReactNode;          // rows separated by --hairline, no nested cards
}): ReactElement;

export function StatusChip(props: {
  label: string;
  on: boolean;                  // teal dot when on, faint when off
}): ReactElement;
```

### CSS class contract (per concern)

| Concern | Classes |
|---|---|
| Shell | `.app.shell`, `.titlebar`, `.sidebar`, `.workspace`, `.scroll` (max-width `--content-max`) |
| Sidebar | `.side-brand`, `.side-nav`, `.side-nav-item` (`.active`), `.side-nav-badge`, `.side-foot`, `.side-align`, `.side-status` (`.dot.resting/.dreaming/.ready`), `.side-dream-btn` |
| Page header | `.page-head`, `.page-eyebrow`, `.page-title`, `.page-sub`, `.page-actions` |
| Cards | `.card`, `.card-head`, `.card-title`, `.card-hint`, `.summary-card` (`.hero`), `.summary-value`, `.summary-trend`, `.summary-sub` |
| Rings | `.scorering`, `.ring-track`, `.ring-arc.efficiency/.effectiveness/.alignment`, `.ring-chip`, `.contribs`, `.contrib-bar` |
| Alignment | `.align-bar`, `.align-human`, `.align-agent`, `.align-mid`, `.align-band`, `.align-sides`, `.align-side`, `.align-mood`, `.align-question`, `.friction-chip`, `.friction-type` |
| Findings / actions | `.finding`, `.finding-kicker`, `.finding-body`, `.finding-evidence`, `.finding-benefits`, `.finding-action`, `.category-chip` (`.agentsmd/.contextdoc/.prompthabit/.skill`), `.finding-controls` |
| Cycle wizard | `.cycle-progress`, `.cycle-bar`, `.cycle-stages`, `.cycle-stage` (`.done/.active/.pending`), `.step-rail`, `.step-rail-item` (`.accepted/.snoozed/.queued/.active`), `.review-panel`, `.review-controls` |
| Action queue | `.action-queue`, `.queue-item` (`.accepted/.queued/.snoozed`), `.queue-tally`, `.queue-apply` |
| History | `.trend-chart`, `.trend-line`, `.trend-dot`, `.history-row` (`.selected`), `.history-row-rail`, `.compare-strip`, `.compare-row`, `.compare-delta` |
| Settings | `.settings-status`, `.status-chip` (`.on`), `.settings-group`, `.settings-row` (hairline divider), `.connector-row` (`.soon`) |
| Atoms | `.pill` (`.neutral/.good/.warn/.danger/.accent`), `.spark`, `.spark-line` (`.good/.warn/.accent`), `.seg`, `.toggle`, `.btn` (`.default/.ghost/.accent/.danger`), `.field` |

---

## 3. Type Additions (`shared/types.ts`) — additive + optional

Existing interfaces untouched. Append:

```ts
export type AlignmentBand = "collaborating" | "friction" | "fighting";

export type ActionCategory =
  | "agentsmd"      // "AGENTS.md update"  (Vela target: claude-md)
  | "contextdoc"    // "Context doc"       (context-doc)
  | "prompthabit"   // "Prompt habit"      (prompt-habit)
  | "skill";        // "Skill / routing"   (agent-skill)

export type ActionState = "open" | "accepted" | "snoozed" | "queued";

export type FrictionType =
  | "config-conflict"
  | "missing-skill"
  | "wrong-domain"
  | "unclear-prompt";

export interface FrictionPoint {
  type: FrictionType;
  example: string;       // one-line, drawn from a finding's evidence
  findingId: string;     // links 1:1 to the Finding it explains
}

export interface AlignmentSide {
  mood: string;          // human: deep-focus|scattered|exploratory|frustrated
                         // agent: confident|uncertain|confused|overloaded
  question: string;      // the implicit question held all day
  signals: string[];     // evidence chips
}

export interface AlignmentDetail {
  score: number;         // 0..100; mirrors the `alignment` ring score
  band: AlignmentBand;
  human: AlignmentSide;
  agent: AlignmentSide;
  friction: FrictionPoint[];
}

export interface ActionQueueEntry {
  findingId: string;
  category: ActionCategory;
  action: string;        // the recommended step (finding.action)
  project: string;
  state: ActionState;    // accepted | queued | snoozed
}

// DreamReport gains ONE optional field; everything else unchanged.
export interface DreamReport {
  // …all existing fields stay exactly as-is…
  alignment?: AlignmentDetail;       // optional; UI derives a fallback if absent
}

// Optional per-finding hint (UI also derives these when absent):
export interface Finding {
  // …existing fields…
  category?: ActionCategory;
  frictionType?: FrictionType;
}
```

**Derivation fallbacks (so the UI works with old reports).**
- `band(score)`: ≥80→collaborating, 45–79→friction, <45→fighting.
- `humanSide`/`agentSide` when `report.alignment` absent: derive scores as `alignmentScore + clamp(delta,…)` split, mood/question from a small static map keyed by band.
- `categorize(finding)`: keyword map on `finding.action`/`improvement` — "AGENTS.md"→agentsmd, "doc/canonical"→contextdoc, "before/first prompt/snapshot"→prompthabit, "skill/Codex/route"→skill.
- `frictionType(finding)`: only for `type==="mistake"|"risk"`; map from action category (config→config-conflict, skill→missing-skill/wrong-domain, prompthabit→unclear-prompt).

### Mock additions (`mock.ts`) — keep `makeReport`/`seedReports` signatures

Add to each report (additive) so the new UI has data, without touching existing keys:

```ts
// Inside makeReport(timestamp, seed), after findings/experiments:
const alignScore = rings.find((r) => r.key === "alignment")!.score;
const alignment: AlignmentDetail = {
  score: alignScore,
  band: alignScore >= 80 ? "collaborating" : alignScore >= 45 ? "friction" : "fighting",
  human: {
    mood: pick(["deep-focus", "exploratory", "scattered"], seed),
    question: "How do I cut re-asks without losing review quality?",
    signals: ["rephrased ask 4×", "2 context switches", "3 rejections"],
  },
  agent: {
    mood: pick(["uncertain", "confident", "overloaded"], seed),
    question: "What does this user mean by \"done\"?",
    signals: ["hedged 3×", "1 contradiction", "2 tool retries"],
  },
  friction: [
    { type: "unclear-prompt", example: "Re-asked to run tests 4× in agent-fleet", findingId: "f_reask_mistake" },
    { type: "config-conflict", example: "waker has no AGENTS.md to orient the agent", findingId: "f_noagents_risk" },
  ],
};
// return { ...report, alignment };
```

Keep the 4 existing findings (`f_verify_win`, `f_reask_mistake`, `f_dup_opportunity`, `f_noagents_risk`) and 3 experiments (`x_medium_ui`, `x_codex_refactor`, `x_plan_mode`) verbatim. Optionally stamp `category`/`frictionType` on findings; otherwise the UI derives them.

---

## 4. Per-Page Implementation Plan

All pages: `<PageHeader>` at top, then a scrollable card grid capped at `--content-max`, `--gutter` insets. Exactly one hero metric (`SummaryCard size="hero"`) per page (Settings excepted). Findings are **priority-sorted** (risk/mistake high → opportunity → win, then confidence) wherever listed.

### 4.1 App shell + nav (`App.tsx`)
- Layout: `.app.shell` → `<Sidebar>` + `.workspace` (`<PageHeader>` + `.scroll`).
- `<Sidebar>`: `BrandMark` + harness/privacy line, `<NavItem>` ×5 (Dashboard/Cycle/Improvements/History/Settings), foot = persistent **Alignment** number + band label + phase status dot + full-width "Dream now" `Button variant="accent"`. Cycle gets `badge={unreviewedCount}` from `state.hasUnreviewed`.
- Remove the animated `workspace-identity` glyph and the old serif `sidebar-score` panel.
- `setTab` drives `active`; `selectedId` (via `selectSession()` or tray `onSelectReport`) pivots all pages. < 920px → icon rail.

### 4.2 Dashboard (`Today.tsx`) — living summary, compact
Hero metric: **Alignment (0–100)** + band.
- Hero strip: 3 `SummaryCard` — `[Alignment hero]` · `[Human ↔ Agent via AlignmentBar: You 88 · Agent 79 · 2 friction]` · `[Open actions N → Review in Cycle]`.
- Rings row: three `RingChip` (efficiency/effectiveness/alignment) + `report.digest` sentence (`--t-body`).
- Vitals: `MetricCell` ×6 in one wrapping responsive row (no drilldown duplicate).
- Top findings: top **2** `FindingCard compact` ("What to act on") + "See all in Cycle →".
- Friction snapshot: 2–3 `FrictionChip`; each → its finding.
- **Remove**: `live-summary-grid`, explainer trio, timeline mini-bars, "Recent dreams" rail (→ History), the full "All findings" dump. Project filter removed here (lives in Improvements).

### 4.3 Cycle (`Cycle.tsx`) — wizard → action queue
Hero metric: **Alignment for this cycle** (with human/agent split).
- **Mode A — dreaming** (`phase==="dreaming"`): one `CycleProgress` card (linear bar + `DREAM_STAGES` list + `state.stage`). The only live animation. No StarField, no 214px ring, no explainer/log/queue trio.
- **Mode B — ready** (report + `hasUnreviewed`):
  - Alignment summary card: `SummaryCard hero` (alignment) + `AlignmentSides` (human/agent) + `FrictionChip` count.
  - Review wizard: `<StepRail>` (vertical, one entry per finding, priority-sorted, last = "Action queue (n)") + `.review-panel` showing **one** `FindingCard` (full) with `CategoryChip` and controls `[Prev] [Snooze] [Queue] [Accept ▸]`. Accept advances to next pending finding.
  - Action queue (rail's last entry): list of `ActionQueueItem` grouped by category with `[Apply]/[Undo]`, a `.queue-tally` (n accepted · n queued · n snoozed), and a single **"Apply n accepted → Improvements"** button → calls `actions.markReviewed()`, clears badge, routes accepted-testable items to Lab as `proposed` experiments. This is the explicit "what happens next."
- Action/decision state is local (a `Map<findingId, ActionState>`), lifted to the page so Dashboard "Open actions" and the Cycle badge stay in sync. No contract change.

### 4.4 Improvements (`Lab.tsx`) — measured changes & evidence
Hero metric: **Re-ask rate** (headline experiment metric) + delta, with a small `TrendChart` over recent cycles.
- Signal row: 4 `MetricCell` the experiments move (reask, tokens_per_change, tool_success, cache) via a `byKey(metrics)` map (no hardcoded lookups).
- **Running** (`status==="running"`): cards with progress (`experiment.progress`/`progressLabel`) + `[Conclude early]`/`[Pause]` — **never** a dead enable toggle.
- **Proposed** (`status==="proposed"`, incl. items routed from Cycle): cards with `[Start measuring ▸]`.
- **Concluded** (`status==="concluded"`): `verdict` with semantic color + one-line reflection.
- Project filter = `Segmented` in the page header; cascades to signal row + experiment list. Confidence meters driven by data, not magic numbers; "Show all (n)" instead of `.slice(0,4)`.

### 4.5 History (`History.tsx`) — compare cycles over time
Hero metric: **Alignment trend** (the `TrendChart` line itself).
- Hero: wide `TrendChart` (alignment line + efficiency/effectiveness faded) with a `Segmented` series picker; dots colored by band; click a point → `onSelect(id)`.
- `CompareStrip`: selected vs previous (alignment/efficiency/re-ask/findings Δ, colored by good/bad); `previous===null` → "First cycle — no comparison yet."
- Cycle list: `HistoryRow` ×N, newest first; click → `onSelect(id)` pivots all pages; selected row gets `.selected` + violet rail.
- Memoize the "strongest ring" sort; ring labels from `ring.label` (no hardcoded "Eff").

### 4.6 Settings (`Settings.tsx`) — control center, grouped + scannable
No hero metric. A status strip + grouped `SettingsGroup` cards (two columns ≥1040px, one below), hairline dividers, no cards-in-cards.
- Status strip: `StatusChip` ×4 (Claude Code connected · Local-only · Nightly 03:00 · Launch at login).
- Groups: **Schedule** (`Segmented` Nightly/Manual, time shown only if nightly, notifications `Toggle` + `[Send test]` with debounced inline ✓ that resets timer on re-click) · **Privacy** (`Segmented` Local/Cloud + depth `Segmented` Light/Standard/Deep) · **Connectors** (data-driven `CONNECTORS = [{id,label,hint,available}]` → `.connector-row`; unavailable render as disabled "soon", not hidden) · **Appearance** (reduce motion, launch at login `Toggle`s) · **Data & reset** (reveal data; reset onboarding; reset-all with inline two-step confirm; quit — danger group last, `--negative` text on buttons only).

---

## 5. Animation Rules

Animation **only** explains state, progress, or change. Everything decorative is deleted.

**Allowed**
1. **Dream progress** — `CycleProgress` bar fills with `state.progress`; stage label cross-fades 150ms on change. The `phase` status dot pulses (1.6s opacity) **only** while `phase==="dreaming"` — the single looping animation, and it carries meaning.
2. **Ring draw-on** — arcs animate 0→score once on report load (`stroke-dashoffset`, `--dur-3` ease-out), then static.
3. **Count-up** — hero metric + deltas via `useCountUp` (≤`--dur-4`) on report change; tabular nums.
4. **Sparkline / trend reveal** — one-shot left-to-right path draw (~`--dur-3`) on first paint; static after.
5. **Selection / accept feedback** — `--dur-1` hover fill, selected rail, accept check.
6. **Wizard step / queue insert** — `--dur-2` opacity+small-translate when switching findings or inserting a queue row; tally counts up.

**Banned (delete on sight)** — StarField, twinkles, constellation paths, all `identity-*` and `.workspace-identity` motion, every `::before` gradient sweep, all `0 0 Npx` glows / `drop-shadow` halos, idle `trend-bars`/`friction-path`/`signal-sweep`/`health-ring` loops, the breathing background gradient. Nothing animates on idle.

**Reduced motion** — `usePrefersReducedMotion()` / `config.reduceMotion` / `.reduce-motion`: all of the above snap to final state — rings/charts render drawn, `useCountUp` jumps to target, no slides, dot stops pulsing. Information and layout are identical; only motion is removed.

---

### Constraints honored
Data contract preserved (rings `efficiency`/`effectiveness`/`alignment`; metric keys `tokens_per_change`/`cost`/`reask`/`cache`/`tool_success`/`sessions`; `Finding`/`Experiment`/`DreamReport` read by main as-is; `window.hd` + `useHarnessDreams`; `makeReport`/`seedReports` kept). All new types/fields additive + optional with derivation fallbacks. No yellow/brown/amber; teal/blue/violet + rose-negative only. System sans only, serif removed. Flat cards + hairlines + one whisper shadow, responsive `clamp()` gutters, no cards-in-cards, one hero metric per page, consistent sidebar + page-header. Mock keeps real repo names: agent-fleet, harness-dreams, zod-to-sql, waker.

Relevant files: `apps/desktop/src/ui/styles.css` (tokens + decoration removal), `apps/desktop/src/ui/components.tsx` (new components), `apps/desktop/src/shared/types.ts` (additive types), `apps/desktop/src/shared/mock.ts` (additive mock fields), and the five pages `App.tsx` / `Today.tsx` / `Cycle.tsx` / `Lab.tsx` / `History.tsx` / `Settings.tsx`.
