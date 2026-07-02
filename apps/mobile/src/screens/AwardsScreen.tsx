import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";
import {
  Card,
  ProgressBar,
  Screen,
  SectionHeader,
} from "../components/HealthUI";
import type { HarnessHealthModel, HealthAward } from "../domain/types";
import { colors, radius, spacing } from "../theme/tokens";

type AwardFilter = "all" | "earned" | "progress";

export function AwardsScreen({
  model,
  loading,
  onRefresh,
}: {
  model: HarnessHealthModel;
  loading: boolean;
  onRefresh(): void;
}) {
  const [filter, setFilter] = useState<AwardFilter>("all");
  const earned = model.awards.filter((award) => award.earned).length;
  const progress = model.awards.length === 0 ? 0 : earned / model.awards.length;
  const featuredAward =
    model.awards.find((award) => award.earned) ??
    model.awards
      .slice()
      .sort((first, second) => second.progress - first.progress)[0] ??
    null;
  const filteredAwards = useMemo(() => {
    if (filter === "earned") {
      return model.awards.filter((award) => award.earned);
    }
    if (filter === "progress") {
      return model.awards.filter((award) => !award.earned);
    }
    return model.awards;
  }, [filter, model.awards]);

  return (
    <Screen refreshing={loading} onRefresh={onRefresh}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Awards</Text>
        <Text style={styles.largeTitle}>Badge Gallery</Text>
      </View>

      <BadgeShowcase
        award={featuredAward}
        earned={earned}
        progress={progress}
        total={model.awards.length}
      />

      <AwardFilterControl value={filter} onChange={setFilter} />

      <SectionHeader
        title={filter === "progress" ? "In Progress" : "Awards"}
        subtitle="Replayable badges generated from verified Harness Health signals."
      />
      <View style={styles.wrapGrid}>
        {filteredAwards.length > 0 ? (
          filteredAwards.map((award) => (
            <BadgeTile key={award.id} award={award} />
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No badges in this view</Text>
            <Text style={styles.body}>
              Earned badges and in-progress challenges appear after the Mac
              publishes verified Harness Health telemetry.
            </Text>
          </Card>
        )}
      </View>

      <SectionHeader
        title="Challenges"
        subtitle="Behavior loops that turn recommendations into practice."
      />
      <Card>
        {model.experiments.length === 0 ? (
          <Text style={styles.body}>
            Run a Health Review to generate adaptive habit challenges.
          </Text>
        ) : (
          model.experiments.map((experiment) => (
            <View key={experiment.id} style={styles.challengeRow}>
              <View style={styles.flexOne}>
                <Text style={styles.challengeTitle}>{experiment.title}</Text>
                <Text style={styles.body}>
                  {experiment.progressLabel ?? experiment.metric}
                </Text>
              </View>
              <Text style={styles.challengeStatus}>{experiment.status}</Text>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

function BadgeShowcase({
  award,
  earned,
  progress,
  total,
}: {
  award: HealthAward | null;
  earned: number;
  progress: number;
  total: number;
}) {
  return (
    <Card style={styles.heroCard}>
      <View style={styles.heroTop}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>Collection</Text>
          <Text style={styles.heroTitle}>
            {earned} of {total} badges
          </Text>
          <Text style={styles.body}>
            Achievements stay local and are replayed from deterministic health
            signals.
          </Text>
        </View>
        <BadgeMedallion
          accent={award?.accent ?? colors.yellow}
          earned={Boolean(award?.earned)}
          progress={award?.progress ?? progress}
          size={116}
        />
      </View>
      <ProgressBar value={progress} color={award?.accent ?? colors.yellow} />
      {award ? (
        <View style={styles.featuredFooter}>
          <Text style={styles.featuredTitle}>{award.title}</Text>
          <Text style={styles.featuredMeta}>
            {award.earned
              ? "Earned"
              : `${Math.round(award.progress * 100)}% complete`}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function AwardFilterControl({
  value,
  onChange,
}: {
  value: AwardFilter;
  onChange(filter: AwardFilter): void;
}) {
  const options: Array<{ key: AwardFilter; label: string }> = [
    { key: "all", label: "All" },
    { key: "earned", label: "Earned" },
    { key: "progress", label: "Progress" },
  ];
  return (
    <View style={styles.filterControl} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = value === option.key;
        return (
          <Pressable
            key={option.key}
            style={[
              styles.filterItem,
              selected ? styles.filterItemActive : null,
            ]}
            onPress={() => onChange(option.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text
              style={[
                styles.filterText,
                selected ? styles.filterTextActive : null,
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

function BadgeTile({ award }: { award: HealthAward }) {
  return (
    <Pressable
      style={styles.badgeTile}
      accessibilityRole="button"
      accessibilityLabel={`${award.title}, ${award.earned ? "earned" : `${Math.round(award.progress * 100)} percent complete`}. ${award.description}`}
    >
      <BadgeMedallion
        accent={award.accent}
        earned={award.earned}
        progress={award.progress}
        size={92}
      />
      <Text style={styles.badgeTitle}>{award.title}</Text>
      <Text style={styles.badgeDescription}>{award.description}</Text>
      <View style={styles.badgeProgressRow}>
        <Text style={styles.badgeProgressLabel}>
          {award.earned ? "Earned" : "Progress"}
        </Text>
        <Text style={styles.badgeProgressValue}>
          {award.earned ? "100%" : `${Math.round(award.progress * 100)}%`}
        </Text>
      </View>
      <ProgressBar value={award.progress} color={award.accent} />
    </Pressable>
  );
}

function BadgeMedallion({
  accent,
  earned,
  progress,
  size,
}: {
  accent: string;
  earned: boolean;
  progress: number;
  size: number;
}) {
  const center = size / 2;
  const radiusValue = size * 0.36;
  const innerRadius = size * 0.26;
  const clampedProgress = Math.max(0, Math.min(progress, 1));
  const circumference = 2 * Math.PI * radiusValue;
  const dashOffset = circumference * (1 - clampedProgress);
  const gradientId = `badgeGradient${Math.round(size)}${earned ? "Earned" : "Open"}`;
  const colorScheme = useColorScheme();
  const centerFill =
    colorScheme === "dark" ? (earned ? "#15181f" : "#202531") : "#ffffff";

  return (
    <View style={[styles.badgeMedallion, { height: size, width: size }]}>
      <Svg height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
            <Stop
              offset="0"
              stopColor="#ffffff"
              stopOpacity={earned ? 0.92 : 0.48}
            />
            <Stop
              offset="0.42"
              stopColor={accent}
              stopOpacity={earned ? 0.88 : 0.44}
            />
            <Stop
              offset="1"
              stopColor={accent}
              stopOpacity={earned ? 0.48 : 0.24}
            />
          </LinearGradient>
        </Defs>
        <Circle
          cx={center}
          cy={center}
          fill={`url(#${gradientId})`}
          opacity={earned ? 1 : 0.62}
          r={radiusValue}
        />
        <Circle
          cx={center}
          cy={center}
          fill="none"
          opacity={0.28}
          r={radiusValue + 7}
          stroke={accent}
          strokeWidth={4}
        />
        <Circle
          cx={center}
          cy={center}
          fill="none"
          r={radiusValue + 7}
          stroke={accent}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth={4}
          transform={`rotate(-90 ${center} ${center})`}
        />
        <Circle
          cx={center}
          cy={center}
          fill={centerFill}
          opacity={0.96}
          r={innerRadius}
        />
        <G transform={`translate(${center - 18} ${center - 18})`}>
          {earned ? (
            <Path
              d="M9 18.2 15.2 24.4 28 11.6"
              fill="none"
              stroke={accent}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={4}
            />
          ) : (
            <Path
              d="M18 7.5v21M7.5 18h21"
              fill="none"
              stroke={accent}
              strokeLinecap="round"
              strokeWidth={4}
            />
          )}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  header: {
    gap: 2,
    paddingTop: spacing.sm,
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
  heroCard: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
  },
  heroTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  heroCopy: {
    flex: 1,
    gap: 5,
  },
  heroEyebrow: {
    color: colors.yellow,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  heroTitle: {
    color: colors.label,
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 29,
  },
  body: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 21,
  },
  featuredFooter: {
    alignItems: "center",
    borderTopColor: colors.separator,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
  },
  featuredTitle: {
    color: colors.label,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  featuredMeta: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  filterControl: {
    backgroundColor: colors.groupedBackground,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: 4,
    padding: 3,
  },
  filterItem: {
    alignItems: "center",
    borderRadius: radius.sm,
    flex: 1,
    justifyContent: "center",
    minHeight: 32,
  },
  filterItemActive: {
    backgroundColor: colors.card,
    shadowColor: colors.shadow,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  filterText: {
    color: colors.tertiary,
    fontSize: 13,
    fontWeight: "700",
  },
  filterTextActive: {
    color: colors.label,
  },
  wrapGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  emptyCard: {
    width: "100%",
  },
  emptyTitle: {
    color: colors.label,
    fontSize: 17,
    fontWeight: "700",
  },
  badgeTile: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: 232,
    padding: spacing.sm,
    shadowColor: colors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    width: "48%",
  },
  badgeMedallion: {
    alignItems: "center",
    alignSelf: "center",
    justifyContent: "center",
  },
  badgeTitle: {
    color: colors.label,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 19,
    textAlign: "center",
  },
  badgeDescription: {
    color: colors.secondary,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  badgeProgressRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  badgeProgressLabel: {
    color: colors.tertiary,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  badgeProgressValue: {
    color: colors.label,
    fontSize: 12,
    fontWeight: "700",
  },
  challengeRow: {
    alignItems: "center",
    borderTopColor: colors.separator,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 78,
    paddingTop: spacing.sm,
  },
  challengeTitle: {
    color: colors.label,
    fontSize: 16,
    fontWeight: "700",
  },
  challengeStatus: {
    color: colors.yellow,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
