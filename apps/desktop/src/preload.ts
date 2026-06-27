import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import { Invoke, Send } from "./shared/channels";
import type { ConfigPatch } from "./shared/schemas";
import type { AppConfig, DreamReport, RuntimeState } from "./shared/types";

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
    get: (): Promise<DreamReport> => ipcRenderer.invoke(Invoke.ReportGet),
  },
  actions: {
    dreamNow: (): Promise<RuntimeState> => ipcRenderer.invoke(Invoke.DreamNow),
    completeOnboarding: (): Promise<AppConfig> =>
      ipcRenderer.invoke(Invoke.CompleteOnboarding),
    markReviewed: (): Promise<RuntimeState> =>
      ipcRenderer.invoke(Invoke.MarkReviewed),
    setLaunchAtLogin: (value: boolean): Promise<AppConfig> =>
      ipcRenderer.invoke(Invoke.SetLaunchAtLogin, value),
    openMain: (): Promise<void> => ipcRenderer.invoke(Invoke.OpenMain),
    quit: (): Promise<void> => ipcRenderer.invoke(Invoke.Quit),
  },
  events: {
    onConfig: (cb: (config: AppConfig) => void): Unsubscribe =>
      subscribe(Send.BroadcastConfig, cb),
    onState: (cb: (state: RuntimeState) => void): Unsubscribe =>
      subscribe(Send.BroadcastState, cb),
  },
};

export type HarnessDreamsApi = typeof api;

contextBridge.exposeInMainWorld("hd", api);

declare global {
  interface Window {
    hd: HarnessDreamsApi;
  }
}
