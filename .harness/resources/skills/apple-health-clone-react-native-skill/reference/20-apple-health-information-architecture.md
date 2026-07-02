# 20 — Apple Health Information Architecture

Apple Health and Fitness use a simple hierarchy:

```text
Summary
  ├─ Favorites / pinned metrics
  ├─ Highlights
  ├─ Trends
  ├─ Recommendations / education
  └─ Recent changes

Browse
  ├─ Activity
  ├─ Body measurements
  ├─ Cycle tracking
  ├─ Hearing
  ├─ Heart
  ├─ Medications
  ├─ Mental wellbeing
  ├─ Mobility
  ├─ Nutrition
  ├─ Respiratory
  ├─ Sleep
  ├─ Symptoms
  ├─ Vitals
  └─ Other categories

Metric Detail
  ├─ Current value
  ├─ Chart
  ├─ Time range controls
  ├─ Highlights/trends
  ├─ Data sources
  ├─ Related data
  └─ Education / about this metric
```

## Product pattern to copy conceptually

Not the pixels. Copy the hierarchy:

1. **Summary first** — users should understand today within five seconds.
2. **Favorites are user-controlled** — do not assume the same metrics matter to everyone.
3. **Highlights explain change** — don't show charts without interpretation.
4. **Trends compare time periods** — recent history vs longer baseline.
5. **Browse supports exploration** — category hierarchy for power users.
6. **Metric details reveal provenance** — sources, samples, and units matter.
7. **Education is contextual** — explain what a metric means near the data.

## Clone-friendly screen map

### Summary tab

Sections:

- Today header.
- Ring cluster or top goal card.
- Favorite metric cards.
- Highlights.
- Trends.
- Recommendations.
- Recent awards.
- Data source status.

### Browse tab

Sections:

- Search bar.
- Category list.
- Recently viewed metrics.
- Connected sources.
- App-specific custom domains.

### Sharing / Sources tab

If handling real health data, add a transparent area for:

- Connected devices and apps.
- Permission status by metric.
- Export/delete controls.
- Data provenance.

### Awards tab

Sections:

- Recent awards.
- In-progress challenges.
- Personal records.
- Streaks.
- Monthly challenges.
- Special events.

## Generalizing beyond fitness

Map rings and metrics to other use cases:

| Apple pattern | Generic primitive | Other use cases |
| --- | --- | --- |
| Move ring | Daily quantity goal | pages read, minutes focused, water consumed |
| Exercise ring | Intensity/time goal | deep work, practice time, active learning |
| Stand ring | Frequency goal | breaks taken, mindfulness sessions, posture checks |
| Awards | Achievement rules | streaks, milestones, perfect weeks |
| Trends | Baseline comparison | habit improvement, adherence, consistency |
| Highlights | Notable recent change | anomaly, improvement, drop-off, recovery |
| Browse | Metric taxonomy | categories by domain |

## Card hierarchy

A Health-style card usually has:

```text
Metric label
Primary value + unit
Tiny context label
Chart or visual cue
Time range / delta
Optional chevron for detail
```

Use restraint. The UI should feel calm and data-forward.
