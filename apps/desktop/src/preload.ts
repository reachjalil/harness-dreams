import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import { Invoke, Send } from "./shared/channels";
import type { ConfigPatch } from "./shared/schemas";
import type {
  AppConfig,
  AnalysisProject,
  DiscoveredProject,
  DreamReport,
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
  projects: {
    discover: (): Promise<DiscoveredProject[]> =>
      ipcRenderer.invoke(Invoke.DiscoverProjects),
    add: (projectPath: string): Promise<AnalysisProject | null> =>
      ipcRenderer.invoke(Invoke.AddProject, projectPath),
  },
  actions: {
    dreamNow: (): Promise<RuntimeState> => ipcRenderer.invoke(Invoke.DreamNow),
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
