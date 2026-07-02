import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";

import { Invoke, Send } from "./shared/channels";
import type { ConfigPatch } from "./shared/schemas";
import type {
  AnalysisProject,
  AppConfig,
  CloudSyncDevice,
  CloudSyncDeviceKind,
  CloudSyncPairing,
  CloudSyncStatus,
  DiscoveredProject,
  HealthReport,
  GoalDisposition,
  IngestStatus,
  LiveMetricDetail,
  LiveTelemetrySnapshot,
  PeerHostConnectionUpdate,
  PeerHostPairingAccepted,
  PeerHostPairingSession,
  PeerHostState,
  ReviewDecisions,
  RuntimeState,
} from "./shared/types";

/**
 * The one and only bridge. We expose a narrow, app-shaped `window.hd` API —
 * never raw ipcRenderer — and validate everything again in main.
 */

type Unsubscribe = () => void;

function subscribe<T>(
  channel: string,
  callback: (payload: T) => void
): Unsubscribe {
  const listener = (_event: IpcRendererEvent, payload: T): void =>
    callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api = {
  config: {
    get: (): Promise<AppConfig> => ipcRenderer.invoke(Invoke.ConfigGet),
    set: (patch: ConfigPatch): Promise<AppConfig> =>
      ipcRenderer.invoke(Invoke.ConfigSet, patch),
  },
  state: {
    get: (): Promise<RuntimeState> => ipcRenderer.invoke(Invoke.StateGet),
  },
  report: {
    get: (): Promise<HealthReport | null> =>
      ipcRenderer.invoke(Invoke.ReportGet),
    list: (): Promise<HealthReport[]> => ipcRenderer.invoke(Invoke.ReportList),
  },
  cloudSync: {
    status: (): Promise<CloudSyncStatus> =>
      ipcRenderer.invoke(Invoke.CloudSyncStatus),
    syncNow: (): Promise<CloudSyncStatus> =>
      ipcRenderer.invoke(Invoke.CloudSyncNow),
    pairDevice: (input?: {
      deviceName?: string;
      kind?: CloudSyncDeviceKind;
    }): Promise<CloudSyncPairing> =>
      ipcRenderer.invoke(Invoke.CloudSyncPairDevice, input),
    removeDevice: (deviceId: string): Promise<CloudSyncDevice[]> =>
      ipcRenderer.invoke(Invoke.CloudSyncRemoveDevice, deviceId),
    rotateBackupKey: (): Promise<CloudSyncStatus> =>
      ipcRenderer.invoke(Invoke.CloudSyncRotateBackupKey),
  },
  peerHost: {
    state: (): Promise<PeerHostState> =>
      ipcRenderer.invoke(Invoke.PeerHostState),
    pairingAccepted: (
      input: PeerHostPairingAccepted
    ): Promise<CloudSyncDevice[]> =>
      ipcRenderer.invoke(Invoke.PeerHostPairingAccepted, input),
    applyDecisions: (
      input: unknown
    ): Promise<{ applied: number; revision: number }> =>
      ipcRenderer.invoke(Invoke.PeerHostApplyDecisions, input),
    connectionStatus: (
      input: PeerHostConnectionUpdate
    ): Promise<CloudSyncStatus> =>
      ipcRenderer.invoke(Invoke.PeerHostConnectionStatus, input),
    onRefresh: (
      cb: (payload: { reason: string; at: number }) => void
    ): Unsubscribe => subscribe(Send.PeerHostRefresh, cb),
    onPairingSession: (
      cb: (session: PeerHostPairingSession) => void
    ): Unsubscribe => subscribe(Send.PeerHostPairingSession, cb),
  },
  telemetry: {
    getSnapshot: (): Promise<LiveTelemetrySnapshot> =>
      ipcRenderer.invoke(Invoke.TelemetrySnapshot),
    getMetricDetail: (
      metricId: string,
      range?: "24h" | "7d" | "30d" | "90d",
      filters?: {
        source?: "claude-code" | "codex" | "cursor" | "code";
        projectPath?: string;
        model?: string;
      }
    ): Promise<LiveMetricDetail> =>
      ipcRenderer.invoke(Invoke.TelemetryMetricDetail, {
        metricId,
        range,
        filters,
      }),
    refresh: (): Promise<LiveTelemetrySnapshot> =>
      ipcRenderer.invoke(Invoke.TelemetryRefresh, { reason: "renderer" }),
    getIngestStatus: (): Promise<IngestStatus> =>
      ipcRenderer.invoke(Invoke.TelemetryIngestStatus),
  },
  projects: {
    discover: (): Promise<DiscoveredProject[]> =>
      ipcRenderer.invoke(Invoke.DiscoverProjects),
    add: (projectPath: string): Promise<AnalysisProject | null> =>
      ipcRenderer.invoke(Invoke.AddProject, projectPath),
  },
  actions: {
    runHealthReview: (): Promise<RuntimeState> =>
      ipcRenderer.invoke(Invoke.RunHealthReview),
    runQuickReview: (): Promise<RuntimeState> =>
      ipcRenderer.invoke(Invoke.RunQuickReview),
    pauseHealthReview: (): Promise<RuntimeState> =>
      ipcRenderer.invoke(Invoke.PauseHealthReview),
    resumeHealthReview: (): Promise<RuntimeState> =>
      ipcRenderer.invoke(Invoke.ResumeHealthReview),
    completeOnboarding: (): Promise<AppConfig> =>
      ipcRenderer.invoke(Invoke.CompleteOnboarding),
    markReviewed: (
      id?: string,
      decisions?: ReviewDecisions
    ): Promise<RuntimeState> =>
      ipcRenderer.invoke(Invoke.MarkReviewed, id, decisions),
    setGoalDisposition: (
      reportId: string,
      experimentId: string,
      disposition: GoalDisposition | null
    ): Promise<HealthReport[]> =>
      ipcRenderer.invoke(
        Invoke.SetGoalDisposition,
        reportId,
        experimentId,
        disposition
      ),
    revertConfigUpdate: (
      reportId: string,
      findingId: string
    ): Promise<HealthReport[]> =>
      ipcRenderer.invoke(Invoke.RevertConfigUpdate, reportId, findingId),
    setLaunchAtLogin: (value: boolean): Promise<AppConfig> =>
      ipcRenderer.invoke(Invoke.SetLaunchAtLogin, value),
    testNotification: (): Promise<void> =>
      ipcRenderer.invoke(Invoke.TestNotification),
    resetOnboarding: (): Promise<AppConfig> =>
      ipcRenderer.invoke(Invoke.ResetOnboarding),
    resetAll: (): Promise<AppConfig> => ipcRenderer.invoke(Invoke.ResetAll),
    revealData: (): Promise<void> => ipcRenderer.invoke(Invoke.RevealData),
    openMain: (): Promise<void> => ipcRenderer.invoke(Invoke.OpenMain),
    quit: (): Promise<void> => ipcRenderer.invoke(Invoke.Quit),
  },
  events: {
    onConfig: (cb: (config: AppConfig) => void): Unsubscribe =>
      subscribe(Send.BroadcastConfig, cb),
    onState: (cb: (state: RuntimeState) => void): Unsubscribe =>
      subscribe(Send.BroadcastState, cb),
    onReports: (cb: (reports: HealthReport[]) => void): Unsubscribe =>
      subscribe(Send.BroadcastReports, cb),
    onCloudSync: (cb: (status: CloudSyncStatus) => void): Unsubscribe =>
      subscribe(Send.BroadcastCloudSync, cb),
    onTelemetrySnapshot: (
      cb: (snapshot: LiveTelemetrySnapshot) => void
    ): Unsubscribe => subscribe(Send.BroadcastTelemetrySnapshot, cb),
    onIngestStatus: (cb: (status: IngestStatus) => void): Unsubscribe =>
      subscribe(Send.BroadcastIngestStatus, cb),
    onSelectReport: (cb: (id: string) => void): Unsubscribe =>
      subscribe(Send.SelectReport, cb),
  },
};

export type HarnessHealthApi = typeof api;

contextBridge.exposeInMainWorld("hd", api);

declare global {
  interface Window {
    hd: HarnessHealthApi;
  }
}
