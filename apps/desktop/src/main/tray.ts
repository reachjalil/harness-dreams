import { Menu, type MenuItemConstructorOptions, Tray } from "electron";

import type { AppConfig, RuntimeState } from "../shared/types";
import type { Controller } from "./controller";
import { getDreamingFrame, getTrayIcon, type TrayKind } from "./trayIcons";

/**
 * Menu-bar presence. Left-click opens the app; right-click shows a quick menu.
 * The crescent reflects the dream phase and gently pulses while dreaming.
 */

let tray: Tray | null = null;
let controllerRef: Controller | null = null;
let menu: Menu | null = null;
let lastKind: TrayKind | "" = "";
let lastMenuSig = "";
let pulseFrame = 0;

function trayKind(state: RuntimeState): TrayKind {
  if (state.phase === "dreaming") return "dreaming";
  if (state.phase === "ready" && state.hasUnreviewed) return "ready";
  return "resting";
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLine(state: RuntimeState): string {
  if (state.phase === "dreaming") {
    return `Dreaming… ${Math.round(state.progress * 100)}%`;
  }
  if (state.phase === "ready" && state.hasUnreviewed) {
    return "Dream ready to review";
  }
  return "Resting";
}

function lastDreamLine(state: RuntimeState): string {
  if (state.lastDreamAt === null) return "No dreams yet";
  return `Last dream: ${formatTime(state.lastDreamAt)}`;
}

function tooltip(state: RuntimeState): string {
  return `Harness Dreams — ${statusLine(state)}`;
}

function buildMenu(state: RuntimeState): Menu {
  const c = (): Controller => controllerRef as Controller;
  const dreaming = state.phase === "dreaming";
  const template: MenuItemConstructorOptions[] = [
    { label: `Harness Dreams: ${statusLine(state)}`, enabled: false },
    { label: lastDreamLine(state), enabled: false },
    { type: "separator" },
    {
      label: dreaming ? "Dreaming…" : "Dream now",
      enabled: !dreaming,
      click: () => c().dreamNow(),
    },
    {
      label: state.hasUnreviewed
        ? "Review your dream…"
        : "Open Harness Dreams…",
      accelerator: "Cmd+O",
      click: () => c().openMain(),
    },
    { type: "separator" },
    {
      label: "Quit Harness Dreams",
      accelerator: "Cmd+Q",
      click: () => c().quit(),
    },
  ];
  return Menu.buildFromTemplate(template);
}

function menuSignature(state: RuntimeState): string {
  return JSON.stringify([
    state.phase,
    Math.round(state.progress * 100),
    state.hasUnreviewed,
    state.lastDreamAt,
  ]);
}

function paintIcon(state: RuntimeState): void {
  if (!tray) return;
  if (state.phase === "dreaming") {
    tray.setImage(getDreamingFrame(pulseFrame++));
    lastKind = "dreaming";
    return;
  }
  const kind = trayKind(state);
  if (kind !== lastKind) {
    tray.setImage(getTrayIcon(kind));
    lastKind = kind;
  }
}

export function initTray(
  controller: Controller,
  _config: AppConfig,
  state: RuntimeState
): void {
  controllerRef = controller;
  tray = new Tray(getTrayIcon(trayKind(state)));
  lastKind = trayKind(state);
  tray.setToolTip(tooltip(state));
  menu = buildMenu(state);
  lastMenuSig = menuSignature(state);

  // Left-click opens the app; right-click pops the quick menu (macOS pattern).
  tray.on("click", () => controllerRef?.openMain());
  tray.on("right-click", () => {
    if (menu) tray?.popUpContextMenu(menu);
  });
}

export function refreshTray(_config: AppConfig, state: RuntimeState): void {
  if (!tray) return;
  paintIcon(state);
  tray.setToolTip(tooltip(state));
  const sig = menuSignature(state);
  if (sig !== lastMenuSig) {
    menu = buildMenu(state);
    lastMenuSig = sig;
  }
}
