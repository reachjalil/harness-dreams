import { ipcMain } from "electron";
import { z } from "zod";

import { Invoke } from "../shared/channels";
import { ConfigPatchSchema } from "../shared/schemas";
import type { Controller } from "./controller";
import { getLatest, getReports } from "./reports";
import { getState } from "./state";
import { getConfig, setConfig } from "./store";

/** Register every main-side handler. All renderer input is Zod-validated. */
export function registerIpc(controller: Controller): void {
  ipcMain.handle(Invoke.ConfigGet, () => getConfig());
  ipcMain.handle(Invoke.ConfigSet, (_event, patch: unknown) =>
    setConfig(ConfigPatchSchema.parse(patch))
  );
  ipcMain.handle(Invoke.StateGet, () => getState());
  ipcMain.handle(Invoke.ReportGet, () => getLatest());
  ipcMain.handle(Invoke.ReportList, () => getReports());

  ipcMain.handle(Invoke.DreamNow, () => {
    controller.dreamNow();
    return getState();
  });
  ipcMain.handle(Invoke.PauseDream, () => {
    controller.pauseDream();
    return getState();
  });
  ipcMain.handle(Invoke.ResumeDream, () => {
    controller.resumeDream();
    return getState();
  });
  ipcMain.handle(Invoke.CompleteOnboarding, () => {
    controller.completeOnboarding();
    return getConfig();
  });
  ipcMain.handle(Invoke.MarkReviewed, (_event, id: unknown) => {
    controller.markReviewed(z.string().optional().parse(id));
    return getState();
  });
  ipcMain.handle(Invoke.SetLaunchAtLogin, (_event, value: unknown) => {
    controller.setLaunchAtLogin(z.boolean().parse(value));
    return getConfig();
  });
  ipcMain.handle(Invoke.TestNotification, () => {
    controller.testNotification();
  });
  ipcMain.handle(Invoke.ResetOnboarding, () => {
    controller.resetOnboarding();
    return getConfig();
  });
  ipcMain.handle(Invoke.ResetAll, () => {
    controller.resetAll();
    return getConfig();
  });
  ipcMain.handle(Invoke.RevealData, () => {
    controller.revealData();
  });
  ipcMain.handle(Invoke.OpenMain, () => {
    controller.openMain();
  });
  ipcMain.handle(Invoke.Quit, () => {
    controller.quit();
  });
}
