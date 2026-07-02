import { app, Notification, shell } from "electron";

import { Send } from "../shared/channels";
import { stageForProgress } from "../shared/stages";
import { timeOfDay } from "../shared/timeOfDay";
import type {
  AnalysisProject,
  HealthReviewKind,
  DiscoveredProject,
  GoalDisposition,
  ReviewDecisions,
} from "../shared/types";
import { onCloudSyncStatusChange } from "./cloudSync";
import { discoverAnalysisProjects } from "./localIngest";
import {
  addHealthReview,
  getReports,
  markReportReviewed,
  onReportsChange,
  resetReports,
  revertConfigUpdate,
  setGoalDisposition,
} from "./reports";
import { getState, onStateChange, patchState } from "./state";
import {
  getConfig,
  getConfigPath,
  onConfigChange,
  resetConfig,
  setConfig,
} from "./store";
import { refreshTray } from "./tray";
import { broadcastToUi, setQuitting, showMain } from "./windows";

/**
 * The controller owns every state-changing action the tray, menu, and UI can
 * trigger. A manual review shows progress while the local Health Review runs
 * and then publishes a fresh report + morning-style notification.
 */

export interface Controller {
  runHealthReview(): void;
  runQuickReview(): void;
  pauseHealthReview(): void;
  resumeHealthReview(): void;
  openSession(id: string): void;
  completeOnboarding(): void;
  markReviewed(id?: string, decisions?: ReviewDecisions): void;
  setGoalDisposition(
    reportId: string,
    experimentId: string,
    disposition: GoalDisposition | null
  ): void;
  revertConfigUpdate(reportId: string, findingId: string): void;
  discoverProjects(): DiscoveredProject[];
  addProject(projectPath: string): AnalysisProject | null;
  setLaunchAtLogin(value: boolean): void;
  testNotification(): void;
  resetOnboarding(): void;
  resetAll(): void;
  revealData(): void;
  openMain(): void;
  quit(): void;
}

const REVIEW_TICK_MS = 200;
// Real full reviews run local ingest plus the configured CLI analyzer, so keep
// the visible progress paced like a real end-to-end pass instead of a demo.
const REVIEW_STEP = 0.006;
const DEMO_REVIEW_STEP = 0.14;
// A quick review is the fast path — it fills quicker than a full review.
const QUICK_REVIEW_STEP = 0.02;
const DEMO_QUICK_REVIEW_STEP = 0.28;

let reviewTimer: ReturnType<typeof setInterval> | null = null;

/** Show a macOS notification that opens the app when clicked. */
function notify(title: string, body: string): void {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title, body, silent: false });
  notification.on("click", () => showMain());
  notification.show();
}

/** Time-of-day lead for the morning nudge, so it feels like a companion. */
function greetingPrefix(): string {
  switch (timeOfDay(new Date())) {
    case "morning":
      return "Good morning";
    case "midday":
      return "Good afternoon";
    case "evening":
      return "Good evening";
    default:
      return "Hello";
  }
}

function notifyReviewReady(kind: HealthReviewKind): void {
  if (!getConfig().notifications) return;
  if (kind === "quick") {
    notify(
      "Your quick health review is ready",
      "A short look at this morning's harness habits is ready."
    );
    return;
  }
  notify(
    `${greetingPrefix()} — your Harness Health review is ready`,
    "Last night's review is in. Tap to see vitals, habits, and recommendations."
  );
}

function stepFor(kind: HealthReviewKind): number {
  const demo = getConfig().demoMode;
  if (kind === "quick")
    return demo ? DEMO_QUICK_REVIEW_STEP : QUICK_REVIEW_STEP;
  return demo ? DEMO_REVIEW_STEP : REVIEW_STEP;
}

function runReview(kind: HealthReviewKind = "full"): void {
  if (getState().phase === "running") return;
  const step = stepFor(kind);
  patchState({
    phase: "running",
    progress: 0,
    stage: stageForProgress(0, kind).label,
    paused: false,
  });
  reviewTimer = setInterval(() => {
    // While paused, hold position — the icon and UI stay put.
    if (getState().paused) return;
    const next = getState().progress + step;
    if (next >= 1) {
      if (reviewTimer) clearInterval(reviewTimer);
      reviewTimer = null;
      addHealthReview(kind);
      patchState({
        phase: "ready",
        progress: 0,
        stage: null,
        paused: false,
        lastReviewAt: Date.now(),
        hasUnreviewed: true,
      });
      notifyReviewReady(kind);
    } else {
      patchState({ progress: next, stage: stageForProgress(next, kind).label });
    }
  }, REVIEW_TICK_MS);
}

export function createController(): Controller {
  return {
    runHealthReview: () => runReview("full"),
    runQuickReview: () => runReview("quick"),
    pauseHealthReview: () => {
      if (getState().phase === "running" && !getState().paused) {
        patchState({ paused: true });
      }
    },
    resumeHealthReview: () => {
      if (getState().phase === "running" && getState().paused) {
        patchState({ paused: false });
      }
    },
    openSession: (id: string) => {
      showMain();
      broadcastToUi(Send.SelectReport, id);
    },
    completeOnboarding: () => {
      setConfig({ onboarded: true });
    },
    markReviewed: (id?: string, decisions?: ReviewDecisions) => {
      markReportReviewed(id, decisions);
      const hasUnreviewed = getReports().some(
        (report) => report.reviewStatus === "unreviewed"
      );
      if (getState().hasUnreviewed !== hasUnreviewed) {
        patchState({ hasUnreviewed });
      }
    },
    setGoalDisposition: (reportId, experimentId, disposition) => {
      setGoalDisposition(reportId, experimentId, disposition);
    },
    revertConfigUpdate: (reportId, findingId) => {
      revertConfigUpdate(reportId, findingId);
    },
    discoverProjects: () => discoverAnalysisProjects(),
    addProject: (projectPath: string) => {
      const discovered = discoverAnalysisProjects().find(
        (project) => project.path === projectPath
      );
      if (!discovered) return null;
      const current = getConfig().projects ?? [];
      const existing = current.find((project) => project.path === projectPath);
      const nextProject: AnalysisProject = existing
        ? { ...existing, enabled: true, sources: discovered.sources }
        : {
            path: discovered.path,
            name: discovered.name,
            sources: discovered.sources,
            enabled: true,
            addedAt: Date.now(),
          };
      setConfig({
        projects: [
          nextProject,
          ...current.filter((project) => project.path !== projectPath),
        ],
        connectors: {
          claudeCode:
            getConfig().connectors.claudeCode ||
            discovered.sources.includes("claude-code"),
          codex:
            getConfig().connectors.codex ||
            discovered.sources.includes("codex"),
        },
      });
      return nextProject;
    },
    setLaunchAtLogin: (value: boolean) => {
      app.setLoginItemSettings({ openAtLogin: value });
      setConfig({ launchAtLogin: value });
    },
    testNotification: () =>
      notify(
        "Harness Health",
        "Notifications are working — this is what a morning nudge looks like."
      ),
    resetOnboarding: () => {
      setConfig({ onboarded: false });
      showMain();
    },
    resetAll: () => {
      resetConfig();
      resetReports();
      patchState({
        phase: "ready",
        progress: 0,
        stage: null,
        paused: false,
        lastReviewAt: Date.now(),
        hasUnreviewed: true,
      });
      showMain();
    },
    revealData: () => {
      void shell.showItemInFolder(getConfigPath());
    },
    openMain: () => showMain(),
    quit: () => {
      setQuitting(true);
      app.quit();
    },
  };
}

/** Wire state/config changes to the tray and the UI. */
export function initOrchestration(): void {
  onStateChange((state) => {
    refreshTray(getConfig(), state);
    broadcastToUi(Send.BroadcastState, state);
  });
  onConfigChange((config) => {
    refreshTray(config, getState());
    broadcastToUi(Send.BroadcastConfig, config);
  });
  onReportsChange((reports) => {
    broadcastToUi(Send.BroadcastReports, reports);
  });
  onCloudSyncStatusChange((status) => {
    broadcastToUi(Send.BroadcastCloudSync, status);
  });
}
