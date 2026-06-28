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
  DreamReport,
  RuntimeState,
} from "../shared/types";

export interface HarnessDreams {
  config: AppConfig | null;
  state: RuntimeState | null;
  /** Latest report (history[0]), for convenience. */
  report: DreamReport | null;
  /** Full session history, newest first. */
  reports: DreamReport[];
  cloudSyncStatus: CloudSyncStatus | null;
  patch: (patch: ConfigPatch) => void;
  cloudSync: Window["hd"]["cloudSync"];
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
  schedule: { mode: "nightly", time: "03:00" },
  notifications: true,
  analysisDepth: "standard",
  guidanceApplyMode: "branch",
  remRunner: {
    provider: "codex",
    model: "gpt-5.5",
    claudePath: "claude",
    codexPath: "codex",
    timeoutMs: 180_000,
  },
  launchAtLogin: false,
  reduceMotion: false,
  cloudSync: {
    enabled: false,
    paidPlan: false,
    devBypassPaidPlan: true,
    atlasUri: "",
    databaseName: "harness_dreams",
    userId: "preview-user",
    jwtSecret: "preview-secret",
    deviceId: "preview-desktop",
    deviceName: "Preview Desktop",
    syncIntervalMs: 30_000,
    devices: [],
  },
  cloudSyncInterest: false,
  connectors: { claudeCode: true, codex: false, cursor: false },
  projects: DEMO_PROJECTS,
};

const PREVIEW_CLOUD_STATUS: CloudSyncStatus = {
  enabled: false,
  paidPlan: false,
  devBypassPaidPlan: true,
  allowedByPlan: true,
  configured: false,
  state: "disabled",
  message: "Cloud Sync is off.",
  userId: "",
  deviceId: "preview-desktop",
  databaseName: "harness_dreams",
  collections: {
    cycles: "sleep_cycles",
    decisions: "sleep_cycle_decisions",
    devices: "sync_devices",
  },
  lastSyncedAt: null,
  lastPulledAt: null,
  lastPushedAt: null,
  nextSyncAt: null,
  localSyncUrl: "http://127.0.0.1:39391",
  cyclesPushed: 0,
  decisionsPushed: 0,
  remoteDecisionsApplied: 0,
};

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

function normalizeReports(reports: DreamReport[]): DreamReport[] {
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
export function useHarnessDreams(): HarnessDreams {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [state, setState] = useState<RuntimeState | null>(null);
  const [reports, setReports] = useState<DreamReport[]>([]);
  const [cloudSyncStatus, setCloudSyncStatus] =
    useState<CloudSyncStatus | null>(null);
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
        lastDreamAt: now,
        hasUnreviewed: true,
      });
      setReports(normalizeReports(seedDemoReports(now)));
      setCloudSyncStatus(PREVIEW_CLOUD_STATUS);
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

    const unsubs = [
      window.hd.events.onConfig(setConfig),
      window.hd.events.onState(setState),
      window.hd.events.onReports((r) => setReports(normalizeReports(r))),
      window.hd.events.onCloudSync(setCloudSyncStatus),
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
      dreamNow: async () => {
        const lastDreamAt = state?.lastDreamAt ?? Date.now();
        const running: RuntimeState = {
          phase: "dreaming",
          progress: 0.04,
          stage: stageForProgress(0.04).label,
          paused: false,
          lastDreamAt,
          hasUnreviewed: false,
        };
        setState(running);
        [0.18, 0.36, 0.58, 0.8, 0.94].forEach((progress, index) => {
          window.setTimeout(
            () => {
              setState({
                phase: "dreaming",
                progress,
                stage: stageForProgress(progress).label,
                paused: false,
                lastDreamAt,
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
            lastDreamAt: now,
            hasUnreviewed: true,
          });
        }, 1600);
        return running;
      },
      napNow: async () => {
        const lastDreamAt = state?.lastDreamAt ?? Date.now();
        const running: RuntimeState = {
          phase: "dreaming",
          progress: 0.1,
          stage: stageForProgress(0.1, "nap").label,
          paused: false,
          lastDreamAt,
          hasUnreviewed: false,
        };
        setState(running);
        [0.45, 0.8].forEach((progress, index) => {
          window.setTimeout(
            () => {
              setState({
                phase: "dreaming",
                progress,
                stage: stageForProgress(progress, "nap").label,
                paused: false,
                lastDreamAt,
                hasUnreviewed: false,
              });
            },
            250 + index * 250
          );
        });
        window.setTimeout(() => {
          const now = Date.now();
          const nextReport = nextDemoReport(now, reports[0] ?? null, "nap");
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
            lastDreamAt: now,
            hasUnreviewed: true,
          });
        }, 900);
        return running;
      },
      pauseDream: async () => {
        const next = {
          ...(state ?? {
            phase: "dreaming",
            progress: 0.42,
            stage: stageForProgress(0.42).label,
            lastDreamAt: Date.now(),
            hasUnreviewed: false,
          }),
          paused: true,
        } as RuntimeState;
        setState(next);
        return next;
      },
      resumeDream: async () => {
        const next = {
          ...(state ?? {
            phase: "dreaming",
            progress: 0.42,
            stage: stageForProgress(0.42).label,
            lastDreamAt: Date.now(),
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
                  title: finding.action,
                  hypothesis: finding.improvement,
                  agentBenefit: finding.agentBenefit,
                  userBenefit: finding.userBenefit,
                  reflection: finding.reflection,
                  metric: "alignment · re-ask rate · tool success",
                  status: "running" as const,
                  progress: 0,
                  progressLabel: "0 / 3 cycles measured",
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
            lastDreamAt: Date.now(),
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
            (config ?? PREVIEW_CONFIG).cloudSync.userId
              ? "watching"
              : "disabled",
          message: (config ?? PREVIEW_CONFIG).cloudSync.enabled
            ? "Preview sync completed."
            : "Cloud Sync is off.",
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
            input?.deviceName ||
            (kind === "watch"
              ? "Apple Watch"
              : kind === "ipad"
                ? "iPad"
                : "iPhone"),
          kind,
          status: "pending",
          tokenHash: "preview-token-hash",
          createdAt: now,
          lastTokenIssuedAt: now,
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
          token: "preview.jwt.token",
          pairingUrl: "harnessdreams://pair?token=preview.jwt.token",
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
    }),
    [cloudSyncStatus, config]
  );

  return {
    config,
    state,
    report: reports[0] ?? null,
    reports,
    cloudSyncStatus,
    patch,
    cloudSync: window.hd?.cloudSync ?? previewCloudSync,
    projects: window.hd?.projects ?? previewProjects,
    actions: window.hd?.actions ?? previewActions,
    demoTimeOfDay,
    setDemoTimeOfDay,
  };
}
