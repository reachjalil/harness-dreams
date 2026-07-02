# Electron + Web Architecture

The goal is one product surface with two runtime shells: Electron desktop and browser/PWA.

## Preferred monorepo

```text
apps/
  desktop/
    src/main/             Electron main process
    src/preload/          typed bridge exposed to renderer
    src/renderer/         imports packages/ui app shell
    forge.config.ts       packaging, makers, signing hooks
  web/
    src/                  Vite web entry
    public/manifest.webmanifest
    vite.config.ts
packages/
  domain/
    metrics.ts
    samples.ts
    rings.ts
    badges.ts
    insights.ts
  data/
    HealthDataStore.ts
    DexieHealthStore.ts
    PGliteHealthStore.ts
    ImportPipeline.ts
  platform/
    PlatformBridge.ts
    webBridge.ts
    electronBridge.ts
  ui/
    shell/
    cards/
    rings/
    badges/
    charts/
    recommendations/
  design-tokens/
    tokens.css
```

## Process model

### Main process

Owns app lifecycle and native OS capabilities:

- create windows;
- app menu and dock/tray integration;
- file dialogs;
- notifications;
- secure storage;
- auto-update;
- protocol/deep link handling;
- import worker or utility process coordination.

### Preload process

Owns a narrow context-bridge API:

- validate arguments;
- expose typed functions;
- never expose raw `ipcRenderer`;
- never expose Node globals;
- keep event subscriptions scoped and removable.

### Renderer process

Runs React UI:

- no Node integration;
- no filesystem/shell assumptions;
- uses `PlatformBridge` and `DataStore` interfaces;
- can also run in browser with the web bridge.

## PlatformBridge contract

Use one contract for Electron and web.

```ts
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
  openHealthImportFile(): Promise<{ name: string; bytes: Uint8Array } | null>;
  saveExportFile(file: { suggestedName: string; bytes: Uint8Array }): Promise<void>;
  setDockBadge(count: number): Promise<void>;
  notify(notification: { title: string; body: string; deepLink?: string }): Promise<void>;
  secureStore: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  };
}
```

## Renderer routing

Recommended routing options:

- **TanStack Router** when you want strong type safety, URL search state, and data-loader contracts.
- **React Router** when the team already uses it and wants the mainstream ecosystem.

For Electron, keep routes browser-compatible so the same components can run in web/PWA.

```text
/summary
/browse
/browse/:categoryId
/metrics/:metricId
/awards
/trends
/imports
/settings/privacy
```

## Data flow

```text
Import source / sync source
        ↓
ImportPipeline validates source
        ↓
Normalizer maps source records to domain samples
        ↓
DataStore persists samples and provenance
        ↓
Selectors aggregate by day/week/month/year
        ↓
UI renders cards, rings, charts, badges, insights
```

## Runtime-specific data choices

| Need | Browser/PWA | Electron |
| --- | --- | --- |
| small local state | localStorage only for non-sensitive preferences | electron-store or small JSON via main process |
| app data | Dexie/IndexedDB | Dexie/IndexedDB or PGlite/SQLite |
| heavy local analytics | PGlite if acceptable | SQLite/PGlite in worker/utility process |
| secrets/tokens | WebCrypto + server/session constraints | Electron safeStorage via main/preload |
| large imports | web worker + chunking | utility process/worker + filesystem stream |

## Recommended scaffold path

### Option A: Official-first

Use Electron Forge Vite + TypeScript for the desktop app and a normal Vite React app for web. Good for teams prioritizing official packaging and signing paths.

### Option B: DX-first

Use electron-vite when you want a clean main/preload/renderer Vite configuration and fast dev experience. Good for teams comfortable owning packaging details.

### Option C: Existing web app wrapper

Use this only after hardening:

- remove Node access from renderer;
- implement preload bridge;
- add CSP;
- audit external links;
- add app menu and native file dialogs;
- add updater/signing plan.

## Pitfalls

- Do not put import parsers in the renderer if the file can be large.
- Do not let Electron-only APIs leak into shared UI packages.
- Do not model recommendations as UI strings only; they need data provenance.
- Do not use generic admin-dashboard UI as the product style. Health-like apps need calm, personal, readable hierarchy.
