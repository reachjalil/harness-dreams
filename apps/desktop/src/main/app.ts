import { app } from "electron";
import started from "electron-squirrel-startup";

import { createController, initOrchestration } from "./controller";
import { registerIpc } from "./ipc";
import { getState } from "./state";
import { getConfig, initStore } from "./store";
import { initTray } from "./tray";
import { setQuitting, showMain } from "./windows";

// Windows installer shortcut handling (no-op on macOS).
if (started) {
  app.quit();
}

// Single-instance: a second launch just surfaces the existing app.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showMain());

  app
    .whenReady()
    .then(bootstrap)
    .catch((err) => {
      console.error("[app] failed to start", err);
    });

  // Menu-bar app: stay alive with no visible windows (macOS-first).
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => setQuitting(true));
}

function bootstrap(): void {
  // No Dock icon — Harness Dreams lives only in the menu bar.
  app.dock?.hide();

  initStore();

  const controller = createController();
  initTray(controller, getConfig(), getState());
  registerIpc(controller);
  initOrchestration();

  // First run → open onboarding. Otherwise stay quietly in the menu bar.
  if (!getConfig().onboarded) showMain();
}
