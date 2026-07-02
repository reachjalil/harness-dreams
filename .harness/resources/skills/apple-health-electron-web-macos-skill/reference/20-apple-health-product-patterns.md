# Apple Health Product Patterns for Desktop/Web

Apple Health and Fitness patterns translate well to desktop because they are information-dense, progressive, and privacy-oriented. The desktop version should preserve the mental model while adapting navigation and layout.

## Core patterns to preserve

### 1. Summary as a personalized dashboard

A Health-style Summary is not a generic analytics landing page. It is a prioritized daily surface:

- pinned/favorite metrics;
- daily progress rings or goal cards;
- recent highlights;
- significant trends;
- recommendations or next actions;
- recently imported/synced data status.

Desktop adaptation:

```text
Sidebar                  Main Summary
----------------------   ------------------------------------
Summary                  Greeting / date / import status
Favorites                Rings + top daily goals
Browse                   Favorite metric cards
Awards                   Highlights and recommendations
Trends                   Trend panels
Imports                  Recent history / sync state
Settings                 Privacy / export / source controls
```

### 2. Browse/Library as source-of-truth navigation

Mobile Apple Health uses Browse to explore categories. Desktop should use a sidebar with sections:

- Activity
- Body Measurements
- Sleep
- Heart
- Mindfulness
- Nutrition
- Vitals
- Custom domains such as Learning, Focus, Reading, Recovery, Workouts, Tasks

The pattern generalizes: categories are collections of `MetricDefinition` objects.

### 3. Detail pages with progressive disclosure

A metric detail page should answer:

1. What is the current value?
2. How does it compare to the recent baseline?
3. Is there a notable trend?
4. What contributed to the change?
5. What can the user do next?
6. Where did the data come from?

Desktop layout:

```text
Toolbar: Metric name | range picker | source filter | export

Hero: value + comparison + sparkline
Cards: trend, recommendation, source quality
Chart: day/week/month/year range
Details: samples table, source breakdown, notes, import provenance
```

### 4. Activity rings as glanceable goal summaries

Use rings for a small number of high-value daily goals, not every metric.

Desktop ring rules:

- ring center text should be readable at larger desktop sizes;
- rings can live in cards, toolbar popovers, and menu bar windows;
- overflow should show achievement beyond 100% without breaking shape;
- each ring must have a text label, current value, goal, and unit;
- reduced motion should skip sweep animations.

### 5. Badges, awards, and streaks

Awards are motivational memory. The desktop version can show:

- daily completion awards;
- first-time milestones;
- personal bests;
- perfect weeks/months;
- custom challenges;
- event badges;
- streak recovery states.

Every badge must be rule-driven and replayable from history. Do not make badge status a manually edited boolean unless it is an override.

### 6. Trends and highlights

The strongest Health-style insights compare the current window to a baseline and explain direction:

```text
Your average reading time is up 18% over the last 4 weeks.
Your sleep midpoint is 42 minutes later than your 3-month baseline.
Your weekly focus sessions are more consistent than last month.
```

Good trend cards include:

- metric;
- direction;
- comparison window;
- confidence or data sufficiency;
- explanation;
- deep link to detail page;
- source/provenance.

## Patterns to change for desktop

### Replace mobile tab bar with sidebar

Use a persistent sidebar for top-level sections. Keep it collapsible for narrow windows and web layouts.

### Replace mobile sheets with popovers or panels

Desktop users expect popovers, menus, context menus, inspectors, and settings windows. Use modal dialogs sparingly.

### Add keyboard and menu access

Every core action should be available by keyboard and/or app menu:

- Import Data
- Export Data
- Refresh Sources
- Open Summary
- Search Metrics
- Toggle Sidebar
- Open Settings
- Show Awards

### Add file-based workflows

Desktop health/data apps often start with user-provided files. Make import a first-class feature:

- drag and drop file;
- File → Import;
- source preview;
- mapping/normalization;
- privacy notice;
- import job status;
- undo/delete imported source.

## Brand-safe Apple-like guidance

Do:

- use semantic colors and system fonts;
- use familiar macOS layout patterns;
- use rounded cards, subtle separators, clear hierarchy, and accessible labels;
- use your own icons and badge artwork;
- describe compatibility truthfully.

Do not:

- use Apple Health or Fitness icons as app icons;
- copy Apple award artwork;
- recreate Apple screens pixel-for-pixel;
- imply the app is Apple Health;
- call data “HealthKit” unless it actually came through HealthKit or user export.
