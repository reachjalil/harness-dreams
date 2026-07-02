import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  AwardCard,
  Card,
  CategoryRow,
  HealthBottomSheet,
  InsightCard,
  MiniBars,
  ProfileAvatar,
  RecommendationSlider,
  RoundIconButton,
  Screen,
  SectionHeader,
  SegmentedControl,
  type RecommendationSlide,
} from "../components/HealthUI";
import { CheckmarkIcon, ChevronDownIcon } from "../components/SvgGlyphs";
import {
  formatReportTime,
  metricChartValues,
  metricHasActivity,
  projectSubtitle,
  trendLabel,
} from "../domain/harnessHealth";
import type {
  HarnessHealthModel,
  HarnessProfile,
  HarnessProfileKey,
  Metric,
  ProjectInsight,
  ReviewState,
  Ring,
} from "../domain/types";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import {
  colors,
  radius,
  ringColor,
  ringMutedColor,
  spacing,
} from "../theme/tokens";

type RingMode = "quality" | "usage";
type ExplainerKey =
  | "quality.overview"
  | "usage.overview"
  | "rework"
  | "effectiveness"
  | "alignment"
  | "evidence"
  | "tokens"
  | "perChange"
  | "cache"
  | "usageEvidence";

interface DataPointExplainer {
  key: ExplainerKey;
  title: string;
  eyebrow: string;
  value: string;
  unit: string;
  accent: string;
  body: string;
  calculation: string[];
  evidence: string;
  action: string;
}

interface ActionRecommendation extends RecommendationSlide {
  explainerKey: ExplainerKey;
}

const RING_MODE_OPTIONS: Array<{ key: RingMode; label: string }> = [
  { key: "quality", label: "Quality" },
  { key: "usage", label: "Usage" },
];

const EXPLAINER_KEYS: ExplainerKey[] = [
  "quality.overview",
  "usage.overview",
  "rework",
  "effectiveness",
  "alignment",
  "evidence",
  "tokens",
  "perChange",
  "cache",
  "usageEvidence",
];

function isExplainerKey(value: string): value is ExplainerKey {
  return EXPLAINER_KEYS.includes(value as ExplainerKey);
}

export function SummaryScreen({
  model,
  requestedExplainerKey,
  loading,
  onExplainerRequestHandled,
  onRefresh,
  onSelectHarness,
  onOpenMetric,
  onDecision,
}: {
  model: HarnessHealthModel;
  requestedExplainerKey?: string | null;
  loading: boolean;
  onExplainerRequestHandled?(): void;
  onRefresh(): void;
  onSelectHarness(profile: HarnessProfileKey): void;
  onOpenMetric(metricKey: string): void;
  onDecision(findingId: string, state: ReviewState): void;
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileMenuAnchor, setProfileMenuAnchor] =
    useState<ProfileMenuAnchor | null>(null);
  const [ringMode, setRingMode] = useState<RingMode>("quality");
  const [selectedExplainer, setSelectedExplainer] =
    useState<ExplainerKey | null>(null);
  const [displayedExplainerKey, setDisplayedExplainerKey] =
    useState<ExplainerKey | null>(null);
  const favoriteMetrics = model.metrics.slice(0, 6);
  const primaryMetrics = favoriteMetrics.slice(0, 4);
  const secondaryMetrics = favoriteMetrics.slice(4);
  const highlightInsights = model.insights
    .filter(
      (insight) => insight.type === "trend" || insight.type === "milestone"
    )
    .slice(0, 2);
  const recommendations = model.insights
    .filter(
      (insight) =>
        insight.type === "recommendation" || insight.type === "education"
    )
    .slice(0, 3);
  const previewAwards = model.awards.slice(0, 2);
  const sourcePreview = model.sources.slice(0, 2);
  const recommendedFinding = model.findings[0] ?? null;
  const nextAction =
    model.findings[0]?.action ??
    model.experiments[0]?.title ??
    "Review the latest Harness Health signal.";
  const summaryTrendValues =
    model.rings.length > 0
      ? model.rings.map((ring) => Math.max(0, ring.score))
      : [0, 0, 0];
  const explainerSheetOpen = selectedExplainer !== null;
  const displayedExplainer = displayedExplainerKey
    ? buildDataPointExplainer(displayedExplainerKey, model)
    : null;

  useEffect(() => {
    if (!requestedExplainerKey) return;
    if (isExplainerKey(requestedExplainerKey)) {
      setSelectedExplainer(requestedExplainerKey);
    }
    onExplainerRequestHandled?.();
  }, [onExplainerRequestHandled, requestedExplainerKey]);

  useEffect(() => {
    if (selectedExplainer) {
      setDisplayedExplainerKey(selectedExplainer);
    }
  }, [selectedExplainer]);

  return (
    <View style={styles.summaryRoot}>
      <Screen refreshing={loading} onRefresh={onRefresh}>
        <View style={styles.headerRow}>
          <View style={styles.flexOne}>
            <Text style={styles.largeTitle}>Summary</Text>
            <Text style={styles.topMeta}>
              Updated {formatReportTime(model.report.timestamp)}
            </Text>
          </View>
          <HeaderProfileSelector
            active={model.activeHarness}
            open={profileMenuOpen}
            onAnchorChange={setProfileMenuAnchor}
            onToggle={() => setProfileMenuOpen((value) => !value)}
          />
        </View>

        <InlineRingsSummary
          metrics={model.metrics}
          projects={model.projects}
          rings={model.rings}
          mode={ringMode}
          onModeChange={setRingMode}
          onOpenExplainer={setSelectedExplainer}
          score={model.score}
        />

        <HarnessCalendarSection
          model={model}
          onOpenExplainer={setSelectedExplainer}
        />

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Favorites</Text>
          <Text style={styles.editAction}>Edit</Text>
        </View>

        {primaryMetrics.map((metric) => (
          <FavoriteMetricCard
            key={metric.key}
            metric={metric}
            onPress={() => onOpenMetric(metric.key)}
          />
        ))}

        {secondaryMetrics.map((metric) => (
          <FavoriteMetricCard
            key={metric.key}
            metric={metric}
            onPress={() => onOpenMetric(metric.key)}
          />
        ))}

        <Card style={styles.nextCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.nextKicker}>Recommendation</Text>
            <Text style={styles.cardTime}>{model.report.rangeLabel}</Text>
          </View>
          <Text style={styles.nextAction}>{nextAction}</Text>
          <Text style={styles.meta}>
            {model.report.harness} source - {model.activeHarness.label} view
          </Text>
          {recommendedFinding ? (
            <Pressable
              style={styles.inlineButton}
              onPress={() => onDecision(recommendedFinding.id, "queued")}
              accessibilityRole="button"
            >
              <Text style={styles.inlineButtonText}>Queue Action</Text>
            </Pressable>
          ) : null}
        </Card>

        <SectionHeader title="Highlights" action="Show All" />
        <Card>
          <Text style={styles.digest}>{model.report.digest}</Text>
          <MiniBars values={summaryTrendValues} color={colors.accent} />
        </Card>
        {highlightInsights.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            onPrimaryAction={() => {
              const finding = model.findings.find(
                (item) => item.id === insight.id
              );
              if (finding) onDecision(finding.id, "queued");
            }}
          />
        ))}

        <SectionHeader title="Browse" action="See All" />
        {model.categories.slice(0, 3).map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            onPress={() => {
              const firstMetric = category.metricKeys.find((key) =>
                model.metrics.some((metric) => metric.key === key)
              );
              if (firstMetric) onOpenMetric(firstMetric);
            }}
          />
        ))}

        <SectionHeader title="For You" />
        {(recommendations.length > 0
          ? recommendations
          : model.insights.slice(0, 3)
        ).map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            onPrimaryAction={() => {
              const finding = model.findings.find(
                (item) => item.id === insight.id
              );
              if (finding) onDecision(finding.id, "queued");
            }}
          />
        ))}

        {previewAwards.length > 0 ? (
          <>
            <SectionHeader title="Awards" action="Show All" />
            <View style={styles.wrapGrid}>
              {previewAwards.map((award) => (
                <AwardCard key={award.id} award={award} />
              ))}
            </View>
          </>
        ) : null}

        <SectionHeader title="Healthy Habits" />
        <Card>
          {model.habits.slice(0, 3).map((habit) => (
            <View key={habit.id} style={styles.habitRow}>
              <View style={styles.flexOne}>
                <Text style={styles.habitTitle}>{habit.title}</Text>
                <Text style={styles.meta}>{habit.summary}</Text>
              </View>
              <Text style={styles.habitMetric}>{habit.improves}</Text>
            </View>
          ))}
        </Card>

        {model.projects.length > 0 ? (
          <>
            <SectionHeader title="Projects" />
            <Card>
              {model.projects.slice(0, 4).map((project) => (
                <View key={project.name} style={styles.projectRow}>
                  <View style={styles.flexOne}>
                    <Text style={styles.projectName}>{project.name}</Text>
                    <Text style={styles.meta}>
                      {project.sessions} sessions - {project.turns} turns -{" "}
                      {project.corrections} corrections
                    </Text>
                    <Text style={styles.meta}>{projectSubtitle(project)}</Text>
                  </View>
                  <Text style={styles.projectScore}>{project.alignment}</Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <SectionHeader title="Sources" action="Manage" />
        <Card>
          {sourcePreview.map((source) => (
            <View key={source.id} style={styles.sourcePreviewRow}>
              <View style={styles.flexOne}>
                <Text style={styles.habitTitle}>{source.title}</Text>
                <Text style={styles.meta}>{source.detail}</Text>
              </View>
              <Text style={styles.sourceStatus}>{source.status}</Text>
            </View>
          ))}
        </Card>
      </Screen>
      {profileMenuOpen ? (
        <Pressable
          style={styles.profileMenuScrim}
          onPress={() => setProfileMenuOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close profile menu overlay"
        />
      ) : null}
      {profileMenuAnchor ? (
        <ProfileMenuPopover
          anchor={profileMenuAnchor}
          open={profileMenuOpen}
          profiles={model.harnessProfiles}
          active={model.activeHarness}
          loading={loading}
          onRefresh={onRefresh}
          onSelect={(profile) => {
            onSelectHarness(profile);
            setProfileMenuOpen(false);
          }}
          onDismissed={() => setProfileMenuAnchor(null)}
        />
      ) : null}
      {displayedExplainer ? (
        <DataPointExplainerSheet
          explainer={displayedExplainer}
          open={explainerSheetOpen}
          onClose={() => {
            // Fires only once gorhom's own close animation has fully
            // finished (backdrop tap, pan-down-to-close, or a
            // `selectedExplainer` reset all funnel through here), so this
            // is the single place both pieces of state get cleared.
            setSelectedExplainer(null);
            setDisplayedExplainerKey(null);
          }}
          onRequestClose={() => setSelectedExplainer(null)}
        />
      ) : null}
    </View>
  );
}

interface ProfileMenuAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

function HeaderProfileSelector({
  active,
  open,
  onAnchorChange,
  onToggle,
}: {
  active: HarnessProfile;
  open: boolean;
  onAnchorChange(anchor: ProfileMenuAnchor): void;
  onToggle(): void;
}) {
  const buttonRef = useRef<View>(null);

  const measureAnchor = () => {
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      onAnchorChange({ x, y, width, height });
    });
  };

  return (
    <View style={styles.headerProfileWrap}>
      <Pressable
        ref={buttonRef}
        style={styles.headerProfileButton}
        onPress={() => {
          measureAnchor();
          onToggle();
        }}
        accessibilityRole="button"
        accessibilityLabel={`Harness profile, ${active.label}`}
        accessibilityState={{ expanded: open }}
      >
        <ProfileAvatar profile={active.key} selected size="lg" />
        <ChevronDownIcon expanded={open} size={16} />
      </Pressable>
    </View>
  );
}

function ProfileMenuPopover({
  anchor,
  open,
  profiles,
  active,
  loading,
  onRefresh,
  onSelect,
  onDismissed,
}: {
  anchor: ProfileMenuAnchor;
  open: boolean;
  profiles: HarnessProfile[];
  active: HarnessProfile;
  loading: boolean;
  onRefresh(): void;
  onSelect(profile: HarnessProfileKey): void;
  onDismissed(): void;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? 190 : 150,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) {
        onDismissed();
      }
    });
  }, [open, progress, onDismissed]);

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  return (
    <View
      style={[
        styles.profileMenuPopoverAnchor,
        {
          top: anchor.y + anchor.height + 8,
          right: Math.max(
            0,
            Dimensions.get("window").width - (anchor.x + anchor.width)
          ),
        },
      ]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          styles.profilePopover,
          {
            opacity: progress,
            transform: [{ scale }],
          },
        ]}
      >
        <Text style={styles.popoverTitle}>Harness Profile</Text>
        {profiles.map((profile) => {
          const selected = profile.key === active.key;
          return (
            <Pressable
              key={profile.key}
              style={styles.profileOption}
              onPress={() => onSelect(profile.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <ProfileAvatar
                profile={profile.key}
                selected={selected}
                size="sm"
              />
              <View style={styles.flexOne}>
                <Text
                  style={[
                    styles.optionLabel,
                    selected ? styles.optionLabelActive : null,
                  ]}
                >
                  {profile.label}
                </Text>
                <Text style={styles.optionMeta}>
                  {profile.detail} - {profile.status}
                </Text>
              </View>
              <View style={styles.optionState}>
                {selected ? <CheckmarkIcon /> : null}
              </View>
            </Pressable>
          );
        })}
        <Pressable
          style={styles.popoverRefresh}
          onPress={onRefresh}
          accessibilityRole="button"
        >
          <Text style={styles.popoverRefreshText}>
            {loading ? "Updating" : "Update Data"}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function InlineRingsSummary({
  metrics,
  projects,
  rings,
  mode,
  onModeChange,
  onOpenExplainer,
  score,
}: {
  metrics: HarnessHealthModel["metrics"];
  projects: ProjectInsight[];
  rings: Ring[];
  mode: RingMode;
  onModeChange(mode: RingMode): void;
  onOpenExplainer(key: ExplainerKey): void;
  score: number;
}) {
  const qualityRings = qualityRingSet(rings, projects, metrics);
  const usageRings = usageRingSet(metrics);
  const displayRings = mode === "quality" ? qualityRings : usageRings;
  const displayScore =
    mode === "quality" ? score : averageRingScore(usageRings);
  const tokenMetric = metricByKey(metrics, "tokens.total");
  const effectivenessRing = rings.find((ring) => ring.key === "effectiveness");
  const alignmentRing = rings.find((ring) => ring.key === "alignment");
  const redundancySignals = redundancySignalCount(projects, metrics);
  const perChangeMetric = metricByKey(metrics, "tokens.per_change");
  const cacheMetric = metricByKey(metrics, "cache.hit_ratio");
  const evidenceCount = metrics.reduce(
    (sum, metric) =>
      sum + (metric.sourceCount ?? 0) + (metric.samples?.length ?? 0),
    0
  );
  const usageEvidenceCount = [tokenMetric, perChangeMetric, cacheMetric].filter(
    (metric) =>
      metric &&
      ((metric.sourceCount ?? 0) > 0 || Boolean(metric.samples?.length))
  ).length;
  const cornerMetrics =
    mode === "quality"
      ? [
          {
            key: "rework" as const,
            label: "Rework",
            value: redundancySignals.toString(),
            meta: "signals",
            tone: redundancySignals > 0 ? colors.orange : colors.ringEfficiency,
          },
          {
            key: "effectiveness" as const,
            label: "Effectiveness",
            value: `${effectivenessRing?.score ?? 0}`,
            meta: "score",
            tone: colors.ringEffectiveness,
          },
          {
            key: "alignment" as const,
            label: "Alignment",
            value: `${alignmentRing?.score ?? 0}`,
            meta: "score",
            tone: colors.ringAlignment,
          },
          {
            key: "evidence" as const,
            label: "Evidence",
            value: evidenceCount.toString(),
            meta: "samples",
            tone: colors.accent,
          },
        ]
      : [
          {
            key: "tokens" as const,
            label: "Tokens",
            value: tokenMetric?.value ?? "0",
            meta: "today",
            tone: colors.ringEfficiency,
          },
          {
            key: "perChange" as const,
            label: "Per change",
            value: perChangeMetric?.value ?? "0",
            meta: "tokens",
            tone: colors.orange,
          },
          {
            key: "cache" as const,
            label: "Cache",
            value: cacheMetric?.value ?? "0%",
            meta: "hit ratio",
            tone: colors.ringAlignment,
          },
          {
            key: "usageEvidence" as const,
            label: "Evidence",
            value: usageEvidenceCount.toString(),
            meta: "sources",
            tone: colors.accent,
          },
        ];
  const recommendations = buildActionRecommendations({
    alignmentRing,
    cacheMetric,
    evidenceCount,
    mode,
    perChangeMetric,
    redundancySignals,
    tokenMetric,
    effectivenessRing,
  });

  return (
    <View style={styles.inlineRingSummary}>
      <View style={styles.ringControlRow}>
        <SegmentedControl
          accessibilityLabel="Ring mode"
          options={RING_MODE_OPTIONS}
          style={styles.flexOne}
          value={mode}
          onChange={onModeChange}
        />
        <RoundIconButton
          onPress={() =>
            onOpenExplainer(
              mode === "quality" ? "quality.overview" : "usage.overview"
            )
          }
          accessibilityLabel="Explain ring values"
        >
          ?
        </RoundIconButton>
      </View>

      <View style={styles.ringDashboard}>
        <RingCornerMetric
          metric={cornerMetrics[0]}
          onPress={() => onOpenExplainer(cornerMetrics[0].key)}
          position="topLeft"
        />
        <RingCornerMetric
          metric={cornerMetrics[1]}
          onPress={() => onOpenExplainer(cornerMetrics[1].key)}
          position="topRight"
        />
        <View style={styles.ringCenterStage}>
          <AnimatedRingStack rings={displayRings} score={displayScore} />
        </View>
        <RingCornerMetric
          metric={cornerMetrics[2]}
          onPress={() => onOpenExplainer(cornerMetrics[2].key)}
          position="bottomLeft"
        />
        <RingCornerMetric
          metric={cornerMetrics[3]}
          onPress={() => onOpenExplainer(cornerMetrics[3].key)}
          position="bottomRight"
        />
      </View>

      <RecommendationSlider
        recommendations={recommendations}
        onAction={(recommendation) =>
          onOpenExplainer(recommendation.explainerKey)
        }
      />
    </View>
  );
}

function RingCornerMetric({
  metric,
  onPress,
  position,
}: {
  metric: {
    key: ExplainerKey;
    label: string;
    value: string;
    meta: string;
    tone: string;
  };
  onPress(): void;
  position: "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
}) {
  const alignRight = position === "topRight" || position === "bottomRight";
  return (
    <Pressable
      style={[
        styles.ringCornerMetric,
        styles[`${position}Corner`],
        alignRight ? styles.ringCornerMetricRight : null,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Explain ${metric.label}`}
    >
      <View
        style={[
          styles.ringCornerLabelRow,
          alignRight ? styles.ringCornerLabelRowRight : null,
        ]}
      >
        <View
          style={[styles.ringCornerDot, { backgroundColor: metric.tone }]}
        />
        <Text style={styles.ringCornerLabel}>{metric.label}</Text>
      </View>
      <View
        style={[
          styles.ringCornerValueRow,
          alignRight ? styles.ringCornerValueRowRight : null,
        ]}
      >
        <Text
          style={styles.ringCornerValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {metric.value}
        </Text>
        <Text style={styles.ringCornerMeta}>{metric.meta}</Text>
      </View>
    </Pressable>
  );
}

function buildActionRecommendations({
  alignmentRing,
  cacheMetric,
  evidenceCount,
  effectivenessRing,
  mode,
  perChangeMetric,
  redundancySignals,
  tokenMetric,
}: {
  alignmentRing: Ring | undefined;
  cacheMetric: Metric | undefined;
  evidenceCount: number;
  effectivenessRing: Ring | undefined;
  mode: RingMode;
  perChangeMetric: Metric | undefined;
  redundancySignals: number;
  tokenMetric: Metric | undefined;
}): ActionRecommendation[] {
  if (mode === "usage") {
    return [
      {
        id: "usage-token-telemetry",
        title: hasMetricEvidence(tokenMetric)
          ? "Review token volume before the next long run"
          : "Connect token telemetry first",
        body: hasMetricEvidence(tokenMetric)
          ? "Token use is available, so use it to decide when prompts or context should be narrowed."
          : "The usage ring will stay empty until canonical model-call token rows arrive from the Mac source.",
        evidence: `Token Use: ${tokenMetric?.value ?? "0"} ${
          tokenMetric?.unit ?? "tokens"
        }`,
        accent: colors.ringEfficiency,
        actionLabel: "Explain Tokens",
        explainerKey: "tokens",
      },
      {
        id: "usage-per-change",
        title: "Watch token load per completed change",
        body: hasMetricEvidence(perChangeMetric)
          ? "Use per-change load to spot broad prompts or repeated context that make each edit more expensive."
          : "Per-change guidance appears once completed work and token rows can be matched.",
        evidence: `Per Change: ${perChangeMetric?.value ?? "0"} ${
          perChangeMetric?.unit ?? "tokens"
        }`,
        accent: colors.orange,
        actionLabel: "Explain Per Change",
        explainerKey: "perChange",
      },
      {
        id: "usage-cache-reuse",
        title: "Make cache reuse visible",
        body: hasMetricEvidence(cacheMetric)
          ? "Cache telemetry is present; compare reuse against repeated-context habits before changing prompts."
          : "Cache reuse should not be inferred. Keep the ring empty until cache counters are available.",
        evidence: `Cache: ${cacheMetric?.value ?? "0%"}`,
        accent: colors.ringAlignment,
        actionLabel: "Explain Cache",
        explainerKey: "cache",
      },
    ];
  }

  return [
    {
      id: "quality-evidence",
      title:
        evidenceCount > 0
          ? "Use evidence before trusting trends"
          : "Start by collecting real samples",
      body:
        evidenceCount > 0
          ? "Quality recommendations are backed by local source pointers and metric samples."
          : "Quality stays in a waiting state until the desktop source sends deterministic telemetry.",
      evidence: `${evidenceCount} source/sample pointers available`,
      accent: colors.accent,
      actionLabel: "Explain Evidence",
      explainerKey: "evidence",
    },
    {
      id: "quality-rework",
      title:
        redundancySignals > 0
          ? "Reduce repeated work in the next session"
          : "Keep rework at zero",
      body:
        redundancySignals > 0
          ? "Review failed tools, corrections, and repeated asks before starting another large task."
          : "No rework signals are visible yet; keep prompts specific so retries stay low once data arrives.",
      evidence: `${redundancySignals} rework signals`,
      accent: colors.ringEfficiency,
      actionLabel: "Explain Rework",
      explainerKey: "rework",
    },
    {
      id: "quality-alignment",
      title: "Check alignment before broad automation",
      body: "Use project guidance and deterministic checks to make sure Codex and Claude follow the same harness expectations.",
      evidence: `Alignment score: ${alignmentRing?.score ?? 0}`,
      accent: colors.ringAlignment,
      actionLabel: "Explain Alignment",
      explainerKey: "alignment",
    },
    {
      id: "quality-effectiveness",
      title: "Verify useful completion, not just activity",
      body: "A healthy harness should leave behind checked work, fewer corrections, and tool results that explain what changed.",
      evidence: `Effectiveness score: ${effectivenessRing?.score ?? 0}`,
      accent: colors.ringEffectiveness,
      actionLabel: "Explain Effectiveness",
      explainerKey: "effectiveness",
    },
  ];
}

function qualityRingSet(
  rings: Ring[],
  projects: ProjectInsight[],
  metrics: HarnessHealthModel["metrics"]
): Ring[] {
  const effectiveness =
    rings.find((ring) => ring.key === "effectiveness") ??
    emptyRing("effectiveness", "Effectiveness");
  const alignment =
    rings.find((ring) => ring.key === "alignment") ??
    emptyRing("alignment", "Alignment");
  const hasProjectData = projects.some(
    (project) =>
      project.sessions > 0 ||
      project.turns > 0 ||
      project.corrections > 0 ||
      project.toolFailures > 0 ||
      project.hedges > 0
  );
  const hasData =
    hasProjectData ||
    metrics.some(
      (metric) =>
        (metric.sourceCount ?? 0) > 0 || Boolean(metric.samples?.length)
    );
  const redundantWork = redundancySignalCount(projects, metrics);
  const redundancyScore = hasData ? clampScore(100 - redundantWork * 10) : 0;

  return [
    effectiveness,
    alignment,
    {
      key: "efficiency",
      label: "Redundancy",
      score: redundancyScore,
      delta: 0,
      hint:
        redundantWork > 0
          ? `${redundantWork} correction, retry, or repeated-work signals.`
          : hasData
            ? "No redundant-work signals in the current window."
            : "Waiting for correction and retry telemetry.",
    },
  ];
}

function usageRingSet(metrics: HarnessHealthModel["metrics"]): Ring[] {
  const tokenMetric = metricByKey(metrics, "tokens.total");
  const perChangeMetric = metricByKey(metrics, "tokens.per_change");
  const cacheMetric = metricByKey(metrics, "cache.hit_ratio");

  return [
    {
      key: "efficiency",
      label: "Token Volume",
      score: usageSignalScore(tokenMetric),
      delta: 0,
      hint: hasMetricEvidence(tokenMetric)
        ? "Today's normalized token volume from local model-call rows."
        : "Waiting for canonical model-call token rows.",
    },
    {
      key: "effectiveness",
      label: "Per Change",
      score: usageSignalScore(perChangeMetric),
      delta: 0,
      hint: hasMetricEvidence(perChangeMetric)
        ? "Average token load for each completed change."
        : "Waiting for tokens-per-change telemetry.",
    },
    {
      key: "alignment",
      label: "Cache Reuse",
      score: hasMetricEvidence(cacheMetric)
        ? clampScore(metricNumeric(cacheMetric))
        : 0,
      delta: 0,
      hint: hasMetricEvidence(cacheMetric)
        ? "Cache hit ratio from canonical token telemetry."
        : "Waiting for cache hit ratio telemetry.",
    },
  ];
}

function emptyRing(key: Ring["key"], label: string): Ring {
  return {
    key,
    label,
    score: 0,
    delta: 0,
    hint: "Waiting for telemetry.",
  };
}

function hasMetricEvidence(
  metric: HarnessHealthModel["metrics"][number] | undefined
): boolean {
  return Boolean(
    metric &&
      !metric.preview &&
      ((metric.sourceCount ?? 0) > 0 || Boolean(metric.samples?.length))
  );
}

function usageSignalScore(
  metric: HarnessHealthModel["metrics"][number] | undefined
): number {
  if (!hasMetricEvidence(metric)) return 0;
  const current = metricNumeric(metric);
  if (current <= 0) return 1;
  if (metric?.unit === "%" || metric?.key.includes("cache")) {
    return clampScore(current);
  }
  return clampScore(25 + Math.log10(current + 1) * 18);
}

function averageRingScore(rings: Ring[]): number {
  if (rings.length === 0) return 0;
  return Math.round(
    rings.reduce((sum, ring) => sum + ring.score, 0) / rings.length
  );
}

function redundancySignalCount(
  projects: ProjectInsight[],
  metrics: HarnessHealthModel["metrics"]
): number {
  const reaskMetric = metricByKey(metrics, "reask.rate");
  const reaskSignals =
    reaskMetric && (reaskMetric.sourceCount ?? 0) > 0
      ? Math.round(metricNumeric(reaskMetric))
      : 0;
  return (
    reaskSignals +
    projects.reduce(
      (sum, project) =>
        sum +
        (project.corrections ?? 0) +
        (project.toolFailures ?? 0) +
        (project.hedges ?? 0),
      0
    )
  );
}

function metricNumeric(
  metric: HarnessHealthModel["metrics"][number] | undefined
): number {
  const parsed =
    metric?.numericValue ?? Number.parseFloat(metric?.value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function HarnessCalendarSection({
  model,
  onOpenExplainer,
}: {
  model: HarnessHealthModel;
  onOpenExplainer(key: ExplainerKey): void;
}) {
  const days = buildCalendarDays(model);
  const today = days[days.length - 1];
  const monthDays = buildMonthDays(model);

  return (
    <>
      <SectionHeader
        title="Calendar"
        action="Explain"
        subtitle="Daily ring history from local samples and source evidence."
      />
      <Card style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <View>
            <Text style={styles.calendarTitle}>{formatCalendarDate()}</Text>
            <Text style={styles.calendarSubtitle}>
              {today.evidence > 0
                ? `${today.evidence} evidence points today`
                : "No timestamped samples today"}
            </Text>
          </View>
          <Pressable
            style={styles.calendarInfoButton}
            onPress={() => onOpenExplainer("quality.overview")}
            accessibilityRole="button"
            accessibilityLabel="Explain calendar rings"
          >
            <Text style={styles.calendarInfoText}>?</Text>
          </Pressable>
        </View>

        <View style={styles.weekStrip}>
          {days.map((day) => (
            <View key={day.key} style={styles.weekDay}>
              <Text style={styles.weekDayLabel}>{day.label}</Text>
              <CalendarRingDay day={day} />
            </View>
          ))}
        </View>

        <View style={styles.calendarMetricRow}>
          <CalendarStat label="Today" value={`${today.score}`} />
          <CalendarStat label="Samples" value={`${today.evidence}`} />
          <CalendarStat label="Harness" value={model.activeHarness.label} />
        </View>

        <View style={styles.monthGrid}>
          {monthDays.map((day) => (
            <View
              key={day.key}
              style={[
                styles.monthDot,
                day.hasData ? styles.monthDotActive : null,
                day.isToday ? styles.monthDotToday : null,
              ]}
            >
              <View
                style={[
                  styles.monthDotFill,
                  {
                    opacity: day.hasData ? 0.3 + day.score / 150 : 0,
                  },
                ]}
              />
            </View>
          ))}
        </View>
      </Card>
    </>
  );
}

function CalendarRingDay({
  day,
}: {
  day: {
    score: number;
    isToday: boolean;
    hasData: boolean;
  };
}) {
  const size = day.isToday ? 42 : 36;
  const ringValues = [
    { key: "outer", value: day.score },
    { key: "middle", value: Math.max(0, day.score - 8) },
    { key: "inner", value: Math.max(0, day.score - 14) },
  ];
  return (
    <View
      style={[
        styles.calendarRingWrap,
        day.isToday ? styles.calendarRingToday : null,
      ]}
    >
      <Svg height={size} viewBox="0 0 44 44" width={size}>
        {ringValues.map(({ key, value }, index) => {
          const radiusValue = 18 - index * 5;
          const circumference = 2 * Math.PI * radiusValue;
          const color =
            index === 0
              ? colors.ringEfficiency
              : index === 1
                ? colors.ringEffectiveness
                : colors.ringAlignment;
          return (
            <G key={key} rotation="-90" origin="22,22">
              <Circle
                cx={22}
                cy={22}
                fill="none"
                r={radiusValue}
                stroke={day.hasData ? `${color}33` : colors.progressTrack}
                strokeWidth={4}
              />
              {day.hasData ? (
                <Circle
                  cx={22}
                  cy={22}
                  fill="none"
                  r={radiusValue}
                  stroke={color}
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={
                    circumference * (1 - Math.min(value, 100) / 100)
                  }
                  strokeLinecap="round"
                  strokeWidth={4}
                />
              ) : null}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function CalendarStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.calendarStat}>
      <Text style={styles.calendarStatValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.calendarStatLabel}>{label}</Text>
    </View>
  );
}

function buildCalendarDays(model: HarnessHealthModel): Array<{
  key: string;
  label: string;
  score: number;
  evidence: number;
  hasData: boolean;
  isToday: boolean;
}> {
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const todayIndex = new Date().getDay();
  const mondayBasedToday = todayIndex === 0 ? 6 : todayIndex - 1;
  const evidenceToday = model.metrics.reduce(
    (sum, metric) =>
      sum + (metric.sourceCount ?? 0) + (metric.samples?.length ?? 0),
    0
  );
  const sampledValues = model.metrics
    .flatMap((metric) => metric.samples ?? [])
    .slice(-7)
    .map((sample) => Math.max(0, Math.min(100, sample.value)));

  return labels.map((label, index) => {
    const isToday = index === mondayBasedToday;
    const sampled = sampledValues[index] ?? 0;
    const evidence = isToday ? evidenceToday : sampled > 0 ? 1 : 0;
    const score = isToday
      ? evidenceToday > 0 || model.score > 0
        ? model.score
        : 0
      : sampled;
    return {
      key: `${label}-${index}`,
      label,
      score: clampScore(score),
      evidence,
      hasData: evidence > 0,
      isToday,
    };
  });
}

function buildMonthDays(model: HarnessHealthModel): Array<{
  key: string;
  score: number;
  hasData: boolean;
  isToday: boolean;
}> {
  const weekDays = buildCalendarDays(model);
  return Array.from({ length: 28 }, (_, index) => {
    const weekIndex = index - 21;
    const source = weekIndex >= 0 ? weekDays[weekIndex] : null;
    return {
      key: `month-${index}`,
      score: source?.score ?? 0,
      hasData: Boolean(source?.hasData),
      isToday: Boolean(source?.isToday),
    };
  });
}

function formatCalendarDate(): string {
  return new Date().toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function DataPointExplainerSheet({
  explainer,
  open,
  onClose,
  onRequestClose,
}: {
  explainer: DataPointExplainer;
  open: boolean;
  onClose(): void;
  onRequestClose(): void;
}) {
  return (
    <HealthBottomSheet open={open} onClose={onClose}>
      <View style={styles.explainerHero}>
        <ExplainerIllustration explainer={explainer} />
        <View style={styles.flexOne}>
          <Text style={[styles.explainerEyebrow, { color: explainer.accent }]}>
            {explainer.eyebrow}
          </Text>
          <Text style={styles.explainerTitle}>{explainer.title}</Text>
          <View style={styles.explainerValueRow}>
            <Text style={styles.explainerValue}>{explainer.value}</Text>
            <Text style={styles.explainerUnit}>{explainer.unit}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.explainerBody}>{explainer.body}</Text>
      <View style={styles.explainerRuleCard}>
        {explainer.calculation.map((line) => (
          <View key={line} style={styles.explainerRuleRow}>
            <View
              style={[
                styles.explainerRuleDot,
                { backgroundColor: explainer.accent },
              ]}
            />
            <Text style={styles.explainerRuleText}>{line}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.explainerEvidence}>{explainer.evidence}</Text>
      <Pressable style={styles.explainerAction} onPress={onRequestClose}>
        <Text style={styles.explainerActionText}>{explainer.action}</Text>
      </Pressable>
    </HealthBottomSheet>
  );
}

function ExplainerIllustration({
  explainer,
}: {
  explainer: DataPointExplainer;
}) {
  const accent = explainer.accent;
  return (
    <View style={styles.explainerIllustration}>
      <Svg height={104} viewBox="0 0 140 104" width={140}>
        <Rect fill={`${accent}22`} height={104} rx={24} width={140} />
        <Circle
          cx={42}
          cy={50}
          fill="none"
          r={25}
          stroke={`${accent}44`}
          strokeWidth={12}
        />
        <Circle
          cx={42}
          cy={50}
          fill="none"
          r={25}
          stroke={accent}
          strokeDasharray="108 157"
          strokeLinecap="round"
          strokeWidth={12}
        />
        <Rect fill={accent} height={46} rx={5} width={12} x={86} y={38} />
        <Rect
          fill={`${accent}aa`}
          height={34}
          rx={5}
          width={12}
          x={104}
          y={50}
        />
        <Rect
          fill={`${accent}66`}
          height={60}
          rx={5}
          width={12}
          x={68}
          y={24}
        />
        <Path
          d="M24 82c18-8 32-8 49 0 16 8 30 7 44-3"
          fill="none"
          stroke={accent}
          strokeLinecap="round"
          strokeWidth={4}
        />
      </Svg>
    </View>
  );
}

function buildDataPointExplainer(
  key: ExplainerKey,
  model: HarnessHealthModel
): DataPointExplainer {
  const tokenMetric = metricByKey(model.metrics, "tokens.total");
  const perChangeMetric = metricByKey(model.metrics, "tokens.per_change");
  const cacheMetric = metricByKey(model.metrics, "cache.hit_ratio");
  const effectiveness = model.rings.find(
    (ring) => ring.key === "effectiveness"
  );
  const alignment = model.rings.find((ring) => ring.key === "alignment");
  const redundancySignals = redundancySignalCount(
    model.projects,
    model.metrics
  );
  const evidenceCount = model.metrics.reduce(
    (sum, metric) =>
      sum + (metric.sourceCount ?? 0) + (metric.samples?.length ?? 0),
    0
  );
  const base = {
    evidence:
      evidenceCount > 0
        ? `${evidenceCount} local source/sample pointers support this view.`
        : "No source/sample pointers are available yet, so the value stays at zero.",
    action: "Done",
  };

  switch (key) {
    case "usage.overview":
      return {
        ...base,
        key,
        title: "Usage Overview",
        eyebrow: "Usage",
        value: `${[tokenMetric, perChangeMetric, cacheMetric].filter(hasMetricEvidence).length}`,
        unit: "sources",
        accent: colors.ringEfficiency,
        body: "Usage explains how much harness activity happened: total tokens, token load per change, and cache reuse.",
        calculation: [
          "Token volume comes from normalized model-call token rows.",
          "Per-change load divides token use by completed work when available.",
          "Cache reuse only fills when cache hit telemetry exists.",
        ],
      };
    case "tokens":
      return {
        ...base,
        key,
        title: "Token Use",
        eyebrow: "Usage",
        value: tokenMetric?.value ?? "0",
        unit: tokenMetric?.unit ?? "tokens",
        accent: colors.ringEfficiency,
        body: "Token use shows the amount of model context and output needed today.",
        calculation: [
          "Input, output, and cache token counters are normalized by connector.",
          "Preview rows do not count as real usage.",
          "No configured budget is assumed.",
        ],
      };
    case "perChange":
      return {
        ...base,
        key,
        title: "Tokens Per Change",
        eyebrow: "Usage",
        value: perChangeMetric?.value ?? "0",
        unit: perChangeMetric?.unit ?? "tokens",
        accent: colors.orange,
        body: "Per-change load helps separate useful work from expensive iteration.",
        calculation: [
          "Total tokens are divided by completed change signals.",
          "Low sample counts stay explicit instead of being projected.",
          "Use this to find overly broad prompts or context.",
        ],
      };
    case "cache":
      return {
        ...base,
        key,
        title: "Cache Reuse",
        eyebrow: "Usage",
        value: cacheMetric?.value ?? "0%",
        unit: cacheMetric?.unit ?? "%",
        accent: colors.ringAlignment,
        body: "Cache reuse shows how often repeated context can be served efficiently.",
        calculation: [
          "Cache hit ratio comes from canonical token telemetry.",
          "The ring stays empty until cache counters exist.",
          "Higher reuse can reduce repeated context cost.",
        ],
      };
    case "rework":
      return {
        ...base,
        key,
        title: "Redundant Work",
        eyebrow: "Quality",
        value: `${redundancySignals}`,
        unit: "signals",
        accent: colors.ringEfficiency,
        body: "Rework counts the patterns that make a harness repeat itself or recover from avoidable friction.",
        calculation: [
          "Corrections, failed tools, hedges, and retry pressure are counted.",
          "A lower count improves the quality ring.",
          "Zero only means no deterministic signal was found.",
        ],
      };
    case "effectiveness":
      return {
        ...base,
        key,
        title: "Effectiveness",
        eyebrow: "Quality",
        value: `${effectiveness?.score ?? 0}`,
        unit: "score",
        accent: colors.ringEffectiveness,
        body: "Effectiveness tracks whether the harness is completing useful work with enough verification.",
        calculation: [
          "Tool success, verification, and completed-work signals contribute.",
          "Corrections and failed execution lower confidence.",
          "Low evidence keeps the score at zero.",
        ],
      };
    case "alignment":
      return {
        ...base,
        key,
        title: "Alignment",
        eyebrow: "Quality",
        value: `${alignment?.score ?? 0}`,
        unit: "score",
        accent: colors.ringAlignment,
        body: "Alignment checks whether the harness follows your project guidance, privacy expectations, and intent.",
        calculation: [
          "Config, instruction, and finding signals are compared.",
          "Drift or missing guidance lowers the score.",
          "The detail stays local and deterministic.",
        ],
      };
    case "evidence":
    case "usageEvidence":
      return {
        ...base,
        key,
        title: "Evidence",
        eyebrow: key === "evidence" ? "Quality" : "Usage",
        value: `${evidenceCount}`,
        unit: "samples",
        accent: colors.accent,
        body: "Evidence counts sanitized source pointers and metric samples behind the current view.",
        calculation: [
          "Raw transcript bodies are not required for this count.",
          "Preview metrics do not become real evidence.",
          "More samples increase confidence in trends.",
        ],
      };
    default:
      return {
        ...base,
        key: "quality.overview",
        title: "Quality Overview",
        eyebrow: "Quality",
        value: `${model.score}`,
        unit: "score",
        accent: colors.accent,
        body: "Quality combines effectiveness, alignment, and redundant-work pressure into a day-level health view.",
        calculation: [
          "Effectiveness measures useful completion and verification.",
          "Alignment measures behavior against project guidance.",
          "Redundant work lowers the score when retry signals appear.",
        ],
      };
  }
}

function FavoriteMetricCard({
  metric,
  onPress,
}: {
  metric: HarnessHealthModel["metrics"][number];
  onPress(): void;
}) {
  const accent = metricAccent(metric);
  return (
    <Pressable
      style={styles.favoriteCard}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${metric.label}, ${metric.value}, ${trendLabel(metric)}`}
    >
      <View style={styles.favoriteTop}>
        <Text style={[styles.favoriteLabel, { color: accent }]}>
          {metric.label}
        </Text>
        <View style={styles.favoriteMetaRow}>
          <Text style={styles.cardTime}>Today</Text>
          <Text style={styles.favoriteChevron}>›</Text>
        </View>
      </View>
      <View style={styles.favoriteBody}>
        <View style={styles.flexOne}>
          <Text style={styles.favoriteValue}>{metric.value}</Text>
          <Text style={styles.favoriteCaption}>{trendLabel(metric)}</Text>
        </View>
        <View style={styles.favoriteChart}>
          <MiniBars
            values={metricChartValues(metric)}
            color={metricHasActivity(metric) ? accent : colors.separatorStrong}
          />
        </View>
      </View>
    </Pressable>
  );
}

function metricAccent(metric: HarnessHealthModel["metrics"][number]): string {
  if (metric.key.includes("redundancy")) return colors.ringEfficiency;
  if (metric.key.includes("token")) return colors.ringEfficiency;
  if (metric.key.includes("tool")) {
    return metric.good ? colors.ringEffectiveness : colors.orange;
  }
  if (metric.key.includes("error"))
    return metric.good ? colors.green : colors.red;
  if (metric.key.includes("effectiveness")) return colors.ringAlignment;
  if (metric.key.includes("time")) return colors.blue;
  if (metric.key.includes("harness")) return colors.violet;
  return metric.good ? colors.accent : colors.orange;
}

function metricByKey(
  metrics: HarnessHealthModel["metrics"],
  key: string
): HarnessHealthModel["metrics"][number] | undefined {
  return metrics.find((metric) => (metric.canonicalKey ?? metric.key) === key);
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function AnimatedRingStack({ rings, score }: { rings: Ring[]; score: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const size = 214;
  const stroke = 15;
  const gap = 24;
  const scale = useRef(new Animated.Value(0.94)).current;
  const animationKey = `${score}:${rings
    .map((ring) => `${ring.key}:${ring.score}`)
    .join("|")}`;

  useEffect(() => {
    if (!animationKey) return;
    progress.setValue(0);
    scale.setValue(0.94);
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: 980,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 16,
        mass: 0.9,
        stiffness: 130,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animationKey, progress, scale]);

  return (
    <Animated.View
      style={[styles.animatedRingStack, { transform: [{ scale }] }]}
      accessible
      accessibilityLabel={`Harness score ${score}`}
    >
      <Svg height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {rings.map((ring, index) => {
            const radiusValue = size / 2 - stroke / 2 - index * gap;
            const circumference = 2 * Math.PI * radiusValue;
            const fill = Math.max(0, Math.min(ring.score / 100, 1));
            const overflow = ring.score > 100;
            const dashOffset = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [circumference, circumference * (1 - fill)],
            });
            return (
              <G key={ring.key}>
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  fill="none"
                  r={radiusValue}
                  stroke={ringMutedColor(ring.key)}
                  strokeWidth={stroke}
                />
                <AnimatedCircle
                  cx={size / 2}
                  cy={size / 2}
                  fill="none"
                  r={radiusValue}
                  stroke={ringColor(ring.key)}
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  strokeWidth={stroke}
                />
                {overflow ? (
                  <AnimatedCircle
                    cx={size / 2}
                    cy={size / 2}
                    fill="none"
                    r={radiusValue}
                    stroke={ringColor(ring.key)}
                    strokeDasharray={`${circumference * 0.08} ${circumference}`}
                    strokeLinecap="round"
                    strokeOpacity={0.64}
                    strokeWidth={stroke + 4}
                  />
                ) : null}
              </G>
            );
          })}
        </G>
      </Svg>
      <View style={styles.animatedRingCenter}>
        <Text style={styles.animatedRingScore}>{score}</Text>
        <Text style={styles.animatedRingLabel}>score</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  summaryRoot: {
    flex: 1,
  },
  flexOne: { flex: 1 },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingTop: spacing.xs,
    position: "relative",
    zIndex: 30,
  },
  largeTitle: {
    color: colors.label,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  topMeta: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 2,
  },
  headerProfileWrap: {
    alignItems: "flex-end",
    position: "relative",
    zIndex: 40,
  },
  profileMenuScrim: {
    backgroundColor: "transparent",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 45,
  },
  headerProfileButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minHeight: 48,
    paddingLeft: 4,
    paddingRight: 9,
    shadowColor: colors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  profileMenuPopoverAnchor: {
    position: "absolute",
    zIndex: 60,
  },
  profilePopover: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderRadius: radius.lg,
    borderWidth: 1,
    minWidth: 266,
    overflow: "hidden",
    shadowColor: colors.shadow,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
  popoverTitle: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    textTransform: "uppercase",
  },
  popoverRefresh: {
    alignItems: "center",
    borderTopColor: colors.separator,
    borderTopWidth: 1,
    minHeight: 44,
    justifyContent: "center",
  },
  popoverRefreshText: {
    color: colors.blue,
    fontSize: 14,
    fontWeight: "700",
  },
  profileOption: {
    alignItems: "center",
    borderTopColor: colors.separator,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionLabel: {
    color: colors.label,
    fontSize: 14,
    fontWeight: "700",
  },
  optionLabelActive: {
    color: colors.accent,
  },
  optionMeta: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  optionState: {
    alignItems: "center",
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  sectionTitle: {
    color: colors.label,
    fontSize: 20,
    fontWeight: "700",
  },
  editAction: {
    color: colors.blue,
    fontSize: 15,
    fontWeight: "600",
  },
  inlineRingSummary: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
    marginTop: 2,
  },
  cardHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  cardTime: {
    color: colors.tertiary,
    fontSize: 13,
    fontWeight: "500",
  },
  ringControlRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  ringDashboard: {
    alignItems: "center",
    height: 278,
    justifyContent: "center",
    position: "relative",
  },
  ringCenterStage: {
    alignItems: "center",
    alignSelf: "center",
    height: 226,
    justifyContent: "center",
    width: 226,
  },
  ringCornerMetric: {
    maxWidth: 126,
    position: "absolute",
    zIndex: 2,
  },
  topLeftCorner: {
    left: spacing.xs,
    top: spacing.xs,
  },
  topRightCorner: {
    right: spacing.xs,
    top: spacing.xs,
  },
  bottomLeftCorner: {
    bottom: spacing.xs,
    left: spacing.xs,
  },
  bottomRightCorner: {
    bottom: spacing.xs,
    right: spacing.xs,
  },
  ringCornerMetricRight: {
    alignItems: "flex-end",
  },
  ringCornerLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  ringCornerLabelRowRight: {
    flexDirection: "row-reverse",
  },
  ringCornerDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  ringCornerLabel: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
  },
  ringCornerValueRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 4,
    marginTop: 2,
  },
  ringCornerValueRowRight: {
    justifyContent: "flex-end",
  },
  ringCornerValue: {
    color: colors.label,
    fontSize: 21,
    fontWeight: "700",
    lineHeight: 25,
    maxWidth: 84,
  },
  ringCornerMeta: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "600",
  },
  animatedRingStack: {
    alignItems: "center",
    height: 214,
    justifyContent: "center",
    width: 214,
  },
  animatedRingCenter: {
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
  },
  animatedRingScore: {
    color: colors.accent,
    fontSize: 46,
    fontWeight: "700",
    lineHeight: 50,
  },
  animatedRingLabel: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  calendarCard: {
    gap: spacing.sm,
  },
  calendarHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calendarTitle: {
    color: colors.label,
    fontSize: 18,
    fontWeight: "700",
  },
  calendarSubtitle: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  calendarInfoButton: {
    alignItems: "center",
    backgroundColor: colors.elevated,
    borderColor: colors.separator,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  calendarInfoText: {
    color: colors.secondary,
    fontSize: 16,
    fontWeight: "700",
  },
  weekStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekDay: {
    alignItems: "center",
    gap: 4,
    minWidth: 38,
  },
  weekDayLabel: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "700",
  },
  calendarRingWrap: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  calendarRingToday: {
    backgroundColor: colors.elevated,
    borderColor: colors.separator,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  calendarMetricRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  calendarStat: {
    backgroundColor: colors.elevated,
    borderColor: colors.separator,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    minHeight: 56,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  calendarStatValue: {
    color: colors.label,
    fontSize: 17,
    fontWeight: "700",
  },
  calendarStatLabel: {
    color: colors.tertiary,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    paddingTop: 2,
  },
  monthDot: {
    backgroundColor: colors.progressTrack,
    borderRadius: 4,
    height: 8,
    overflow: "hidden",
    width: 8,
  },
  monthDotActive: {
    backgroundColor: colors.accentMuted,
  },
  monthDotToday: {
    borderColor: colors.accent,
    borderWidth: 1,
  },
  monthDotFill: {
    backgroundColor: colors.accent,
    height: "100%",
    width: "100%",
  },
  explainerHero: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  explainerIllustration: {
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  explainerEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  explainerTitle: {
    color: colors.label,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 27,
    marginTop: 2,
  },
  explainerValueRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 5,
    marginTop: spacing.xs,
  },
  explainerValue: {
    color: colors.label,
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 39,
  },
  explainerUnit: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: "700",
  },
  explainerBody: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  explainerRuleCard: {
    backgroundColor: colors.elevated,
    borderColor: colors.separator,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  explainerRuleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.xs,
  },
  explainerRuleDot: {
    borderRadius: 4,
    height: 8,
    marginTop: 5,
    width: 8,
  },
  explainerRuleText: {
    color: colors.secondary,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  explainerEvidence: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  explainerAction: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    minHeight: 44,
    justifyContent: "center",
  },
  explainerActionText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: "700",
  },
  nextCard: {
    backgroundColor: colors.card,
  },
  nextKicker: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  nextAction: {
    color: colors.label,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 25,
  },
  inlineButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  inlineButtonText: {
    color: colors.onAccent,
    fontSize: 13,
    fontWeight: "700",
  },
  meta: {
    color: colors.tertiary,
    fontSize: 12,
    lineHeight: 17,
  },
  wrapGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  favoriteCard: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: 92,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: colors.shadow,
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
  },
  favoriteTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  favoriteLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  favoriteMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  favoriteChevron: {
    color: colors.tertiary,
    fontSize: 22,
    lineHeight: 22,
  },
  favoriteBody: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.md,
  },
  favoriteValue: {
    color: colors.label,
    fontSize: 28,
    fontWeight: "600",
    lineHeight: 32,
  },
  favoriteCaption: {
    color: colors.tertiary,
    fontSize: 13,
    fontWeight: "600",
  },
  favoriteChart: {
    height: 58,
    width: 86,
  },
  digest: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  projectRow: {
    alignItems: "center",
    borderTopColor: colors.separator,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 74,
    paddingTop: spacing.sm,
  },
  projectName: {
    color: colors.label,
    fontSize: 15,
    fontWeight: "700",
  },
  projectScore: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: "700",
  },
  habitRow: {
    alignItems: "center",
    borderTopColor: colors.separator,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 76,
    paddingTop: spacing.sm,
  },
  habitTitle: {
    color: colors.label,
    fontSize: 15,
    fontWeight: "700",
  },
  habitMetric: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  sourcePreviewRow: {
    alignItems: "center",
    borderTopColor: colors.separator,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 72,
    paddingTop: spacing.sm,
  },
  sourceStatus: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
});
