import { ipcMain } from "electron";
import { z } from "zod";

import { Invoke } from "../shared/channels";
import { MOCK_REPORT } from "../shared/mock";
import { ConfigPatchSchema } from "../shared/schemas";
import type { Controller } from "./controller";
import { getState } from "./state";
import { getConfig, setConfig } from "./store";

/** Register every main-side handler. All renderer input is Zod-validated. */
export function registerIpc(controller: Controller): void {
  ipcMain.handle(Invoke.ConfigGet, () => getConfig());
  ipcMain.handle(Invoke.ConfigSet, (_event, patch: unknown) =>
    setConfig(ConfigPatchSchema.parse(patch))
  );
  ipcMain.handle(Invoke.StateGet, () => getState());
  ipcMain.handle(Invoke.ReportGet, () => MOCK_REPORT);

  ipcMain.handle(Invoke.DreamNow, () => {
    controller.dreamNow();
    return getState();
  });
  ipcMain.handle(Invoke.CompleteOnboarding, () => {
    controller.completeOnboarding();
    return getConfig();
  });
  ipcMain.handle(Invoke.MarkReviewed, () => {
    controller.markReviewed();
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
