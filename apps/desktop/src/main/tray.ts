import { Menu, type MenuItemConstructorOptions, Tray } from "electron";

import type { AppConfig, RuntimeState } from "../shared/types";
import type { Controller } from "./controller";
import { getTrayIcon, type TrayKind } from "./trayIcons";

/** Menu-bar presence: the crescent reflects the dream phase; the menu drives it. */

let tray: Tray | null = null;
let controllerRef: Controller | null = null;
let lastKind: TrayKind | "" = "";
let lastMenuSig = "";

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
  if (state.phase === "ready" && state.hasUnreviewed)
    return "Dream ready to review";
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
  const template: MenuItemConstructorOptions[] = [
    { label: `Harness Dreams: ${statusLine(state)}`, enabled: false },
    { label: lastDreamLine(state), enabled: false },
    { type: "separator" },
    {
      label: state.phase === "dreaming" ? "Dreaming…" : "Dream now",
      enabled: state.phase !== "dreaming",
      click: () => c().dreamNow(),
    },
    { label: "Open Harness Dreams…", click: () => c().openMain() },
    { type: "separator" },
    { label: "Quit Harness Dreams", click: () => c().quit() },
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

export function initTray(
  controller: Controller,
  _config: AppConfig,
  state: RuntimeState
): void {
  controllerRef = controller;
  const kind = trayKind(state);
  tray = new Tray(getTrayIcon(kind));
  tray.setToolTip(tooltip(state));
  tray.setContextMenu(buildMenu(state));
  lastKind = kind;
  lastMenuSig = menuSignature(state);
}

export function refreshTray(_config: AppConfig, state: RuntimeState): void {
  if (!tray) return;
  const kind = trayKind(state);
  if (kind !== lastKind) {
    tray.setImage(getTrayIcon(kind));
    lastKind = kind;
  }
  tray.setToolTip(tooltip(state));
  const sig = menuSignature(state);
  if (sig !== lastMenuSig) {
    tray.setContextMenu(buildMenu(state));
    lastMenuSig = sig;
  }
}
