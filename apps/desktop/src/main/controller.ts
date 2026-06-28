import { app, Notification, shell } from "electron";

import { Send } from "../shared/channels";
import { stageForProgress } from "../shared/stages";
import type {
  AnalysisProject,
  DiscoveredProject,
  ReviewDecisions,
} from "../shared/types";
import { onCloudSyncStatusChange } from "./cloudSync";
import { discoverAnalysisProjects } from "./localIngest";
import {
  addDream,
  getReports,
  markReportReviewed,
  onReportsChange,
  resetReports,
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
 * trigger. A manual "dream" shows progress while the local Sleep Cycle runs and
 * then publishes a fresh report + morning-style notification.
 */

export interface Controller {
  dreamNow(): void;
  pauseDream(): void;
  resumeDream(): void;
  openSession(id: string): void;
  completeOnboarding(): void;
  markReviewed(id?: string, decisions?: ReviewDecisions): void;
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

const DREAM_TICK_MS = 200;
const DREAM_STEP = 0.02;
const DEMO_DREAM_STEP = 0.14;

let dreamTimer: ReturnType<typeof setInterval> | null = null;

/** Show a macOS notification that opens the app when clicked. */
function notify(title: string, body: string): void {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title, body, silent: false });
  notification.on("click", () => showMain());
  notification.show();
}

function notifyDreamReady(): void {
  if (!getConfig().notifications) return;
  notify(
    "Your dream is ready 🌙",
    "Last night's reflection is in. Tap to review your harness health."
  );
}

function runDream(): void {
  if (getState().phase === "dreaming") return;
  patchState({
    phase: "dreaming",
    progress: 0,
    stage: stageForProgress(0).label,
    paused: false,
  });
  dreamTimer = setInterval(() => {
    // While paused, hold position — the icon and UI stay put.
    if (getState().paused) return;
    const next =
      getState().progress +
      (getConfig().demoMode ? DEMO_DREAM_STEP : DREAM_STEP);
    if (next >= 1) {
      if (dreamTimer) clearInterval(dreamTimer);
      dreamTimer = null;
      addDream();
      patchState({
        phase: "ready",
        progress: 0,
        stage: null,
        paused: false,
        lastDreamAt: Date.now(),
        hasUnreviewed: true,
      });
      notifyDreamReady();
    } else {
      patchState({ progress: next, stage: stageForProgress(next).label });
    }
  }, DREAM_TICK_MS);
}

export function createController(): Controller {
  return {
    dreamNow: () => runDream(),
    pauseDream: () => {
      if (getState().phase === "dreaming" && !getState().paused) {
        patchState({ paused: true });
      }
    },
    resumeDream: () => {
      if (getState().phase === "dreaming" && getState().paused) {
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
        "Harness Dreams",
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
        lastDreamAt: Date.now(),
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
