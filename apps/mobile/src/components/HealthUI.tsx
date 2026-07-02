import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  type DimensionValue,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type {
  HealthAward,
  HealthCategory,
  HealthInsight,
  HealthTab,
  HarnessProfileKey,
  Metric,
  SourceStatus,
} from "../domain/types";
import { colors, radius, spacing } from "../theme/tokens";

export interface RecommendationSlide {
  id: string;
  title: string;
  body: string;
  evidence: string;
  accent: string;
  actionLabel: string;
}

export function Screen({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.screen,
        {
          paddingBottom: insets.bottom + 112,
          paddingTop: insets.top + spacing.md,
        },
      ]}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const contentStyle = [styles.card, style];
  if (onPress) {
    return (
      <Pressable style={contentStyle} onPress={onPress}>
        {children}
      </Pressable>
    );
  }
  return <View style={contentStyle}>{children}</View>;
}

export function SectionHeader({
  action,
  onPress,
  subtitle,
  title,
}: {
  action?: string;
  onPress?: () => void;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.flexOne}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={onPress}>
          <Text style={styles.actionText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ProgressBar({
  color = colors.accent,
  value,
}: {
  color?: string;
  value: number;
}) {
  const width = `${Math.max(0, Math.min(1, value)) * 100}%` as DimensionValue;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { backgroundColor: color, width }]} />
    </View>
  );
}

export function MiniBars({
  color = colors.accent,
  values,
}: {
  color?: string;
  values: number[];
}) {
  const max = Math.max(1, ...values.map((value) => Math.abs(value)));
  const occurrences = new Map<number, number>();
  return (
    <View style={styles.miniBars}>
      {values.map((value) => {
        const occurrence = occurrences.get(value) ?? 0;
        occurrences.set(value, occurrence + 1);
        return (
          <View
            key={`${value}-${occurrence}`}
            style={[
              styles.miniBar,
              {
                backgroundColor: color,
                height: 10 + (Math.abs(value) / max) * 34,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export function Pill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "accent" | "good" | "neutral" | "warn";
}) {
  const color =
    tone === "good"
      ? colors.green
      : tone === "warn"
        ? colors.orange
        : colors.accent;
  return (
    <View style={[styles.pill, { borderColor: `${color}55` }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function ProfileAvatar({
  profile,
  selected = false,
  size = "md",
}: {
  profile: HarnessProfileKey;
  selected?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? 52 : size === "sm" ? 28 : 38;
  const initial = profile === "global" ? "H" : profile === "codex" ? "C" : "A";
  return (
    <View
      style={[
        styles.avatar,
        {
          borderColor: selected ? colors.accent : colors.separator,
          height: dim,
          width: dim,
        },
      ]}
    >
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  );
}

export function CategoryRow({
  category,
  grouped = false,
  onPress,
}: {
  category: HealthCategory;
  grouped?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={[styles.row, grouped ? styles.groupedRow : null]}
      onPress={onPress}
    >
      <View style={[styles.rowDot, { backgroundColor: category.accent }]} />
      <View style={styles.flexOne}>
        <Text style={styles.rowTitle}>{category.title}</Text>
        <Text style={styles.rowSubtitle}>{category.subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function MetricTile({
  metric,
  onPress,
}: {
  metric: Metric;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.metricTile} onPress={onPress}>
      <Text style={styles.metricLabel}>{metric.label}</Text>
      <Text style={styles.metricValue}>{metric.value}</Text>
      <Text style={styles.rowSubtitle}>{metric.good ? "Stable" : "Watch"}</Text>
    </Pressable>
  );
}

export function InsightCard({
  insight,
  onPrimaryAction,
}: {
  insight: HealthInsight | RecommendationSlide;
  onPrimaryAction?: () => void;
}) {
  const accent = "accent" in insight ? insight.accent : colors.accent;
  return (
    <Card>
      <View style={styles.insightTop}>
        <View style={[styles.rowDot, { backgroundColor: accent }]} />
        <Text style={styles.rowTitle}>{insight.title}</Text>
      </View>
      <Text style={styles.rowSubtitle}>
        {"body" in insight ? insight.body : ""}
      </Text>
      {"evidence" in insight ? (
        <Text style={styles.evidence}>{insight.evidence}</Text>
      ) : null}
      {onPrimaryAction ? (
        <Pressable style={styles.primaryButton} onPress={onPrimaryAction}>
          <Text style={styles.primaryButtonText}>
            {"actionLabel" in insight ? insight.actionLabel : "Review"}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

export function AwardCard({ award }: { award: HealthAward }) {
  return (
    <Card style={styles.awardCard}>
      <Text style={[styles.awardMedal, { color: award.accent }]}>●</Text>
      <Text style={styles.rowTitle}>{award.title}</Text>
      <Text style={styles.rowSubtitle}>{award.description}</Text>
      <ProgressBar color={award.accent} value={award.progress} />
    </Card>
  );
}

export function SourceRow({ source }: { source: SourceStatus }) {
  return (
    <View style={styles.row}>
      <View style={styles.flexOne}>
        <Text style={styles.rowTitle}>{source.title}</Text>
        <Text style={styles.rowSubtitle}>{source.detail}</Text>
      </View>
      <Pill label={source.status} />
    </View>
  );
}

export function SegmentedControl<T extends string>({
  onChange,
  options,
  style,
  value,
}: {
  accessibilityLabel?: string;
  onChange(value: T): void;
  options: Array<{ key: T; label: string }>;
  style?: StyleProp<ViewStyle>;
  value: T;
}) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            style={[styles.segment, selected ? styles.segmentSelected : null]}
            onPress={() => onChange(option.key)}
          >
            <Text
              style={[
                styles.segmentText,
                selected ? styles.segmentTextSelected : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RoundIconButton({
  accessibilityLabel,
  children,
  onPress,
}: {
  accessibilityLabel?: string;
  children: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      style={styles.roundButton}
      onPress={onPress}
    >
      <Text style={styles.roundButtonText}>{children}</Text>
    </Pressable>
  );
}

export function RecommendationSlider<T extends RecommendationSlide>({
  onAction,
  recommendations,
}: {
  onAction(recommendation: T): void;
  recommendations: T[];
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.sliderTrack}>
        {recommendations.map((recommendation) => (
          <View key={recommendation.id} style={styles.recommendationCard}>
            <Text style={styles.rowTitle}>{recommendation.title}</Text>
            <Text style={styles.rowSubtitle}>{recommendation.body}</Text>
            <Pressable
              style={[
                styles.primaryButton,
                { backgroundColor: recommendation.accent },
              ]}
              onPress={() => onAction(recommendation)}
            >
              <Text style={styles.primaryButtonText}>
                {recommendation.actionLabel}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function HealthBottomSheet({
  children,
  onClose,
  open,
}: {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
}) {
  return (
    <Modal
      animationType="slide"
      transparent
      visible={open}
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>{children}</View>
    </Modal>
  );
}

export function HealthTabBar({
  active,
  bottomInset = 0,
  onChange,
}: {
  active: HealthTab;
  bottomInset?: number;
  onChange(tab: HealthTab): void;
}) {
  const tabs: Array<{ key: HealthTab; label: string }> = [
    { key: "summary", label: "Summary" },
    { key: "browse", label: "Browse" },
    { key: "awards", label: "Awards" },
    { key: "sources", label: "Sources" },
  ];
  return (
    <View style={[styles.tabBar, { paddingBottom: bottomInset + spacing.xs }]}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onChange(tab.key)}
          >
            <Text
              style={[styles.tabText, selected ? styles.tabTextActive : null]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  actionText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.elevated,
    borderRadius: radius.pill,
    borderWidth: 2,
    justifyContent: "center",
  },
  avatarText: {
    color: colors.label,
    fontWeight: "800",
  },
  awardCard: {
    flexBasis: "48%",
  },
  awardMedal: {
    fontSize: 26,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  chevron: {
    color: colors.tertiary,
    fontSize: 28,
  },
  evidence: {
    color: colors.tertiary,
    fontSize: 12,
  },
  flexOne: {
    flex: 1,
  },
  groupedRow: {
    paddingHorizontal: 0,
  },
  insightTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  metricLabel: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: "700",
  },
  metricTile: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: "48%",
    gap: spacing.xs,
    minHeight: 108,
    padding: spacing.md,
  },
  metricValue: {
    color: colors.label,
    fontSize: 24,
    fontWeight: "800",
  },
  miniBar: {
    borderRadius: radius.pill,
    width: 8,
  },
  miniBars: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 5,
    minHeight: 48,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  primaryButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryButtonText: {
    color: colors.onAccent,
    fontSize: 13,
    fontWeight: "800",
  },
  progressFill: {
    borderRadius: radius.pill,
    height: "100%",
  },
  progressTrack: {
    backgroundColor: colors.progressTrack,
    borderRadius: radius.pill,
    height: 8,
    overflow: "hidden",
  },
  recommendationCard: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
    width: 260,
  },
  roundButton: {
    alignItems: "center",
    backgroundColor: colors.elevated,
    borderColor: colors.separator,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  roundButtonText: {
    color: colors.label,
    fontWeight: "800",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowDot: {
    borderRadius: radius.pill,
    height: 12,
    width: 12,
  },
  rowSubtitle: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  rowTitle: {
    color: colors.label,
    fontSize: 15,
    fontWeight: "800",
  },
  scroll: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sectionHeader: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
  },
  sectionSubtitle: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    color: colors.label,
    fontSize: 20,
    fontWeight: "800",
  },
  segment: {
    alignItems: "center",
    borderRadius: radius.pill,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  segmentSelected: {
    backgroundColor: colors.card,
  },
  segmentText: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: "700",
  },
  segmentTextSelected: {
    color: colors.label,
  },
  segmented: {
    backgroundColor: colors.groupedBackground,
    borderRadius: radius.pill,
    flexDirection: "row",
    padding: 3,
  },
  screen: {
    gap: 12,
    padding: spacing.md,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    bottom: 0,
    gap: spacing.md,
    left: 0,
    padding: spacing.lg,
    position: "absolute",
    right: 0,
  },
  sheetBackdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.28)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  sliderTrack: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  tabBar: {
    backgroundColor: colors.card,
    borderTopColor: colors.separator,
    borderTopWidth: 1,
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  tabItem: {
    alignItems: "center",
    flex: 1,
    paddingVertical: spacing.sm,
  },
  tabText: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "700",
  },
  tabTextActive: {
    color: colors.accent,
  },
});
