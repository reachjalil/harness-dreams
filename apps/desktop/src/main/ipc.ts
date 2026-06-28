import { ipcMain } from "electron";
import { z } from "zod";

import { Invoke } from "../shared/channels";
import { ConfigPatchSchema } from "../shared/schemas";
import { getCloudSyncStatus, syncCloudNow } from "./cloudSync";
import type { Controller } from "./controller";
import { createCloudSyncPairing, removeCloudSyncDevice } from "./deviceSync";
import { getLatest, getReports, syncReportsForConfig } from "./reports";
import { getState } from "./state";
import { getConfig, setConfig } from "./store";

/** Register every main-side handler. All renderer input is Zod-validated. */
export function registerIpc(controller: Controller): void {
  ipcMain.handle(Invoke.ConfigGet, () => getConfig());
  ipcMain.handle(Invoke.ConfigSet, (_event, patch: unknown) => {
    const before = getConfig().demoMode;
    const next = setConfig(ConfigPatchSchema.parse(patch));
    if (before !== next.demoMode) syncReportsForConfig();
    return next;
  });
  ipcMain.handle(Invoke.StateGet, () => getState());
  ipcMain.handle(Invoke.ReportGet, () => getLatest());
  ipcMain.handle(Invoke.ReportList, () => getReports());
  ipcMain.handle(Invoke.CloudSyncStatus, () => getCloudSyncStatus());
  ipcMain.handle(Invoke.CloudSyncNow, () => syncCloudNow());
  ipcMain.handle(Invoke.CloudSyncPairDevice, (_event, input: unknown) =>
    createCloudSyncPairing(
      z
        .object({
          deviceName: z.string().optional(),
          kind: z.enum(["iphone", "ipad", "watch"]).optional(),
        })
        .optional()
        .parse(input) ?? {}
    )
  );
  ipcMain.handle(Invoke.CloudSyncRemoveDevice, (_event, deviceId: unknown) =>
    removeCloudSyncDevice(z.string().parse(deviceId))
  );
  ipcMain.handle(Invoke.DiscoverProjects, () => controller.discoverProjects());
  ipcMain.handle(Invoke.AddProject, (_event, projectPath: unknown) =>
    controller.addProject(z.string().parse(projectPath))
  );

  ipcMain.handle(Invoke.DreamNow, () => {
    controller.dreamNow();
    return getState();
  });
  ipcMain.handle(Invoke.NapNow, () => {
    controller.napNow();
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
  ipcMain.handle(
    Invoke.MarkReviewed,
    (_event, id: unknown, decisions: unknown) => {
      const ReviewDecisionsSchema = z.record(
        z.string(),
        z.enum(["open", "accepted", "rejected", "snoozed", "queued"])
      );
      controller.markReviewed(
        z.string().optional().parse(id),
        ReviewDecisionsSchema.optional().parse(decisions)
      );
      return getState();
    }
  );
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
