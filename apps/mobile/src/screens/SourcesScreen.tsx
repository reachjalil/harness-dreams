import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Card,
  MiniBars,
  Pill,
  ProfileAvatar,
  ProgressBar,
  Screen,
  SectionHeader,
  SourceRow,
} from "../components/HealthUI";
import type {
  HarnessHealthModel,
  HarnessProfile,
  Metric,
} from "../domain/types";
import { PairingControls } from "./PairingScreen";
import { colors, radius, spacing } from "../theme/tokens";

export function SourcesScreen({
  model,
  paired,
  loading,
  devAutoPairEnabled,
  devAutoPairing,
  connectionStatus,
  lastSyncedAt,
  syncError,
  onPairUrl,
  onRefresh,
  onUnpair,
}: {
  model: HarnessHealthModel;
  paired: boolean;
  loading: boolean;
  devAutoPairEnabled: boolean;
  devAutoPairing: boolean;
  connectionStatus: string;
  lastSyncedAt: string;
  syncError: string;
  onPairUrl(input: string): Promise<boolean>;
  onRefresh(): void;
  onUnpair(): void;
}) {
  const metricByKey = new Map(
    model.metrics.map((metric) => [metric.key, metric])
  );
  const tokenMetric = metricByKey.get("tokens.total");
  const toolMetric = metricByKey.get("tools.calls");
  const errorMetric = metricByKey.get("tools.error_rate");
  const timeMetric = metricByKey.get("time.spent");
  const turns = model.report.window?.turnsInWindow ?? 0;
  const toolCalls = Number(toolMetric?.value.replace(/[^0-9]/gu, "")) || 0;
  const eventCount = turns + toolCalls;
  const freshness = lastSyncedAt || "Waiting";
  const sourcedMetricCount = model.metrics.filter(
    (metric) =>
      !metric.preview &&
      ((metric.sourceCount ?? 0) > 0 || Boolean(metric.samples?.length))
  ).length;
  const coverage =
    model.metrics.length > 0 ? sourcedMetricCount / model.metrics.length : 0;
  const coverageBars = [
    model.report.sessions,
    model.projects.length,
    turns,
    toolCalls,
    model.score,
  ];

  return (
    <Screen refreshing={loading} onRefresh={onRefresh}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Sources</Text>
        <Text style={styles.largeTitle}>Data Sources</Text>
        <Text style={styles.headerSubtitle}>
          Review which harnesses power each metric, how fresh the local data is,
          and what stays private on this device.
        </Text>
      </View>

      <SectionHeader
        title="Coverage"
        subtitle="A local view of transcript events, tool activity, and profile scope."
      />
      <Card style={styles.coverageCard}>
        <View style={styles.coverageTop}>
          <View style={styles.flexOne}>
            <Text style={styles.statusLabel}>Harness data</Text>
            <Text style={styles.statusValue}>
              {Math.round(coverage * 100)}%
            </Text>
            <Text style={styles.body}>
              {lastSyncedAt
                ? `Fresh as of ${lastSyncedAt}.`
                : paired
                  ? "Waiting for the next desktop snapshot."
                  : "Waiting for this iPhone to receive a Mac source."}
            </Text>
          </View>
          <Pill
            label={devAutoPairing ? "Pairing" : paired ? "Private" : "Waiting"}
            tone={paired ? "good" : "neutral"}
          />
        </View>
        <ProgressBar value={coverage} color={colors.accent} />
        <MiniBars values={coverageBars} color={colors.accent} />
        <View style={styles.statGrid}>
          <SourceStat label="Events" value={compactNumber(eventCount)} />
          <SourceStat label="Sessions" value={`${model.report.sessions}`} />
          <SourceStat label="Projects" value={`${model.report.projects}`} />
          <SourceStat label="Freshness" value={freshness} />
        </View>
      </Card>

      <SectionHeader
        title="Harness Profiles"
        subtitle="Profiles work like people in Health: choose all harnesses or inspect one source."
      />
      <Card>
        {model.harnessProfiles.map((profile, index) => (
          <HarnessProfileRow
            key={profile.key}
            profile={profile}
            first={index === 0}
          />
        ))}
      </Card>

      <SectionHeader
        title="Metric Provenance"
        subtitle="The most important cards point back to deterministic local signals."
      />
      <Card>
        <MetricSourceRow
          color={colors.ringEfficiency}
          first
          metric={tokenMetric}
          source="Codex and Claude transcript usage"
          title="Token Use"
        />
        <MetricSourceRow
          color={colors.ringEffectiveness}
          metric={toolMetric}
          source="Tool calls, MCP calls, and results"
          title="Tool Use"
        />
        <MetricSourceRow
          color={colors.red}
          metric={errorMetric}
          source="Failed tools, retries, and correction signals"
          title="Error Rate"
        />
        <MetricSourceRow
          color={colors.blue}
          metric={timeMetric}
          source="Session windows and active review time"
          title="Time Spent"
        />
      </Card>

      <SectionHeader
        title="Private Sync"
        subtitle="Pairing only moves minimized snapshots and decisions; raw transcript text stays local unless explicitly enabled."
      />
      <Card style={styles.statusCard}>
        <View style={styles.rowBetween}>
          <View style={styles.flexOne}>
            <Text style={styles.statusLabel}>Sync route</Text>
            <Text style={styles.statusValueSmall}>
              {devAutoPairing ? "Auto pairing" : connectionStatus}
            </Text>
          </View>
          <Pressable style={styles.smallButton} onPress={onRefresh}>
            <Text style={styles.smallButtonText}>
              {loading ? "Updating" : "Update"}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.body}>
          {devAutoPairing
            ? "Finding the local Mac dev pairing endpoint on 127.0.0.1:39391."
            : lastSyncedAt
              ? `Last refreshed ${lastSyncedAt}`
              : paired
                ? "Waiting for a fresh report snapshot."
                : "Pair this iPhone to the Mac source for live desktop snapshots."}
        </Text>
        {devAutoPairEnabled ? (
          <Text style={styles.devNote}>
            Dev auto-pair is enabled for simulator builds.
          </Text>
        ) : null}
        {syncError ? <Text style={styles.error}>{syncError}</Text> : null}
      </Card>

      {!paired ? (
        <>
          <SectionHeader title="Add This iPhone" />
          <PairingControls
            loading={loading}
            syncError={syncError}
            onPairUrl={onPairUrl}
          />
        </>
      ) : null}

      <SectionHeader title="Connected Services" />
      <Card>
        {model.sources.map((source) => (
          <SourceRow key={source.id} source={source} />
        ))}
      </Card>

      <View style={styles.buttonRow}>
        {paired ? (
          <Pressable style={styles.dangerButton} onPress={onUnpair}>
            <Text style={styles.dangerButtonText}>Remove pairing</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

function compactNumber(value: number): string {
  if (value >= 1000) return `${Math.round(value / 100) / 10}K`;
  return `${Math.round(value)}`;
}

function SourceStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.sourceStat}>
      <Text style={styles.sourceStatValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.sourceStatLabel}>{label}</Text>
    </View>
  );
}

function HarnessProfileRow({
  first = false,
  profile,
}: {
  first?: boolean;
  profile: HarnessProfile;
}) {
  return (
    <View style={[styles.profileRow, first ? styles.firstGroupedRow : null]}>
      <ProfileAvatar profile={profile.key} size="md" />
      <View style={styles.flexOne}>
        <Text style={styles.contractLabel}>{profile.label}</Text>
        <Text style={styles.body} numberOfLines={1}>
          {profile.detail}
        </Text>
      </View>
      <Pill
        label={profile.status}
        tone={profile.key === "global" ? "accent" : "neutral"}
      />
    </View>
  );
}

function MetricSourceRow({
  color,
  first = false,
  metric,
  source,
  title,
}: {
  color: string;
  first?: boolean;
  metric?: Metric;
  source: string;
  title: string;
}) {
  return (
    <View
      style={[styles.metricSourceRow, first ? styles.firstGroupedRow : null]}
    >
      <View style={[styles.metricDot, { backgroundColor: color }]} />
      <View style={styles.flexOne}>
        <Text style={styles.contractLabel}>{title}</Text>
        <Text style={styles.body} numberOfLines={2}>
          {source}
        </Text>
      </View>
      <View style={styles.metricValueBlock}>
        <Text style={styles.metricValue}>{metric?.value ?? "0"}</Text>
        <Text style={styles.metricDelta}>
          {metric ? (metric.good ? "Good" : "Watch") : "Preview"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 4,
    paddingTop: spacing.sm,
  },
  flexOne: {
    flex: 1,
  },
  eyebrow: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  largeTitle: {
    color: colors.label,
    fontSize: 28,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  coverageCard: {
    gap: spacing.sm,
  },
  coverageTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  statusCard: {
    backgroundColor: colors.elevated,
    borderColor: colors.separator,
  },
  statusLabel: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statusValue: {
    color: colors.label,
    fontSize: 26,
    fontWeight: "700",
  },
  statusValueSmall: {
    color: colors.label,
    fontSize: 21,
    fontWeight: "700",
  },
  body: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 21,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  sourceStat: {
    backgroundColor: colors.elevated,
    borderColor: colors.separator,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 64,
    padding: spacing.sm,
  },
  sourceStatValue: {
    color: colors.label,
    fontSize: 19,
    fontWeight: "700",
  },
  sourceStatLabel: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  error: {
    color: colors.red,
    fontSize: 13,
    lineHeight: 19,
  },
  devNote: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  profileRow: {
    alignItems: "center",
    borderTopColor: colors.separator,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 72,
    paddingTop: spacing.sm,
  },
  firstGroupedRow: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  metricSourceRow: {
    alignItems: "center",
    borderTopColor: colors.separator,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 4,
    minHeight: 76,
    paddingTop: spacing.sm,
  },
  metricDot: {
    borderRadius: 4,
    height: 34,
    marginRight: spacing.sm,
    width: 8,
  },
  contractLabel: {
    color: colors.label,
    fontSize: 15,
    fontWeight: "700",
  },
  metricValueBlock: {
    alignItems: "flex-end",
    minWidth: 72,
  },
  metricValue: {
    color: colors.label,
    fontSize: 18,
    fontWeight: "700",
  },
  metricDelta: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  smallButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderRadius: radius.sm,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  smallButtonText: {
    color: colors.label,
    fontSize: 13,
    fontWeight: "700",
  },
  buttonRow: {
    gap: spacing.sm,
  },
  dangerButton: {
    alignItems: "center",
    borderColor: colors.redMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
  },
  dangerButtonText: {
    color: colors.red,
    fontWeight: "700",
  },
});
