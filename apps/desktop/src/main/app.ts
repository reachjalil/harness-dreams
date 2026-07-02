import { app, Menu, nativeTheme } from "electron";
import started from "electron-squirrel-startup";

import { initCloudSync, shutdownCloudSync } from "./cloudSync";
import { createController, initOrchestration } from "./controller";
import { initDeviceSyncServer, shutdownDeviceSyncServer } from "./deviceSync";
import { registerIpc } from "./ipc";
import { logger } from "./logger";
import { initReports } from "./reports";
import { getState } from "./state";
import { getConfig, initStore, setConfig } from "./store";
import {
  initTelemetryService,
  onTelemetryIngestStatus,
  onTelemetrySnapshot,
  shutdownTelemetryService,
} from "./telemetry";
import { initTray, setTrayTelemetrySnapshot } from "./tray";
import { broadcastToUi, setQuitting, showMain } from "./windows";
import { Send } from "../shared/channels";
import type { IngestStatus, LiveTelemetrySnapshot } from "../shared/types";

// Windows installer shortcut handling (no-op on macOS).
if (started) {
  app.quit();
}

const UI_TELEMETRY_BROADCAST_MS = 750;

let pendingTelemetrySnapshot: LiveTelemetrySnapshot | null = null;
let telemetrySnapshotTimer: ReturnType<typeof setTimeout> | null = null;
let lastTelemetrySnapshotBroadcastAt = 0;
let pendingIngestStatus: IngestStatus | null = null;
let ingestStatusTimer: ReturnType<typeof setTimeout> | null = null;
let lastIngestStatusBroadcastAt = 0;

function flushTelemetrySnapshot(): void {
  if (telemetrySnapshotTimer) clearTimeout(telemetrySnapshotTimer);
  telemetrySnapshotTimer = null;
  if (!pendingTelemetrySnapshot) return;
  lastTelemetrySnapshotBroadcastAt = Date.now();
  broadcastToUi(Send.BroadcastTelemetrySnapshot, pendingTelemetrySnapshot);
  pendingTelemetrySnapshot = null;
}

function broadcastTelemetrySnapshot(snapshot: LiveTelemetrySnapshot): void {
  pendingTelemetrySnapshot = snapshot;
  const elapsed = Date.now() - lastTelemetrySnapshotBroadcastAt;
  if (elapsed >= UI_TELEMETRY_BROADCAST_MS) {
    flushTelemetrySnapshot();
    return;
  }
  if (!telemetrySnapshotTimer) {
    telemetrySnapshotTimer = setTimeout(
      flushTelemetrySnapshot,
      UI_TELEMETRY_BROADCAST_MS - elapsed
    );
  }
}

function flushIngestStatus(): void {
  if (ingestStatusTimer) clearTimeout(ingestStatusTimer);
  ingestStatusTimer = null;
  if (!pendingIngestStatus) return;
  lastIngestStatusBroadcastAt = Date.now();
  broadcastToUi(Send.BroadcastIngestStatus, pendingIngestStatus);
  pendingIngestStatus = null;
}

function broadcastIngestStatus(status: IngestStatus): void {
  pendingIngestStatus = status;
  const shouldFlushFinalState = status.state !== "scanning";
  const elapsed = Date.now() - lastIngestStatusBroadcastAt;
  if (shouldFlushFinalState || elapsed >= UI_TELEMETRY_BROADCAST_MS) {
    flushIngestStatus();
    return;
  }
  if (!ingestStatusTimer) {
    ingestStatusTimer = setTimeout(
      flushIngestStatus,
      UI_TELEMETRY_BROADCAST_MS - elapsed
    );
  }
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
      logger.error("[app] failed to start", err);
    });

  // Menu-bar app: stay alive with no visible windows (macOS-first).
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    setQuitting(true);
    void shutdownCloudSync();
    void shutdownDeviceSyncServer();
    void shutdownTelemetryService();
  });
}

function setupMenu(): void {
  app.setAboutPanelOptions({
    applicationName: "Harness Health",
    applicationVersion: "0.1.0",
    credits:
      "Local-first Harness Health: realtime vitals, reviews, habits, and private companion sync.",
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
  // No Dock icon — Harness Health lives in the menu bar first.
  app.dock?.hide();

  // Follow the macOS system appearance. The window's "sidebar" vibrancy and the
  // renderer's prefers-color-scheme tokens both track this in lockstep, so the
  // whole UI flips with the user's Light/Dark setting. (Default is "system";
  // set explicitly so the intent is documented and stable.)
  nativeTheme.themeSource = "system";

  setupMenu();
  initStore();
  initReports();
  initDeviceSyncServer();

  // Honor the Settings "Show setup on launch" toggle: re-arm onboarding so the
  // welcome flow appears on this start. Consumed here in the main process (not
  // the renderer) so toggling it in Settings never disrupts the live session.
  if (getConfig().showOnboardingOnLaunch) {
    setConfig({ onboarded: false });
  }

  const controller = createController();
  initTray(controller, getConfig(), getState());
  registerIpc(controller);
  initCloudSync();
  initOrchestration();
  onTelemetrySnapshot((snapshot) => {
    setTrayTelemetrySnapshot(snapshot);
    broadcastTelemetrySnapshot(snapshot);
  });
  onTelemetryIngestStatus((status) => {
    broadcastIngestStatus(status);
  });
  void initTelemetryService().catch((err) => {
    logger.error("[telemetry] failed to start", err);
  });

  // First run → open onboarding. Otherwise stay quietly in the menu bar.
  if (!getConfig().onboarded) showMain();

  logger.info(
    `[hd] ready — menu-bar tray initialized, phase=${getState().phase}, onboarded=${getConfig().onboarded}`
  );
}
