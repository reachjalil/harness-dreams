import type { PlatformBridge } from '../data/platformBridge';

export const webBridge: PlatformBridge = {
  async capabilities() {
    return {
      kind: 'web',
      canOpenNativeFileDialog: 'showOpenFilePicker' in window,
      canSaveNativeFileDialog: 'showSaveFilePicker' in window,
      canUseSecureStorage: false,
      canUseDockBadge: 'setAppBadge' in navigator,
      canUseTray: false,
      canUseNativeNotifications: 'Notification' in window,
      canUseWindowControlsOverlay: 'windowControlsOverlay' in navigator,
    };
  },

  async getTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },

  onThemeChanged(callback) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => callback(media.matches ? 'dark' : 'light');
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  },

  async openExternal(url) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error('Only HTTPS links are allowed');
    window.open(parsed.toString(), '_blank', 'noopener,noreferrer');
  },

  async openHealthImportFile() {
    // Use a hidden input fallback. File System Access API can be added where supported.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,.xml,.csv,.json,application/json,text/csv,text/xml';
    const file = await new Promise<File | null>((resolve) => {
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.click();
    });
    if (!file) return null;
    return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
  },

  async saveExportFile({ suggestedName, bytes }) {
    const blob = new Blob([bytes]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
  },

  async setDockBadge(count) {
    const nav = navigator as Navigator & { setAppBadge?: (count: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (count > 0 && nav.setAppBadge) await nav.setAppBadge(count);
    if (count === 0 && nav.clearAppBadge) await nav.clearAppBadge();
  },

  async notify({ title, body }) {
    if (!('Notification' in window)) return;
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission === 'granted') new Notification(title, { body });
  },

  secureStore: {
    async get() { return null; },
    async set() { throw new Error('Secure storage is not available in the web bridge'); },
    async delete() { /* no-op */ },
  },
};
