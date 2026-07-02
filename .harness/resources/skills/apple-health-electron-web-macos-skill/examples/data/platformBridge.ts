export type PlatformKind = 'web' | 'electron-macos' | 'electron-windows' | 'electron-linux';

export interface PlatformCapabilities {
  kind: PlatformKind;
  canOpenNativeFileDialog: boolean;
  canSaveNativeFileDialog: boolean;
  canUseSecureStorage: boolean;
  canUseDockBadge: boolean;
  canUseTray: boolean;
  canUseNativeNotifications: boolean;
  canUseWindowControlsOverlay: boolean;
}

export interface PlatformBridge {
  capabilities(): Promise<PlatformCapabilities>;
  getTheme(): Promise<'light' | 'dark' | 'system'>;
  onThemeChanged(callback: (theme: 'light' | 'dark') => void): () => void;
  openExternal(url: string): Promise<void>;
  openHealthImportFile(): Promise<{ name?: string; path?: string; bytes?: Uint8Array } | null>;
  saveExportFile(file: { suggestedName: string; bytes: Uint8Array }): Promise<void>;
  setDockBadge(count: number): Promise<void>;
  notify(notification: { title: string; body: string; deepLink?: string }): Promise<void>;
  secureStore: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  };
}
