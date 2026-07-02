import { Menu, type MenuItemConstructorOptions, Tray } from "electron";

import type {
  AppConfig,
  HealthReport,
  LiveTelemetrySnapshot,
  RuntimeState,
} from "../shared/types";
import type { Controller } from "./controller";
import { getLatest, getReports } from "./reports";
import { getTrayIcon, markForProgress, type TrayKind } from "./trayIcons";

/**
 * Menu-bar presence. Clicking the icon (either button) shows a quick-action
 * menu: status, last-session info, start/pause, open dashboard, recent
 * sessions. The crescent waxes with review progress.
 */

let tray: Tray | null = null;
let controllerRef: Controller | null = null;
let menu: Menu | null = null;
let lastIconSig = "";
let lastMenuSig = "";
let reviewFrame = 0;
let latestTelemetry: LiveTelemetrySnapshot | null = null;
let latestState: RuntimeState | null = null;

function staticKind(state: RuntimeState): TrayKind {
  if (state.phase === "ready" && state.hasUnreviewed) return "ready";
  return "idle";
}

function statusLine(state: RuntimeState): string {
  if (state.phase === "running") {
    const pct = Math.round(state.progress * 100);
    return state.paused
      ? `Paused · ${pct}%`
      : `${state.stage ?? "Running"} · ${pct}%`;
  }
  if (state.phase === "ready" && state.hasUnreviewed) {
    return "Health Review ready";
  }
  return "Idle";
}

function tooltip(state: RuntimeState): string {
  return `Harness Health — ${statusLine(state)}`;
}

function quickInfo(report: HealthReport | null): MenuItemConstructorOptions[] {
  if (!report) {
    return [{ label: "No completed Health Reviews yet", enabled: false }];
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

function telemetryGlance(): MenuItemConstructorOptions[] {
  if (!latestTelemetry) return [];
  const tokens = latestTelemetry.metrics.find(
    (metric) => metric.canonicalKey === "tokens.total"
  );
  const toolSuccess = latestTelemetry.metrics.find(
    (metric) => metric.canonicalKey === "tool.success_rate"
  );
  const sourceCount = latestTelemetry.sources.filter(
    (source) => source.status === "watching" || source.status === "scanning"
  ).length;
  const bits = [
    tokens ? `Tokens ${tokens.value}` : "",
    toolSuccess ? `Tools ${toolSuccess.value}` : "",
    `${sourceCount} source${sourceCount === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return bits.length > 0
    ? [{ label: `Live: ${bits.join(" · ")}`, enabled: false }]
    : [];
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
    label: "Recent Reviews",
    submenu: items.length
      ? items
      : [{ label: "No completed Health Reviews yet", enabled: false }],
  };
}

function buildMenu(state: RuntimeState): Menu {
  const c = (): Controller => controllerRef as Controller;
  const running = state.phase === "running";
  const latest = getLatest();
  const template: MenuItemConstructorOptions[] = [
    { label: "Harness Health", enabled: false },
    { label: statusLine(state), enabled: false },
    ...telemetryGlance(),
    ...quickInfo(latest),
    { type: "separator" },
  ];
  if (running) {
    template.push(
      state.paused
        ? {
            label: "Resume Health Review",
            click: () => c().resumeHealthReview(),
          }
        : { label: "Pause Health Review", click: () => c().pauseHealthReview() }
    );
  } else if (state.phase === "ready" && state.hasUnreviewed) {
    template.push({
      label: "Review Latest Health Review",
      click: () => (latest ? c().openSession(latest.id) : c().openMain()),
    });
  } else {
    template.push({
      label: "Start Health Review",
      click: () => c().runHealthReview(),
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
      label: "Quit Harness Health",
      accelerator: "Cmd+Q",
      click: () => c().quit(),
    }
  );
  return Menu.buildFromTemplate(template);
}

function iconSignature(state: RuntimeState): string {
  if (state.phase === "running") {
    return `d:${Math.round(state.progress * 20)}:${state.paused}:${reviewFrame}`;
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
    state.lastReviewAt,
    getReports().length,
    latestTelemetry?.generatedAt ?? 0,
    latestTelemetry?.status.state ?? "none",
  ]);
}

function paintIcon(state: RuntimeState): void {
  if (!tray) return;
  if (state.phase === "running" && !state.paused) {
    reviewFrame += 1;
  } else if (state.phase !== "running") {
    reviewFrame = 0;
  }
  const sig = iconSignature(state);
  if (sig === lastIconSig) return;
  lastIconSig = sig;
  tray.setImage(
    state.phase === "running"
      ? markForProgress(state.progress, state.paused, reviewFrame)
      : getTrayIcon(staticKind(state))
  );
}

export function initTray(
  controller: Controller,
  _config: AppConfig,
  state: RuntimeState
): void {
  controllerRef = controller;
  latestState = state;
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
  latestState = state;
  paintIcon(state);
  tray.setToolTip(tooltip(state));
  const sig = menuSignature(state);
  if (sig !== lastMenuSig) {
    menu = buildMenu(state);
    lastMenuSig = sig;
  }
}

export function setTrayTelemetrySnapshot(
  snapshot: LiveTelemetrySnapshot
): void {
  latestTelemetry = snapshot;
  if (!tray || !latestState) return;
  const state = latestState;
  const sig = menuSignature(state);
  if (sig !== lastMenuSig) {
    menu = buildMenu(state);
    lastMenuSig = sig;
  }
}
