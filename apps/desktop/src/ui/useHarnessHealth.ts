import { useCallback, useEffect, useMemo, useState } from "react";

import { DEMO_PROJECTS, nextDemoReport, seedDemoReports } from "../shared/mock";
import type { ConfigPatch } from "../shared/schemas";
import { stageForProgress } from "../shared/stages";
import type { TimeOfDay } from "../shared/timeOfDay";
import type {
  AnalysisProject,
  AppConfig,
  CloudSyncDevice,
  CloudSyncStatus,
  DiscoveredProject,
  HealthReport,
  IngestStatus,
  LiveTelemetrySnapshot,
  RuntimeState,
} from "../shared/types";

export interface HarnessHealth {
  config: AppConfig | null;
  state: RuntimeState | null;
  /** Latest report (history[0]), for convenience. */
  report: HealthReport | null;
  /** Full session history, newest first. */
  reports: HealthReport[];
  cloudSyncStatus: CloudSyncStatus | null;
  telemetrySnapshot: LiveTelemetrySnapshot | null;
  ingestStatus: IngestStatus | null;
  patch: (patch: ConfigPatch) => void;
  cloudSync: Window["hd"]["cloudSync"];
  telemetry: Window["hd"]["telemetry"];
  projects: Window["hd"]["projects"];
  actions: Window["hd"]["actions"];
  /** Demo-only time-of-day override (null = follow the real clock). */
  demoTimeOfDay: TimeOfDay | null;
  setDemoTimeOfDay: (tod: TimeOfDay | null) => void;
}

const PREVIEW_CONFIG: AppConfig = {
  onboarded: true,
  userName: "Alex",
  demoMode: true,
  showOnboardingOnLaunch: false,
  privacyMode: "local",
  schedule: { mode: "daily", time: "03:00" },
  notifications: true,
  analysisDepth: "standard",
  guidanceApplyMode: "direct",
  insightRunner: {
    provider: "codex",
    model: "gpt-5.5",
    claudePath: "claude",
    codexPath: "codex",
    timeoutMs: 180_000,
  },
  telemetry: {
    enabled: true,
    watch: true,
    retentionDays: 90,
    rawTextRetention: false,
    priceTable: {},
  },
  launchAtLogin: false,
  reduceMotion: false,
  cloudSync: {
    enabled: false,
    paidPlan: false,
    devBypassPaidPlan: true,
    cloudApiBaseUrl: "http://127.0.0.1:8787",
    cloudUserId: "preview-user",
    deviceId: "preview-desktop",
    deviceName: "Preview Desktop",
    devices: [],
    backupEnabled: false,
    backupKey: "",
    backupKeyId: "",
    backupRetainedKeys: [],
    backupEpochId: "",
    backupRetentionDays: 30,
  },
  companionSyncInterest: false,
  connectors: { claudeCode: true, codex: true, cursor: false },
  projects: DEMO_PROJECTS,
};

const PREVIEW_CLOUD_STATUS: CloudSyncStatus = {
  enabled: false,
  paidPlan: false,
  devBypassPaidPlan: true,
  allowedByPlan: true,
  configured: false,
  state: "disabled",
  message: "Private Device Sync is off.",
  cloudUserId: "preview-user",
  deviceId: "preview-desktop",
  cloudApiBaseUrl: "http://127.0.0.1:8787",
  lastSyncedAt: null,
  lastPulledAt: null,
  lastPushedAt: null,
  nextSyncAt: null,
  reviewsPushed: 0,
  decisionsPushed: 0,
  remoteDecisionsApplied: 0,
  activeConnections: 0,
  pairingActive: false,
  iceMode: "unknown",
  revision: 0,
  backupEnabled: false,
  backupConfigured: false,
  backupRevision: 0,
  backupKeyId: "",
  lastBackedUpAt: null,
  lastBackupFailureAt: null,
  nextBackupRetryAt: null,
  backupRetryAttempt: 0,
};

function previewTelemetry(now = Date.now()): LiveTelemetrySnapshot {
  const status: IngestStatus = {
    state: "watching",
    message: "Preview telemetry is using deterministic sample data.",
    startedAt: now - 1_200,
    finishedAt: now - 400,
    filesDiscovered: 18,
    filesChanged: 3,
    eventsIngested: 142,
    cursorsUpdated: 3,
  };
  return {
    generatedAt: now,
    window: {
      start: now - 24 * 60 * 60 * 1000,
      end: now,
      label: "Last 24 hours",
    },
    baselineWindow: {
      start: now - 15 * 24 * 60 * 60 * 1000,
      end: now - 24 * 60 * 60 * 1000,
      label: "Previous 14 days",
    },
    rings: [
      {
        key: "efficiency",
        label: "Efficiency",
        score: 78,
        delta: 6,
        hint: "18.4K tokens, 31% cache reuse",
      },
      {
        key: "effectiveness",
        label: "Effectiveness",
        score: 84,
        delta: 4,
        hint: "92% tool success across 24 tool events",
      },
      {
        key: "alignment",
        label: "Alignment",
        score: 73,
        delta: -2,
        hint: "4 re-ask proxy events in 6 sessions",
      },
    ],
    metrics: [
      {
        key: "tokens",
        canonicalKey: "tokens.total",
        label: "Tokens",
        value: "18.4K",
        delta: 12,
        trend: "up",
        good: false,
        sourceCount: 9,
        confidence: "medium",
        provenance: "Preview Claude/Codex usage rows.",
      },
      {
        key: "cache",
        canonicalKey: "cache.hit_ratio",
        label: "Cache",
        value: "31%",
        delta: 7,
        trend: "up",
        good: true,
        sourceCount: 9,
        confidence: "medium",
        provenance: "Preview cache-read token ratio.",
      },
      {
        key: "tool_success",
        canonicalKey: "tool.success_rate",
        label: "Tool success",
        value: "92%",
        delta: 5,
        trend: "up",
        good: true,
        sourceCount: 24,
        confidence: "medium",
        provenance: "Preview tool-result outcomes.",
      },
      {
        key: "sessions",
        canonicalKey: "sessions.active",
        label: "Sessions",
        value: "6",
        delta: 0,
        trend: "flat",
        good: true,
        sourceCount: 142,
        confidence: "high",
        provenance: "Preview distinct session ids.",
      },
    ],
    insights: [
      {
        id: "preview-cache",
        metricIds: ["cache.hit_ratio"],
        type: "recommendation",
        severity: "neutral",
        title: "Cache reuse has room to improve",
        explanation: "Preview data shows cache reuse below the target range.",
        recommendation:
          "Keep project context stable and route narrow skills explicitly.",
        comparison: {
          currentWindow: { start: now - 24 * 60 * 60 * 1000, end: now },
          deltaPercent: 7,
        },
        confidence: "medium",
        sourceSampleCount: 9,
        deepLink: "metric:cache.hit_ratio",
        createdAt: now,
      },
    ],
    sources: [
      {
        source: "claude-code",
        label: "Claude Code",
        status: "watching",
        files: 12,
        events: 96,
        sessions: 4,
        lastActivityAt: now - 7 * 60 * 1000,
      },
      {
        source: "codex",
        label: "Codex",
        status: "watching",
        files: 6,
        events: 46,
        sessions: 2,
        lastActivityAt: now - 3 * 60 * 1000,
      },
    ],
    activeProjects: [
      {
        path: "/Users/alex/harness-health",
        name: "harness-health",
        sources: ["claude-code", "codex"],
        sessions: 6,
        events: 142,
        tokens: 18_400,
        corrections: 4,
        toolFailures: 2,
        lastActivityAt: now - 3 * 60 * 1000,
        contextScore: 78,
      },
    ],
    modelMix: [
      {
        model: "gpt-5.5",
        tokens: 11_800,
        sessions: 3,
        source: "codex",
        share: 0.64,
      },
      {
        model: "claude-sonnet",
        tokens: 6_600,
        sessions: 3,
        source: "claude-code",
        share: 0.36,
      },
    ],
    trendSeries: Array.from({ length: 14 }, (_, index) => ({
      start: now - (13 - index) * 24 * 60 * 60 * 1000,
      end: now - (12 - index) * 24 * 60 * 60 * 1000,
      label: `${index + 1}`,
      tokens: 6_000 + index * 700,
      sessions: 2 + (index % 5),
      corrections: index % 4,
      toolFailures: index % 3 === 0 ? 1 : 0,
    })),
    configArtifacts: [],
    status,
  };
}

function previewGoalTitle(finding: {
  patch?: unknown;
  project: string;
  title: string;
}): string {
  return finding.patch
    ? `Measure ${finding.project} after config update`
    : finding.title;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch)) {
    const current = out[key];
    if (isPlainObject(value) && isPlainObject(current)) {
      out[key] = deepMerge(current, value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as T;
}

function normalizeReports(reports: HealthReport[]): HealthReport[] {
  return reports.map((report, index) => {
    if (report.reviewStatus === "reviewed" || report.reviewedAt) {
      return { ...report, reviewStatus: "reviewed" as const };
    }
    if (index === 0 && report.reviewStatus !== "expired") {
      return { ...report, reviewStatus: "unreviewed" as const };
    }
    return { ...report, reviewStatus: "expired" as const };
  });
}

/** Subscribes the UI to live config/state and report history. */
export function useHarnessHealth(): HarnessHealth {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [state, setState] = useState<RuntimeState | null>(null);
  const [reports, setReports] = useState<HealthReport[]>([]);
  const [cloudSyncStatus, setCloudSyncStatus] =
    useState<CloudSyncStatus | null>(null);
  const [telemetrySnapshot, setTelemetrySnapshot] =
    useState<LiveTelemetrySnapshot | null>(null);
  const [ingestStatus, setIngestStatus] = useState<IngestStatus | null>(null);
  const [demoTimeOfDay, setDemoTimeOfDay] = useState<TimeOfDay | null>(null);

  useEffect(() => {
    let active = true;
    if (!window.hd) {
      const now = Date.now();
      setConfig(PREVIEW_CONFIG);
      setState({
        phase: "ready",
        progress: 0,
        stage: null,
        paused: false,
        lastReviewAt: now,
        hasUnreviewed: true,
      });
      setReports(normalizeReports(seedDemoReports(now)));
      setCloudSyncStatus(PREVIEW_CLOUD_STATUS);
      const preview = previewTelemetry(now);
      setTelemetrySnapshot(preview);
      setIngestStatus(preview.status);
      return () => {
        active = false;
      };
    }

    void window.hd.config.get().then((c) => active && setConfig(c));
    void window.hd.state.get().then((s) => active && setState(s));
    void window.hd.report
      .list()
      .then((r) => active && setReports(normalizeReports(r)));
    void window.hd.cloudSync
      .status()
      .then((s) => active && setCloudSyncStatus(s));
    void window.hd.telemetry
      .getSnapshot()
      .then((s) => active && setTelemetrySnapshot(s));
    void window.hd.telemetry
      .getIngestStatus()
      .then((s) => active && setIngestStatus(s));

    const unsubs = [
      window.hd.events.onConfig(setConfig),
      window.hd.events.onState(setState),
      window.hd.events.onReports((r) => setReports(normalizeReports(r))),
      window.hd.events.onCloudSync(setCloudSyncStatus),
      window.hd.events.onTelemetrySnapshot(setTelemetrySnapshot),
      window.hd.events.onIngestStatus(setIngestStatus),
    ];
    return () => {
      active = false;
      for (const unsub of unsubs) unsub();
    };
  }, []);

  const patch = useCallback((next: ConfigPatch) => {
    if (!window.hd) {
      setConfig((current) => deepMerge(current ?? PREVIEW_CONFIG, next));
      return;
    }
    void window.hd.config.set(next).then(setConfig);
  }, []);

  const previewActions = useMemo<Window["hd"]["actions"]>(
    () => ({
      runHealthReview: async () => {
        const lastReviewAt = state?.lastReviewAt ?? Date.now();
        const running: RuntimeState = {
          phase: "running",
          progress: 0.04,
          stage: stageForProgress(0.04).label,
          paused: false,
          lastReviewAt,
          hasUnreviewed: false,
        };
        setState(running);
        [0.18, 0.36, 0.58, 0.8, 0.94].forEach((progress, index) => {
          window.setTimeout(
            () => {
              setState({
                phase: "running",
                progress,
                stage: stageForProgress(progress).label,
                paused: false,
                lastReviewAt,
                hasUnreviewed: false,
              });
            },
            300 + index * 280
          );
        });
        window.setTimeout(() => {
          const now = Date.now();
          const nextReport = nextDemoReport(now, reports[0] ?? null);
          setReports((current) => [
            nextReport,
            ...normalizeReports(current).map((report) =>
              report.reviewStatus === "unreviewed"
                ? { ...report, reviewStatus: "expired" as const }
                : report
            ),
          ]);
          setState({
            phase: "ready",
            progress: 0,
            stage: null,
            paused: false,
            lastReviewAt: now,
            hasUnreviewed: true,
          });
        }, 1600);
        return running;
      },
      runQuickReview: async () => {
        const lastReviewAt = state?.lastReviewAt ?? Date.now();
        const running: RuntimeState = {
          phase: "running",
          progress: 0.1,
          stage: stageForProgress(0.1, "quick").label,
          paused: false,
          lastReviewAt,
          hasUnreviewed: false,
        };
        setState(running);
        [0.45, 0.8].forEach((progress, index) => {
          window.setTimeout(
            () => {
              setState({
                phase: "running",
                progress,
                stage: stageForProgress(progress, "quick").label,
                paused: false,
                lastReviewAt,
                hasUnreviewed: false,
              });
            },
            250 + index * 250
          );
        });
        window.setTimeout(() => {
          const now = Date.now();
          const nextReport = nextDemoReport(now, reports[0] ?? null, "quick");
          setReports((current) => [
            nextReport,
            ...normalizeReports(current).map((report) =>
              report.reviewStatus === "unreviewed"
                ? { ...report, reviewStatus: "expired" as const }
                : report
            ),
          ]);
          setState({
            phase: "ready",
            progress: 0,
            stage: null,
            paused: false,
            lastReviewAt: now,
            hasUnreviewed: true,
          });
        }, 900);
        return running;
      },
      pauseHealthReview: async () => {
        const next = {
          ...(state ?? {
            phase: "running",
            progress: 0.42,
            stage: stageForProgress(0.42).label,
            lastReviewAt: Date.now(),
            hasUnreviewed: false,
          }),
          paused: true,
        } as RuntimeState;
        setState(next);
        return next;
      },
      resumeHealthReview: async () => {
        const next = {
          ...(state ?? {
            phase: "running",
            progress: 0.42,
            stage: stageForProgress(0.42).label,
            lastReviewAt: Date.now(),
            hasUnreviewed: false,
          }),
          paused: false,
        } as RuntimeState;
        setState(next);
        return next;
      },
      completeOnboarding: async () => PREVIEW_CONFIG,
      markReviewed: async (id?: string, decisions = {}) => {
        let hasUnreviewed = false;
        setReports((current) => {
          const normalized = normalizeReports(current);
          const latest = normalized[0];
          const targetId = id ?? latest?.id;
          const reviewDecisions =
            latest?.findings
              .map((finding) => {
                const state = decisions[finding.id];
                if (
                  state !== "accepted" &&
                  state !== "rejected" &&
                  state !== "queued" &&
                  state !== "snoozed"
                ) {
                  return null;
                }
                return {
                  findingId: finding.id,
                  category: finding.category ?? "contextdoc",
                  action: finding.action,
                  project: finding.project,
                  state,
                  projectPath: finding.projectPath,
                  patch: finding.patch,
                };
              })
              .filter((entry): entry is NonNullable<typeof entry> =>
                Boolean(entry)
              ) ?? [];
          const acceptedExperiments =
            latest?.findings
              .filter((finding) => decisions[finding.id] === "accepted")
              .map((finding) => {
                const insight = latest.projectInsights?.find(
                  (project) => project.path === finding.projectPath
                );
                return {
                  id: `accepted_${finding.id}`,
                  title: previewGoalTitle(finding),
                  hypothesis: finding.patch
                    ? `Check whether this config update improves the next sessions: ${finding.userBenefit}`
                    : finding.improvement,
                  agentBenefit: finding.agentBenefit,
                  userBenefit: finding.userBenefit,
                  reflection: finding.reflection,
                  metric: "alignment · re-ask rate · tool success",
                  status: "running" as const,
                  progress: 0,
                  progressLabel: "0 / 3 reviews measured",
                  projectPath: finding.projectPath,
                  category: finding.category,
                  baseline: insight
                    ? {
                        alignment: insight.alignment,
                        corrections: insight.corrections,
                        contextScore: insight.contextHealth?.score,
                      }
                    : undefined,
                };
              }) ?? [];
          const next =
            latest?.id === targetId && latest.reviewStatus === "unreviewed"
              ? [
                  {
                    ...latest,
                    reviewStatus: "reviewed" as const,
                    reviewedAt: Date.now(),
                    reviewDecisions,
                    experiments: [
                      ...latest.experiments,
                      ...acceptedExperiments,
                    ],
                  },
                  ...normalized.slice(1),
                ]
              : normalized;
          hasUnreviewed = next.some(
            (report, index) =>
              index === 0 && report.reviewStatus === "unreviewed"
          );
          return next;
        });
        const next = {
          ...(state ?? {
            phase: "ready",
            progress: 0,
            stage: null,
            paused: false,
            lastReviewAt: Date.now(),
          }),
          hasUnreviewed,
        } as RuntimeState;
        setState(next);
        return next;
      },
      setGoalDisposition: async (reportId, experimentId, disposition) => {
        setReports((current) =>
          current.map((report) => {
            if (report.id !== reportId) return report;
            return {
              ...report,
              experiments: report.experiments.map((experiment) => {
                if (experiment.id !== experimentId) return experiment;
                if (disposition === null) {
                  const next = { ...experiment };
                  delete next.disposition;
                  return next;
                }
                return { ...experiment, disposition };
              }),
            };
          })
        );
        return reports.map((report) => {
          if (report.id !== reportId) return report;
          return {
            ...report,
            experiments: report.experiments.map((experiment) => {
              if (experiment.id !== experimentId) return experiment;
              if (disposition === null) {
                const next = { ...experiment };
                delete next.disposition;
                return next;
              }
              return { ...experiment, disposition };
            }),
          };
        });
      },
      revertConfigUpdate: async (reportId, findingId) => {
        const nextReports = reports.map((report) => {
          if (report.id !== reportId) return report;
          return {
            ...report,
            reviewDecisions: report.reviewDecisions?.map((entry) =>
              entry.findingId === findingId && entry.reviewBranch
                ? {
                    ...entry,
                    reviewBranch: {
                      ...entry.reviewBranch,
                      appliedDirectly: false,
                      revertedAt: Date.now(),
                    },
                  }
                : entry
            ),
          };
        });
        setReports(nextReports);
        return nextReports;
      },
      setLaunchAtLogin: async (launchAtLogin) => {
        const next = { ...(config ?? PREVIEW_CONFIG), launchAtLogin };
        setConfig(next);
        return next;
      },
      testNotification: async () => undefined,
      resetOnboarding: async () => PREVIEW_CONFIG,
      resetAll: async () => PREVIEW_CONFIG,
      revealData: async () => undefined,
      openMain: async () => undefined,
      quit: async () => undefined,
    }),
    [config, reports, state]
  );

  const previewProjects = useMemo<Window["hd"]["projects"]>(
    () => ({
      discover: async (): Promise<DiscoveredProject[]> =>
        DEMO_PROJECTS.map((project, index) => ({
          path: project.path,
          name: project.name,
          sources: project.sources,
          sessionCount: 8 - index * 2,
          lastActivityAt: Date.now() - index * 3_600_000,
        })),
      add: async (projectPath: string): Promise<AnalysisProject | null> => {
        const next: AnalysisProject = {
          path: projectPath,
          name: projectPath.split("/").filter(Boolean).at(-1) ?? projectPath,
          sources: ["claude-code"],
          enabled: true,
          addedAt: Date.now(),
        };
        setConfig((current) => ({
          ...(current ?? PREVIEW_CONFIG),
          projects: [
            next,
            ...((current ?? PREVIEW_CONFIG).projects ?? []).filter(
              (project) => project.path !== projectPath
            ),
          ],
        }));
        return next;
      },
    }),
    []
  );

  const previewCloudSync = useMemo<Window["hd"]["cloudSync"]>(
    () => ({
      status: async () => cloudSyncStatus ?? PREVIEW_CLOUD_STATUS,
      syncNow: async () => {
        const next: CloudSyncStatus = {
          ...(cloudSyncStatus ?? PREVIEW_CLOUD_STATUS),
          lastSyncedAt: Date.now(),
          state:
            (config ?? PREVIEW_CONFIG).cloudSync.enabled &&
            (config ?? PREVIEW_CONFIG).cloudSync.cloudUserId
              ? "watching"
              : "disabled",
          message: (config ?? PREVIEW_CONFIG).cloudSync.enabled
            ? "Preview sync completed."
            : "Private Device Sync is off.",
        };
        setCloudSyncStatus(next);
        return next;
      },
      pairDevice: async (input) => {
        const now = Date.now();
        const kind = input?.kind ?? "iphone";
        const device: CloudSyncDevice = {
          deviceId: `preview-${kind}-${now}`,
          deviceName:
            input?.deviceName || (kind === "watch" ? "Apple Watch" : "iPhone"),
          kind,
          status: "pending",
          secretHash: "preview-token-hash",
          createdAt: now,
          secretIssuedAt: now,
        };
        setConfig((current) => ({
          ...(current ?? PREVIEW_CONFIG),
          cloudSync: {
            ...(current ?? PREVIEW_CONFIG).cloudSync,
            enabled: true,
            devices: [
              device,
              ...((current ?? PREVIEW_CONFIG).cloudSync.devices ?? []),
            ],
          },
        }));
        return {
          pairingId: `preview-pairing-${now}`,
          pairingUrl:
            "harnesshealth://pair?signalUrl=http%3A%2F%2F127.0.0.1%3A8787&cloudUserId=preview-user&pairingId=preview#pairingSecret=preview",
          cloudApiBaseUrl: "http://127.0.0.1:8787",
          secret: "preview-secret",
          backupEnabled: false,
          qrDataUrl:
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Crect width='180' height='180' fill='white'/%3E%3Cpath d='M20 20h50v50H20zM110 20h50v50h-50zM20 110h50v50H20zM92 92h18v18H92zM122 92h38v18h-38zM92 122h18v38H92zM122 122h18v18h-18zM146 146h14v14h-14z' fill='black'/%3E%3C/svg%3E",
          expiresAt: now + 10 * 60 * 1000,
          device,
        };
      },
      removeDevice: async (deviceId) => {
        const current = config ?? PREVIEW_CONFIG;
        const devices = current.cloudSync.devices.filter(
          (device) => device.deviceId !== deviceId
        );
        setConfig({
          ...current,
          cloudSync: { ...current.cloudSync, devices },
        });
        return devices;
      },
      rotateBackupKey: async () => {
        const next: CloudSyncStatus = {
          ...(cloudSyncStatus ?? PREVIEW_CLOUD_STATUS),
          backupEnabled: true,
          backupConfigured: true,
          backupKeyId: `preview-key-${Date.now()}`,
          backupRevision: 0,
          lastBackedUpAt: null,
          message: "Preview backup key rotated.",
        };
        setCloudSyncStatus(next);
        return next;
      },
    }),
    [cloudSyncStatus, config]
  );

  const previewTelemetryApi = useMemo<Window["hd"]["telemetry"]>(
    () => ({
      getSnapshot: async () => telemetrySnapshot ?? previewTelemetry(),
      getMetricDetail: async (metricId) => {
        const now = Date.now();
        return {
          metricId,
          label: metricId,
          unit:
            metricId.includes("ratio") || metricId.includes("rate")
              ? "%"
              : "count",
          current: {
            metricId,
            value: telemetrySnapshot?.metrics[0]
              ? Number.parseFloat(telemetrySnapshot.metrics[0].value) || 0
              : 0,
            unit: "count",
            startAt: now - 24 * 60 * 60 * 1000,
            endAt: now,
            sourceCount: telemetrySnapshot?.status.eventsIngested ?? 0,
          },
          baseline: undefined,
          samples: (telemetrySnapshot ?? previewTelemetry(now)).trendSeries.map(
            (point) => ({
              metricId,
              value: point.tokens,
              unit: "tokens",
              startAt: point.start,
              endAt: point.end,
              sourceCount: point.sessions,
            })
          ),
          sources: (telemetrySnapshot ?? previewTelemetry(now)).sources,
          insights: (telemetrySnapshot ?? previewTelemetry(now)).insights,
        };
      },
      refresh: async () => {
        const next = previewTelemetry();
        setTelemetrySnapshot(next);
        setIngestStatus(next.status);
        return next;
      },
      getIngestStatus: async () =>
        ingestStatus ?? telemetrySnapshot?.status ?? previewTelemetry().status,
    }),
    [ingestStatus, telemetrySnapshot]
  );

  return {
    config,
    state,
    report: reports[0] ?? null,
    reports,
    cloudSyncStatus,
    telemetrySnapshot,
    ingestStatus,
    patch,
    cloudSync: window.hd?.cloudSync ?? previewCloudSync,
    telemetry: window.hd?.telemetry ?? previewTelemetryApi,
    projects: window.hd?.projects ?? previewProjects,
    actions: window.hd?.actions ?? previewActions,
    demoTimeOfDay,
    setDemoTimeOfDay,
  };
}
