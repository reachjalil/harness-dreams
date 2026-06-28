import { Menu, type MenuItemConstructorOptions, Tray } from "electron";

import type { AppConfig, DreamReport, RuntimeState } from "../shared/types";
import type { Controller } from "./controller";
import { getLatest, getReports } from "./reports";
import { getTrayIcon, moonForProgress, type TrayKind } from "./trayIcons";

/**
 * Menu-bar presence. Clicking the icon (either button) shows a quick-action
 * menu: status, last-session info, start/pause, open dashboard, recent
 * sessions. The crescent waxes with dream progress.
 */

let tray: Tray | null = null;
let controllerRef: Controller | null = null;
let menu: Menu | null = null;
let lastIconSig = "";
let lastMenuSig = "";
let cycleFrame = 0;

function staticKind(state: RuntimeState): TrayKind {
  if (state.phase === "ready" && state.hasUnreviewed) return "ready";
  return "resting";
}

function statusLine(state: RuntimeState): string {
  if (state.phase === "dreaming") {
    const pct = Math.round(state.progress * 100);
    return state.paused
      ? `Paused · ${pct}%`
      : `${state.stage ?? "Dreaming"} · ${pct}%`;
  }
  if (state.phase === "ready" && state.hasUnreviewed) {
    return "Sleep Cycle ready to review";
  }
  return "Resting";
}

function tooltip(state: RuntimeState): string {
  return `Harness Dreams — ${statusLine(state)}`;
}

function quickInfo(report: DreamReport | null): MenuItemConstructorOptions[] {
  if (!report) {
    return [{ label: "No completed Sleep Cycles yet", enabled: false }];
  }
  const eff = report.rings.find((r) => r.key === "efficiency");
  const tok = report.metrics.find((m) => m.key === "tokens_per_change");
  const effText = eff
    ? `Efficiency ${eff.score} (${eff.delta >= 0 ? "+" : ""}${eff.delta})`
    : "";
  const tokText = tok ? `${tok.value} tok/change` : "";
  const summary = [effText, tokText].filter(Boolean).join(" · ");
  return [
    { label: `Latest: ${report.rangeLabel}`, enabled: false },
    ...(summary ? [{ label: summary, enabled: false }] : []),
  ];
}

function recentSessions(): MenuItemConstructorOptions {
  const c = (): Controller => controllerRef as Controller;
  const items: MenuItemConstructorOptions[] = getReports()
    .slice(0, 7)
    .map((r) => ({
      label:
        r.reviewStatus === "unreviewed"
          ? `${r.rangeLabel} · needs review`
          : r.rangeLabel,
      click: () => c().openSession(r.id),
    }));
  return {
    label: "Recent Sleep Cycles",
    submenu: items.length
      ? items
      : [{ label: "No completed Sleep Cycles yet", enabled: false }],
  };
}

function buildMenu(state: RuntimeState): Menu {
  const c = (): Controller => controllerRef as Controller;
  const dreaming = state.phase === "dreaming";
  const latest = getLatest();
  const template: MenuItemConstructorOptions[] = [
    { label: "Harness Dreams", enabled: false },
    { label: statusLine(state), enabled: false },
    ...quickInfo(latest),
    { type: "separator" },
  ];
  if (dreaming) {
    template.push(
      state.paused
        ? { label: "Resume Sleep Cycle", click: () => c().resumeDream() }
        : { label: "Pause Sleep Cycle", click: () => c().pauseDream() }
    );
  } else if (state.phase === "ready" && state.hasUnreviewed) {
    template.push({
      label: "Review Latest Sleep Cycle",
      click: () => (latest ? c().openSession(latest.id) : c().openMain()),
    });
  } else {
    template.push({
      label: "Start Sleep Cycle",
      click: () => c().dreamNow(),
    });
  }
  template.push(
    {
      label: "Open Dashboard",
      accelerator: "Cmd+O",
      click: () => c().openMain(),
    },
    { type: "separator" },
    recentSessions(),
    { type: "separator" },
    {
      label: "Quit Harness Dreams",
      accelerator: "Cmd+Q",
      click: () => c().quit(),
    }
  );
  return Menu.buildFromTemplate(template);
}

function iconSignature(state: RuntimeState): string {
  if (state.phase === "dreaming") {
    return `d:${Math.round(state.progress * 20)}:${state.paused}:${cycleFrame}`;
  }
  return staticKind(state);
}

function menuSignature(state: RuntimeState): string {
  return JSON.stringify([
    state.phase,
    state.stage,
    state.paused,
    Math.round(state.progress * 100),
    state.hasUnreviewed,
    state.lastDreamAt,
    getReports().length,
  ]);
}

function paintIcon(state: RuntimeState): void {
  if (!tray) return;
  if (state.phase === "dreaming" && !state.paused) {
    cycleFrame += 1;
  } else if (state.phase !== "dreaming") {
    cycleFrame = 0;
  }
  const sig = iconSignature(state);
  if (sig === lastIconSig) return;
  lastIconSig = sig;
  tray.setImage(
    state.phase === "dreaming"
      ? moonForProgress(state.progress, state.paused, cycleFrame)
      : getTrayIcon(staticKind(state))
  );
}

export function initTray(
  controller: Controller,
  _config: AppConfig,
  state: RuntimeState
): void {
  controllerRef = controller;
  tray = new Tray(getTrayIcon(staticKind(state)));
  lastIconSig = iconSignature(state);
  tray.setToolTip(tooltip(state));
  menu = buildMenu(state);
  lastMenuSig = menuSignature(state);

  // Either click shows the quick-action menu.
  tray.on("click", () => {
    if (menu) tray?.popUpContextMenu(menu);
  });
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
