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
  DreamReport,
  GoalDisposition,
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
    get: (): Promise<DreamReport | null> =>
      ipcRenderer.invoke(Invoke.ReportGet),
    list: (): Promise<DreamReport[]> => ipcRenderer.invoke(Invoke.ReportList),
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
  },
  projects: {
    discover: (): Promise<DiscoveredProject[]> =>
      ipcRenderer.invoke(Invoke.DiscoverProjects),
    add: (projectPath: string): Promise<AnalysisProject | null> =>
      ipcRenderer.invoke(Invoke.AddProject, projectPath),
  },
  actions: {
    dreamNow: (): Promise<RuntimeState> => ipcRenderer.invoke(Invoke.DreamNow),
    napNow: (): Promise<RuntimeState> => ipcRenderer.invoke(Invoke.NapNow),
    pauseDream: (): Promise<RuntimeState> =>
      ipcRenderer.invoke(Invoke.PauseDream),
    resumeDream: (): Promise<RuntimeState> =>
      ipcRenderer.invoke(Invoke.ResumeDream),
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
    ): Promise<DreamReport[]> =>
      ipcRenderer.invoke(
        Invoke.SetGoalDisposition,
        reportId,
        experimentId,
        disposition
      ),
    revertConfigUpdate: (
      reportId: string,
      findingId: string
    ): Promise<DreamReport[]> =>
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
    onReports: (cb: (reports: DreamReport[]) => void): Unsubscribe =>
      subscribe(Send.BroadcastReports, cb),
    onCloudSync: (cb: (status: CloudSyncStatus) => void): Unsubscribe =>
      subscribe(Send.BroadcastCloudSync, cb),
    onSelectReport: (cb: (id: string) => void): Unsubscribe =>
      subscribe(Send.SelectReport, cb),
  },
};

export type HarnessDreamsApi = typeof api;

contextBridge.exposeInMainWorld("hd", api);

declare global {
  interface Window {
    hd: HarnessDreamsApi;
  }
}
