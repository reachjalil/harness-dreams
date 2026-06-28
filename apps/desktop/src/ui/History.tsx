import type { ReactElement } from "react";

import type { DreamReport } from "../shared/types";
import {
  AreaChart,
  CompareStrip,
  GroupedBars,
  HistoryRow,
  PageHeader,
  RingChip,
  Section,
  SummaryCard,
} from "./components";
import { Icon } from "./icons";

/** Mean of a report's ring scores — the comparable health point per Sleep Cycle. */
function composite(report: DreamReport): number {
  const sum = report.rings.reduce((acc, ring) => acc + ring.score, 0);
  return Math.round(sum / Math.max(1, report.rings.length));
}

function ringScore(report: DreamReport, key: string): number {
  return report.rings.find((r) => r.key === key)?.score ?? 0;
}

function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export default function History({
  reports,
  selectedId,
  onSelect,
}: {
  reports: DreamReport[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}): ReactElement {
  // Reports arrive newest-first; charts read oldest → newest, left to right.
  const timeline = [...reports].reverse();
  const recent = timeline.slice(-8);
  const latest = reports[0] ?? null;
  const previous = reports[1] ?? null;
  const selectedIndex = recent.findIndex((r) => r.id === selectedId);

  const latestAlignment = latest ? ringScore(latest, "alignment") : 0;
  const alignmentDelta =
    latest && previous
      ? latestAlignment - ringScore(previous, "alignment")
      : null;

  const latestScore = latest ? composite(latest) : 0;
  const scoreDelta =
    latest && previous ? latestScore - composite(previous) : null;

  const scoreSeries = recent.map((r) => composite(r));
  const trendLabels = recent.map((r) => shortDate(r.timestamp));
  const barGroups = [
    {
      id: "Efficiency",
      tone: "efficiency",
      values: recent.map((r) => ringScore(r, "efficiency")),
    },
    {
      id: "Effectiveness",
      tone: "effectiveness",
      values: recent.map((r) => ringScore(r, "effectiveness")),
    },
  ];

  const tone = (delta: number | null): "positive" | "negative" | "neutral" =>
    delta == null || delta === 0
      ? "neutral"
      : delta > 0
        ? "positive"
        : "negative";

  // Direction icon for a delta — clarifies the trend alongside its sign.
  const deltaIcon = (delta: number | null): ReactElement => (
    <Icon
      name={delta == null || delta === 0 ? "flat" : delta > 0 ? "up" : "down"}
      size={14}
    />
  );

  return (
    <>
      <PageHeader
        eyebrow="History"
        title="Compare Sleep Cycles over time"
        subtitle="Each Sleep Cycle becomes a comparable health point — see whether your changes are compounding."
      />

      {reports.length === 0 ? (
        <p className="empty">
          No Sleep Cycles yet. Run a dream to start your history.
        </p>
      ) : (
        <div className="history">
          <div className="grid grid-3">
            <SummaryCard
              size="hero"
              eyebrow="Latest alignment"
              value={latestAlignment}
              trend={
                alignmentDelta == null
                  ? undefined
                  : { delta: alignmentDelta, tone: tone(alignmentDelta) }
              }
              sublabel={
                alignmentDelta == null
                  ? "First Sleep Cycle on record"
                  : "vs. previous Sleep Cycle"
              }
            />
            <SummaryCard
              eyebrow="Dream score"
              value={latestScore}
              trend={
                scoreDelta == null
                  ? undefined
                  : { delta: scoreDelta, tone: tone(scoreDelta) }
              }
              sublabel="Mean of all rings"
            />
            <SummaryCard
              eyebrow="Sleep Cycles recorded"
              value={reports.length}
              sublabel={
                latest ? `Latest ${shortDate(latest.timestamp)}` : undefined
              }
            />
          </div>

          {/* Two columns: a wide trend on the left, the latest delta on the right. */}
          <div className="history-cols">
            <Section
              title="Trend"
              hint="Dream score across recent Sleep Cycles. Tap a point to open it."
            >
              <AreaChart
                values={scoreSeries}
                labels={trendLabels}
                tone="alignment"
                activeIndex={selectedIndex >= 0 ? selectedIndex : undefined}
                onPick={(i) => {
                  const picked = recent[i];
                  if (picked) onSelect(picked.id);
                }}
              />
              <div className="history-bars">
                <span className="dash-eyebrow">
                  Efficiency vs. effectiveness
                </span>
                <GroupedBars groups={barGroups} labels={trendLabels} />
              </div>
            </Section>

            {latest ? (
              <Section
                title="Latest vs. previous"
                hint="What moved since the Sleep Cycle before."
              >
                {alignmentDelta != null ? (
                  <div className="history-delta-legend">
                    <span className={`history-delta ${tone(alignmentDelta)}`}>
                      {deltaIcon(alignmentDelta)} Alignment{" "}
                      {alignmentDelta >= 0 ? "+" : ""}
                      {alignmentDelta}
                    </span>
                    {scoreDelta != null ? (
                      <span className={`history-delta ${tone(scoreDelta)}`}>
                        {deltaIcon(scoreDelta)} Score{" "}
                        {scoreDelta >= 0 ? "+" : ""}
                        {scoreDelta}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="history-ringchips">
                  {latest.rings.map((ring) => (
                    <RingChip key={ring.key} ring={ring} />
                  ))}
                </div>
                <CompareStrip current={latest} previous={previous} />
              </Section>
            ) : null}
          </div>

          <Section
            title="All Sleep Cycles"
            hint="Newest first. Select one to open its report across the app."
          >
            <div className="history-list">
              {reports.map((report, i) => {
                const prior = reports[i + 1] ?? null;
                const delta = prior
                  ? ringScore(report, "alignment") -
                    ringScore(prior, "alignment")
                  : null;
                return (
                  <HistoryRow
                    key={report.id}
                    report={report}
                    selected={report.id === selectedId}
                    delta={delta}
                    onSelect={onSelect}
                  />
                );
              })}
            </div>
          </Section>
        </div>
      )}
    </>
  );
}
