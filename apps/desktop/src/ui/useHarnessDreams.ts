import { useCallback, useEffect, useMemo, useState } from "react";

import { makeReport, seedReports } from "../shared/mock";
import type { ConfigPatch } from "../shared/schemas";
import { stageForProgress } from "../shared/stages";
import type { AppConfig, DreamReport, RuntimeState } from "../shared/types";

export interface HarnessDreams {
  config: AppConfig | null;
  state: RuntimeState | null;
  /** Latest report (history[0]), for convenience. */
  report: DreamReport | null;
  /** Full session history, newest first. */
  reports: DreamReport[];
  patch: (patch: ConfigPatch) => void;
  actions: Window["hd"]["actions"];
}

const PREVIEW_CONFIG: AppConfig = {
  onboarded: true,
  showOnboardingOnLaunch: false,
  privacyMode: "local",
  schedule: { mode: "nightly", time: "03:00" },
  notifications: true,
  analysisDepth: "standard",
  launchAtLogin: false,
  reduceMotion: false,
  connectors: { claudeCode: true, codex: false, cursor: false },
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

/** Subscribes the UI to live config/state and the (mock) session history. */
export function useHarnessDreams(): HarnessDreams {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [state, setState] = useState<RuntimeState | null>(null);
  const [reports, setReports] = useState<DreamReport[]>([]);

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
      setReports(normalizeReports(seedReports(now)));
      return () => {
        active = false;
      };
    }

    void window.hd.config.get().then((c) => active && setConfig(c));
    void window.hd.state.get().then((s) => active && setState(s));
    void window.hd.report
      .list()
      .then((r) => active && setReports(normalizeReports(r)));

    const unsubs = [
      window.hd.events.onConfig(setConfig),
      window.hd.events.onState(setState),
      window.hd.events.onReports((r) => setReports(normalizeReports(r))),
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
          const nextReport = makeReport(
            now,
            Math.floor(now / 997) % 1000,
            "unreviewed"
          );
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
      markReviewed: async (id?: string) => {
        let hasUnreviewed = false;
        setReports((current) => {
          const normalized = normalizeReports(current);
          const latest = normalized[0];
          const targetId = id ?? latest?.id;
          const next =
            latest?.id === targetId && latest.reviewStatus === "unreviewed"
              ? [
                  {
                    ...latest,
                    reviewStatus: "reviewed" as const,
                    reviewedAt: Date.now(),
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
    [config, state]
  );

  return {
    config,
    state,
    report: reports[0] ?? null,
    reports,
    patch,
    actions: window.hd?.actions ?? previewActions,
  };
}
