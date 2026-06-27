import { app, Menu } from "electron";
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

function setupMenu(): void {
  app.setAboutPanelOptions({
    applicationName: "Harness Dreams",
    applicationVersion: "0.1.0",
    credits: "Your harness health app — reflect while your harness sleeps.",
    copyright: "© 2026 Jalil",
  });
  // A minimal native menu so standard shortcuts work (⌘Q/⌘W, and ⌘C/⌘V/⌘A
  // inside text fields like the schedule time picker).
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: "appMenu" },
      { role: "editMenu" },
      { role: "windowMenu" },
    ])
  );
}

function bootstrap(): void {
  // No Dock icon — Harness Dreams lives only in the menu bar.
  app.dock?.hide();

  setupMenu();
  initStore();

  const controller = createController();
  initTray(controller, getConfig(), getState());
  registerIpc(controller);
  initOrchestration();

  // First run → open onboarding. Otherwise stay quietly in the menu bar.
  if (!getConfig().onboarded) showMain();

  console.log(
    `[hd] ready — menu-bar tray initialized, phase=${getState().phase}, onboarded=${getConfig().onboarded}`
  );
}
