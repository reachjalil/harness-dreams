import { contextBridge, ipcRenderer } from 'electron';
import type { PlatformBridge } from '../data/platformBridge';

const platform: PlatformBridge = {
  capabilities: () => ipcRenderer.invoke('platform:capabilities'),
  getTheme: () => ipcRenderer.invoke('theme:get'),
  onThemeChanged: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, theme: 'light' | 'dark') => callback(theme);
    ipcRenderer.on('theme:changed', handler);
    return () => ipcRenderer.off('theme:changed', handler);
  },
  openExternal: (url) => ipcRenderer.invoke('external:open', url),
  openHealthImportFile: () => ipcRenderer.invoke('file:open-health-import'),
  saveExportFile: (file) => ipcRenderer.invoke('file:save-export', file),
  setDockBadge: (count) => ipcRenderer.invoke('dock:set-badge', { count }),
  notify: (notification) => ipcRenderer.invoke('notification:show', notification),
  secureStore: {
    get: (key) => ipcRenderer.invoke('secure-store:get', { key }),
    set: (key, value) => ipcRenderer.invoke('secure-store:set', { key, value }),
    delete: (key) => ipcRenderer.invoke('secure-store:delete', { key }),
  },
};

contextBridge.exposeInMainWorld('platform', platform);

declare global {
  interface Window {
    platform: PlatformBridge;
  }
}
