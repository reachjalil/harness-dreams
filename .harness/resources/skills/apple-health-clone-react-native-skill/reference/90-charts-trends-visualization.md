# 90 — Charts, Trends, and Visualization

Apple Health-style charts are simple, contextual, and time-range driven.

## Chart types

| Chart | Use for |
| --- | --- |
| Bar chart | steps, calories, minutes, hydration, frequency |
| Line chart | heart rate, weight, resting metrics, sleep duration trend |
| Range chart | min/max heart rate, sleep stages, blood pressure |
| Calendar heatmap | adherence, streaks, logging consistency |
| Ring history row | goal completion by day |
| Sparkline | small trend card |

## Recommended libraries

### Victory Native XL

Use for common charts:

- line charts.
- bar charts.
- chart press state.
- axes.
- date windows.
- trend cards.

### React Native Skia

Use for custom visuals:

- rings.
- custom range bands.
- density heatmaps.
- animated gradient fills.
- chart overlays.

### Reanimated

Use for:

- scrubbing.
- animated value labels.
- chart card expansion.
- ring progress interpolation.

## Time ranges

Use consistent ranges:

- Day.
- Week.
- Month.
- Six months.
- Year.
- All.

Each detail page should remember its last selected range.

## Trend card anatomy

```text
Metric label
Direction + short statement
Mini chart
Current window value
Baseline value
Delta
Deep link
```

Example:

```text
Steps are up
You averaged 6,400 steps/day this week, 12% above your 4-week average.
```

## Avoid misleading charts

- Do not truncate axes in ways that exaggerate small changes.
- Do not compare periods with low sample counts without saying confidence is low.
- Do not use red for every decrease; lower may be positive for some metrics.
- Do not hide units.
- Do not animate charts so much that data becomes secondary.

## Chart data pipeline

```text
Raw samples
  ↓
aggregate by day/hour/week
  ↓
fill missing buckets explicitly
  ↓
annotate with source/confidence
  ↓
render chart + summary copy
```

## Empty states

Good empty state:

```text
No sleep data yet
Connect Apple Health or log your sleep manually to see trends here.
```

Bad empty state:

```text
No data
```

## Accessibility

Every chart needs:

- text summary.
- accessibility label.
- data table fallback if possible.
- enough contrast.
- no color-only encoding.
- reduced motion behavior.
