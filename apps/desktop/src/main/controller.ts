import { app, Notification } from "electron";

import { Send } from "../shared/channels";
import { refreshTray } from "./tray";
import { getState, onStateChange, patchState } from "./state";
import { getConfig, onConfigChange, setConfig } from "./store";
import { broadcastToUi, setQuitting, showMain } from "./windows";

/**
 * The controller owns every state-changing action the tray, menu, and UI can
 * trigger. In this mock build, "dreaming" is a simulated progress run that ends
 * with a fresh report + a morning-style notification.
 */

export interface Controller {
  dreamNow(): void;
  completeOnboarding(): void;
  markReviewed(): void;
  setLaunchAtLogin(value: boolean): void;
  openMain(): void;
  quit(): void;
}

const DREAM_TICK_MS = 140;
const DREAM_STEP = 0.06;

let dreamTimer: ReturnType<typeof setInterval> | null = null;

function notifyDreamReady(): void {
  if (!getConfig().notifications || !Notification.isSupported()) return;
  const notification = new Notification({
    title: "Your dream is ready 🌙",
    body: "Last night's reflection is in. Tap to review your harness health.",
    silent: false,
  });
  notification.on("click", () => showMain());
  notification.show();
}

function runDream(): void {
  if (getState().phase === "dreaming") return;
  patchState({ phase: "dreaming", progress: 0 });
  dreamTimer = setInterval(() => {
    const next = getState().progress + DREAM_STEP;
    if (next >= 1) {
      if (dreamTimer) clearInterval(dreamTimer);
      dreamTimer = null;
      patchState({
        phase: "ready",
        progress: 0,
        lastDreamAt: Date.now(),
        hasUnreviewed: true,
      });
      notifyDreamReady();
    } else {
      patchState({ progress: next });
    }
  }, DREAM_TICK_MS);
}

export function createController(): Controller {
  return {
    dreamNow: () => runDream(),
    completeOnboarding: () => {
      setConfig({ onboarded: true });
    },
    markReviewed: () => {
      if (getState().hasUnreviewed) patchState({ hasUnreviewed: false });
    },
    setLaunchAtLogin: (value: boolean) => {
      app.setLoginItemSettings({ openAtLogin: value });
      setConfig({ launchAtLogin: value });
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
}
