import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { z } from "zod";

import { Invoke } from "../shared/channels";
import {
  ConfigPatchSchema,
  TelemetryMetricDetailInputSchema,
  TelemetryRefreshInputSchema,
} from "../shared/schemas";
import {
  acceptPeerHostPairing,
  applyPeerReviewDecisionBatch,
  getCloudSyncStatus,
  getPeerHostState,
  rotateCloudBackupKey,
  syncCloudNow,
  updatePeerHostConnection,
} from "./cloudSync";
import type { Controller } from "./controller";
import { createCloudSyncPairing, removeCloudSyncDevice } from "./deviceSync";
import { getLatest, getReports, syncReportsForConfig } from "./reports";
import { getState } from "./state";
import { getConfig, setConfig } from "./store";
import {
  getTelemetryIngestStatus,
  getTelemetryMetricDetail,
  getTelemetrySnapshot,
  refreshTelemetry,
} from "./telemetry";

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const frameUrl = event.senderFrame?.url ?? "";
  if (!frameUrl) throw new Error("Rejected IPC from unknown sender frame.");
  const parsed = new URL(frameUrl);
  if (parsed.protocol === "file:") return;
  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    const host = parsed.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return;
    }
  }
  throw new Error(`Rejected IPC sender: ${frameUrl}`);
}

function handleTrusted(
  channel: Invoke,
  handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
): void {
  ipcMain.handle(channel, (event, ...args: unknown[]) => {
    assertTrustedSender(event);
    return handler(event, ...args);
  });
}

/** Register every main-side handler. All renderer input is Zod-validated. */
export function registerIpc(controller: Controller): void {
  handleTrusted(Invoke.ConfigGet, () => getConfig());
  handleTrusted(Invoke.ConfigSet, (_event, patch: unknown) => {
    const before = getConfig().demoMode;
    const next = setConfig(ConfigPatchSchema.parse(patch));
    if (before !== next.demoMode) syncReportsForConfig();
    return next;
  });
  handleTrusted(Invoke.StateGet, () => getState());
  handleTrusted(Invoke.ReportGet, () => getLatest());
  handleTrusted(Invoke.ReportList, () => getReports());
  handleTrusted(Invoke.CloudSyncStatus, () => getCloudSyncStatus());
  handleTrusted(Invoke.CloudSyncNow, () => syncCloudNow());
  handleTrusted(Invoke.CloudSyncPairDevice, (_event, input: unknown) =>
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
  handleTrusted(Invoke.CloudSyncRemoveDevice, (_event, deviceId: unknown) =>
    removeCloudSyncDevice(z.string().parse(deviceId))
  );
  handleTrusted(Invoke.CloudSyncRotateBackupKey, () => rotateCloudBackupKey());
  handleTrusted(Invoke.PeerHostState, () => getPeerHostState());
  handleTrusted(Invoke.PeerHostPairingAccepted, (_event, input: unknown) =>
    acceptPeerHostPairing(
      z
        .object({
          pairingId: z.string().min(1),
          deviceId: z.string().min(1),
          deviceName: z.string().min(1),
          kind: z.enum(["iphone", "ipad", "watch"]),
          pairedDeviceSecret: z.string().min(24),
        })
        .parse(input)
    )
  );
  handleTrusted(Invoke.PeerHostApplyDecisions, (_event, input: unknown) =>
    applyPeerReviewDecisionBatch(input)
  );
  handleTrusted(Invoke.PeerHostConnectionStatus, (_event, input: unknown) =>
    updatePeerHostConnection(
      z
        .object({
          deviceId: z.string().min(1),
          connected: z.boolean(),
          lastSeenAt: z.number().optional(),
          iceMode: z.enum(["unknown", "stun", "turn"]).optional(),
          lastAckedRevision: z.number().int().min(0).optional(),
          error: z.string().optional(),
        })
        .parse(input)
    )
  );
  handleTrusted(Invoke.TelemetrySnapshot, () => {
    return getTelemetrySnapshot();
  });
  handleTrusted(Invoke.TelemetryMetricDetail, (_event, input: unknown) => {
    return getTelemetryMetricDetail(
      TelemetryMetricDetailInputSchema.parse(input)
    );
  });
  handleTrusted(Invoke.TelemetryRefresh, (_event, input: unknown) => {
    const parsed = TelemetryRefreshInputSchema.parse(input);
    return refreshTelemetry(parsed?.reason ?? "renderer");
  });
  handleTrusted(Invoke.TelemetryIngestStatus, () => {
    return getTelemetryIngestStatus();
  });
  handleTrusted(Invoke.DiscoverProjects, () => controller.discoverProjects());
  handleTrusted(Invoke.AddProject, (_event, projectPath: unknown) =>
    controller.addProject(z.string().parse(projectPath))
  );

  handleTrusted(Invoke.RunHealthReview, () => {
    controller.runHealthReview();
    return getState();
  });
  handleTrusted(Invoke.RunQuickReview, () => {
    controller.runQuickReview();
    return getState();
  });
  handleTrusted(Invoke.PauseHealthReview, () => {
    controller.pauseHealthReview();
    return getState();
  });
  handleTrusted(Invoke.ResumeHealthReview, () => {
    controller.resumeHealthReview();
    return getState();
  });
  handleTrusted(Invoke.CompleteOnboarding, () => {
    controller.completeOnboarding();
    return getConfig();
  });
  handleTrusted(
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
  handleTrusted(
    Invoke.SetGoalDisposition,
    (
      _event,
      reportId: unknown,
      experimentId: unknown,
      disposition: unknown
    ) => {
      controller.setGoalDisposition(
        z.string().parse(reportId),
        z.string().parse(experimentId),
        z.enum(["kept", "retired"]).nullable().parse(disposition)
      );
      return getReports();
    }
  );
  handleTrusted(
    Invoke.RevertConfigUpdate,
    (_event, reportId: unknown, findingId: unknown) => {
      controller.revertConfigUpdate(
        z.string().parse(reportId),
        z.string().parse(findingId)
      );
      return getReports();
    }
  );
  handleTrusted(Invoke.SetLaunchAtLogin, (_event, value: unknown) => {
    controller.setLaunchAtLogin(z.boolean().parse(value));
    return getConfig();
  });
  handleTrusted(Invoke.TestNotification, () => {
    controller.testNotification();
  });
  handleTrusted(Invoke.ResetOnboarding, () => {
    controller.resetOnboarding();
    return getConfig();
  });
  handleTrusted(Invoke.ResetAll, () => {
    controller.resetAll();
    return getConfig();
  });
  handleTrusted(Invoke.RevealData, () => {
    controller.revealData();
  });
  handleTrusted(Invoke.OpenMain, () => {
    controller.openMain();
  });
  handleTrusted(Invoke.Quit, () => {
    controller.quit();
  });
}
