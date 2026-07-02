import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import {
  Card,
  CategoryRow,
  MetricTile,
  MiniBars,
  Screen,
  SectionHeader,
  SegmentedControl,
} from "../components/HealthUI";
import { trendLabel } from "../domain/harnessHealth";
import type {
  HarnessHealthModel,
  HealthCategory,
  HarnessProfile,
  Metric,
} from "../domain/types";
import { colors, radius, spacing } from "../theme/tokens";

type MetricRange = "D" | "W" | "M" | "6M" | "Y";
type SourceFilter = "all" | "codex" | "claude";

const RANGE_OPTIONS: Array<{
  key: MetricRange;
  label: string;
  accessibilityLabel: string;
}> = [
  { key: "D", label: "D", accessibilityLabel: "Day" },
  { key: "W", label: "W", accessibilityLabel: "Week" },
  { key: "M", label: "M", accessibilityLabel: "Month" },
  { key: "6M", label: "6M", accessibilityLabel: "Six months" },
  { key: "Y", label: "Y", accessibilityLabel: "Year" },
];
const SOURCE_OPTIONS: Array<{ key: SourceFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "codex", label: "Codex" },
  { key: "claude", label: "Claude" },
];

export function BrowseScreen({
  model,
  loading,
  onOpenMetric,
  onRefresh,
}: {
  model: HarnessHealthModel;
  loading: boolean;
  onOpenMetric(key: string): void;
  onRefresh(): void;
}) {
  const [query, setQuery] = useState("");
  const filteredMetrics = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return model.metrics;
    return model.metrics.filter((metric) =>
      `${metric.label} ${metric.key}`.toLowerCase().includes(normalized)
    );
  }, [model.metrics, query]);
  const primaryCategories = model.categories.slice(0, 3);
  const moreCategories = model.categories.slice(3);

  return (
    <Screen refreshing={loading} onRefresh={onRefresh}>
      <View style={styles.header}>
        <Text style={styles.largeTitle}>Browse</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          Explore harness health metrics by category, source, and trend.
        </Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search metrics, categories, sources"
        placeholderTextColor={colors.tertiary}
        style={styles.search}
        accessibilityLabel="Search harness health metrics and categories"
      />

      <CategorySection
        title="Today"
        categories={primaryCategories}
        metrics={model.metrics}
        onOpenMetric={onOpenMetric}
      />

      <CategorySection
        title="More Harness Data"
        categories={moreCategories}
        metrics={model.metrics}
        onOpenMetric={onOpenMetric}
      />

      <SectionHeader
        title="All Metrics"
        subtitle="Favorites, supporting metrics, habits, and generated facts."
      />
      <View style={styles.wrapGrid}>
        {filteredMetrics.map((metric) => (
          <MetricTile
            key={metric.key}
            metric={metric}
            onPress={() => onOpenMetric(metric.key)}
          />
        ))}
      </View>
    </Screen>
  );
}

export function MetricDetailScreen({
  metricKey,
  model,
  onOpenMetric,
}: {
  metricKey: string;
  model: HarnessHealthModel;
  onOpenMetric(key: string): void;
}) {
  const [range, setRange] = useState<MetricRange>("W");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const metric = model.metrics.find((item) => item.key === metricKey) ?? null;

  if (!metric) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text style={styles.largeTitle}>Metric unavailable</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            This metric is not available in the current Harness Health model.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <MetricDetail
        model={model}
        metric={metric}
        range={range}
        sourceFilter={sourceFilter}
        onRangeChange={setRange}
        onSourceChange={setSourceFilter}
        onSelectMetric={onOpenMetric}
      />
    </Screen>
  );
}

function CategorySection({
  title,
  categories,
  metrics,
  onOpenMetric,
}: {
  title: string;
  categories: HealthCategory[];
  metrics: Metric[];
  onOpenMetric(key: string): void;
}) {
  if (categories.length === 0) return null;
  return (
    <>
      <SectionHeader title={title} />
      <Card style={styles.categoryGroup}>
        {categories.map((category, index) => (
          <View
            key={category.id}
            style={index > 0 ? styles.categoryDivider : null}
          >
            <CategoryRow
              category={category}
              grouped
              onPress={() => {
                const firstMetric = category.metricKeys.find((key) =>
                  metrics.some((metric) => metric.key === key)
                );
                if (firstMetric) onOpenMetric(firstMetric);
              }}
            />
          </View>
        ))}
      </Card>
    </>
  );
}

function MetricDetail({
  model,
  metric,
  range,
  sourceFilter,
  onRangeChange,
  onSourceChange,
  onSelectMetric,
}: {
  model: HarnessHealthModel;
  metric: Metric;
  range: MetricRange;
  sourceFilter: SourceFilter;
  onRangeChange(range: MetricRange): void;
  onSourceChange(filter: SourceFilter): void;
  onSelectMetric(key: string): void;
}) {
  const relatedCategory = model.categories.find((category) =>
    category.metricKeys.includes(metric.key)
  );
  const relatedMetrics = model.metrics
    .filter(
      (item) =>
        item.key !== metric.key &&
        (relatedCategory?.metricKeys.includes(item.key) ||
          item.key.split(".")[0] === metric.key.split(".")[0])
    )
    .slice(0, 4);
  const samples = buildSamples(metric, range, sourceFilter);
  const sampleValues =
    samples.length > 0 ? samples.map((sample) => sample.value) : emptySamples();
  const hasSampleActivity = samples.some((sample) => sample.value > 0);
  const explanation = metricExplanation(metric, model.activeHarness);

  return (
    <>
      <Card style={styles.detailHero}>
        <View style={styles.detailTop}>
          <View style={styles.flexOne}>
            <Text style={styles.detailLabel}>{metric.label}</Text>
            <View style={styles.metricValueLine}>
              <Text
                style={styles.metricHero}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {metric.value}
              </Text>
              <Text style={styles.metricUnit}>{metricUnit(metric)}</Text>
            </View>
            <Text
              style={[
                styles.metricDelta,
                metric.good ? null : styles.metricDeltaWarn,
              ]}
            >
              {trendLabel(metric)} over selected range
            </Text>
          </View>
          <View style={styles.statusPuck}>
            <Text style={styles.statusValue}>{metric.good ? "OK" : "!"}</Text>
            <Text style={styles.statusLabel}>
              {metric.good ? "Stable" : "Watch"}
            </Text>
          </View>
        </View>

        <SegmentedRange value={range} onChange={onRangeChange} />
        <SourceChips value={sourceFilter} onChange={onSourceChange} />

        <View style={styles.chartBlock}>
          <MiniBars
            values={sampleValues}
            color={
              hasSampleActivity
                ? metric.good
                  ? metricAccent(metric)
                  : colors.orange
                : colors.separatorStrong
            }
          />
        </View>
      </Card>

      <SectionHeader title="Highlights" />
      <Card style={styles.infoCard}>
        <DetailRow
          label="Recent change"
          value={trendLabel(metric)}
          tone={metric.good ? "good" : "warn"}
        />
        <DetailRow label="Why it matters" value={explanation} tone="neutral" />
      </Card>

      <SectionHeader title="Data Sources" />
      <Card style={styles.infoCard}>
        <DetailRow
          label={model.activeHarness.label}
          value={metricProvenance(metric)}
          tone="neutral"
        />
        <DetailRow
          label="Retention"
          value="Derived metric and source pointer only; raw transcript text stays local unless enabled."
          tone="neutral"
        />
      </Card>

      <SectionHeader title="Samples" />
      <Card style={styles.sampleCard}>
        {samples.length > 0 ? (
          samples.slice(-5).map((sample, index) => (
            <View
              key={sample.label}
              style={[
                styles.sampleRow,
                index > 0 ? styles.sampleDivider : null,
              ]}
            >
              <Text style={styles.sampleLabel}>{sample.label}</Text>
              <Text style={styles.sampleValue}>{sample.display}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptySampleState}>
            <Text style={styles.sampleLabel}>No samples yet</Text>
            <Text style={styles.emptySampleText}>
              This metric needs real timestamped telemetry before a trend is
              shown.
            </Text>
          </View>
        )}
      </Card>

      {relatedMetrics.length > 0 ? (
        <>
          <SectionHeader title="Related" />
          <View style={styles.wrapGrid}>
            {relatedMetrics.map((item) => (
              <MetricTile
                key={item.key}
                metric={item}
                onPress={() => onSelectMetric(item.key)}
              />
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}

function SegmentedRange({
  value,
  onChange,
}: {
  value: MetricRange;
  onChange(range: MetricRange): void;
}) {
  return (
    <SegmentedControl
      accessibilityLabel="Metric range"
      options={RANGE_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}

function SourceChips({
  value,
  onChange,
}: {
  value: SourceFilter;
  onChange(filter: SourceFilter): void;
}) {
  return (
    <SegmentedControl
      accessibilityLabel="Metric source"
      options={SOURCE_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}

function DetailRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "neutral";
}) {
  const dotColor =
    tone === "good"
      ? colors.green
      : tone === "warn"
        ? colors.orange
        : colors.blue;
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailDot, { backgroundColor: dotColor }]} />
      <View style={styles.flexOne}>
        <Text style={styles.detailRowLabel}>{label}</Text>
        <Text style={styles.detailRowValue}>{value}</Text>
      </View>
    </View>
  );
}

function buildSamples(
  metric: Metric,
  range: MetricRange,
  sourceFilter: SourceFilter
): Array<{ label: string; value: number; display: string }> {
  if (sourceFilter !== "all" || !metric.samples?.length) {
    return [];
  }

  return metric.samples.slice(-7).map((sample, index) => {
    const value = Math.max(0, Math.round(sample.value));
    return {
      label: sampleLabel(range, index),
      value,
      display: sample.display ?? displaySample(metric, value),
    };
  });
}

function emptySamples(): number[] {
  return [0, 0, 0, 0, 0, 0, 0];
}

function sampleLabel(range: MetricRange, index: number): string {
  if (range === "D") return `${index + 8}:00`;
  if (range === "W")
    return (
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index] ?? `${index + 1}`
    );
  if (range === "M") return `Week ${index + 1}`;
  if (range === "6M")
    return (
      ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"][index] ?? `${index + 1}`
    );
  return `Q${Math.min(index + 1, 4)}`;
}

function displaySample(metric: Metric, value: number): string {
  if (metric.key.includes("token")) {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1000) return `${Math.round(value / 1000)}K`;
    return `${Math.round(value)}`;
  }
  if (
    metric.key.includes("error") ||
    metric.key.includes("success") ||
    metric.key.includes("cache") ||
    metric.unit === "%"
  ) {
    return `${Math.max(0, Math.round(value))}%`;
  }
  if (metric.key.includes("time")) return `${Math.max(0, Math.round(value))}m`;
  if (metric.key.includes("mix"))
    return `${Math.min(95, value)}/${Math.max(5, 100 - value)}`;
  return value.toString();
}

function metricAccent(metric: Metric): string {
  if (metric.key.includes("redundancy")) return colors.ringEfficiency;
  if (metric.key.includes("token")) return colors.ringEfficiency;
  if (metric.key.includes("tool")) return colors.ringEffectiveness;
  if (metric.key.includes("effectiveness")) return colors.ringAlignment;
  if (metric.key.includes("time")) return colors.blue;
  if (metric.key.includes("mix")) return colors.violet;
  return colors.accent;
}

function metricUnit(metric: Metric): string {
  if (metric.key.includes("redundancy")) return "signals";
  if (metric.key.includes("token")) return "tokens";
  if (metric.key.includes("error")) return "errors";
  if (metric.key.includes("time")) return "active";
  if (metric.key.includes("mix")) return "split";
  if (metric.key.includes("effectiveness")) return "score";
  return "";
}

function metricExplanation(metric: Metric, harness: HarnessProfile): string {
  if (metric.key.includes("redundancy")) {
    return `${harness.label} redundancy tracks corrections, retries, failed tools, and repeated-work signals that make harness sessions less efficient.`;
  }
  if (metric.key.includes("token")) {
    return `${harness.label} token pressure shows how much context and output the harness needed to finish work.`;
  }
  if (metric.key.includes("tool")) {
    return "Tool use and failures show whether the harness is spending effort on useful execution or retries.";
  }
  if (metric.key.includes("error")) {
    return "Lower error rate usually means fewer failed tool calls, permission loops, and repeated corrections.";
  }
  if (metric.key.includes("effectiveness")) {
    return "Effectiveness combines useful completion, verification quality, and correction pressure.";
  }
  if (metric.key.includes("time")) {
    return "Time spent helps separate productive agent time from long-running or stalled sessions.";
  }
  if (metric.key.includes("mix")) {
    return "Harness mix compares Codex and Claude usage so you can tune routing over time.";
  }
  return "This metric helps explain current harness health and related habits.";
}

function metricProvenance(metric: Metric): string {
  if (metric.provenance) return metric.provenance;

  if (metric.key.includes("token")) {
    return "Derived from normalized model-call token totals and cache counters.";
  }
  if (metric.key.includes("tool")) {
    return "Derived from normalized tool-call and tool-result events.";
  }
  if (metric.key.includes("error")) {
    return "Derived from failed tool results, retries, and correction proxies.";
  }
  if (metric.key.includes("redundancy")) {
    return "Derived from corrections, failed tools, retry pressure, and repeated-work signals.";
  }
  if (metric.key.includes("effectiveness")) {
    return "Derived from ring score, verification signals, and accepted review findings.";
  }
  if (metric.key.includes("time")) {
    return "Estimated from active session windows and event spacing.";
  }
  if (metric.key.includes("mix")) {
    return "Derived from Codex and Claude source attribution.";
  }
  return "Derived from sanitized local Harness Health telemetry.";
}

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  header: {
    gap: 3,
    paddingTop: spacing.xs,
  },
  largeTitle: {
    color: colors.label,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  subtitle: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  search: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.label,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  wrapGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  categoryGroup: {
    gap: 0,
    overflow: "hidden",
    padding: 0,
  },
  categoryDivider: {
    borderTopColor: colors.separator,
    borderTopWidth: 1,
  },
  detailHero: {
    backgroundColor: colors.card,
    gap: spacing.md,
  },
  detailTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  detailLabel: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metricValueLine: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: spacing.xs,
  },
  metricHero: {
    color: colors.label,
    fontSize: 42,
    fontWeight: "700",
    lineHeight: 48,
  },
  metricUnit: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: "600",
  },
  metricDelta: {
    color: colors.green,
    fontSize: 14,
    fontWeight: "700",
  },
  metricDeltaWarn: {
    color: colors.orange,
  },
  statusPuck: {
    alignItems: "center",
    backgroundColor: colors.elevated,
    borderColor: colors.separator,
    borderRadius: 36,
    borderWidth: 1,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  statusValue: {
    color: colors.label,
    fontSize: 19,
    fontWeight: "700",
  },
  statusLabel: {
    color: colors.tertiary,
    fontSize: 10,
    fontWeight: "700",
  },
  chartBlock: {
    height: 76,
    justifyContent: "flex-end",
  },
  infoCard: {
    gap: 0,
    paddingVertical: spacing.xs,
  },
  detailRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 72,
    paddingVertical: spacing.sm,
  },
  detailDot: {
    borderRadius: 5,
    height: 34,
    width: 10,
  },
  detailRowLabel: {
    color: colors.label,
    fontSize: 15,
    fontWeight: "700",
  },
  detailRowValue: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  sampleCard: {
    gap: 0,
    paddingVertical: spacing.xs,
  },
  emptySampleState: {
    gap: 3,
    minHeight: 70,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  emptySampleText: {
    color: colors.tertiary,
    fontSize: 13,
    lineHeight: 18,
  },
  sampleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
  },
  sampleDivider: {
    borderTopColor: colors.separator,
    borderTopWidth: 1,
  },
  sampleLabel: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: "600",
  },
  sampleValue: {
    color: colors.label,
    fontSize: 16,
    fontWeight: "700",
  },
});
