# Recommendations and Insights Engine

A Health-style recommendation is not generic advice. It is a traceable explanation connected to the user's data.

## Insight pattern

```text
Observe → Compare → Explain → Recommend → Deep-link
```

Example:

```text
Observe: Your average focus time this week is 42 min/day.
Compare: This is 18% higher than your 4-week baseline.
Explain: The increase comes mostly from three longer morning sessions.
Recommend: Keep the morning block; schedule one for tomorrow.
Deep-link: Open Focus detail page.
```

## Data model

```ts
export interface Insight {
  id: string;
  metricIds: string[];
  type: 'trend' | 'anomaly' | 'milestone' | 'consistency' | 'recommendation';
  severity: 'positive' | 'neutral' | 'warning';
  title: string;
  explanation: string;
  recommendation?: string;
  comparison: {
    currentWindow: DateRange;
    baselineWindow?: DateRange;
    delta?: number;
    deltaPercent?: number;
  };
  confidence: 'low' | 'medium' | 'high';
  sourceSampleCount: number;
  deepLink: string;
  createdAt: string;
}
```

## Recommendation types

### Trend insight

Use when a metric has changed meaningfully over a reliable baseline.

- up/down/flat;
- magnitude;
- baseline window;
- source count;
- confidence.

### Consistency insight

Use for routines:

- fewer missed days;
- lower variance;
- stable bedtime/wake time;
- consistent study sessions;
- regular workouts.

### Anomaly insight

Use carefully. Avoid medical or alarming wording unless clinically validated.

Good wording:

> Your resting heart rate entries are higher than your recent baseline.

Avoid:

> You may have a heart condition.

### Goal recommendation

Use when goal setting can improve motivation:

- raise goal after repeated completion;
- lower goal after repeated misses;
- suggest recovery day after high load;
- suggest small next step after inactivity.

## Confidence rules

A recommendation should be suppressed or labeled low confidence when:

- source sample count is low;
- baseline window is too short;
- import source changed;
- data has gaps;
- metric units are inconsistent;
- user recently edited goals.

## Desktop UI for insights

Insight cards should include:

- title;
- metric icon or custom symbol;
- one-sentence explanation;
- time window;
- confidence/source chip;
- primary action;
- dismiss/snooze control.

Desktop detail view can include:

- chart with highlighted current and baseline windows;
- source sample table;
- “why am I seeing this?” explanation;
- recommendation history;
- user feedback: helpful/not helpful.

## Privacy behavior

Recommendations can feel intrusive. Required controls:

- opt out of recommendation categories;
- clear history;
- local-only mode;
- explain source data;
- never upload insight text to an AI service without explicit consent;
- avoid diagnosis and high-stakes claims.

## Rule-first, AI-second

Start with deterministic rules. Use LLMs only for summarization or optional coaching copy after:

1. the rule has already decided an insight exists;
2. source data is minimized;
3. the user consents to external processing;
4. output is reviewed for medical/financial/legal safety if relevant.
