# Overview

This skill translates Apple Health/Fitness-inspired product patterns into a **desktop and web** architecture.

The core idea is not to make a literal Apple Health clone. The goal is to help agents build a polished, privacy-aware, measurable-life dashboard with familiar Apple-like patterns:

- summary dashboard;
- favorites and pinned metrics;
- ring-based daily goals;
- badge, award, streak, and challenge systems;
- trend detection;
- recommendation/insight cards;
- drill-down metric detail pages;
- strong privacy and local-first data handling.

The Electron/web adaptation changes the platform assumptions:

| Mobile skill assumption | Electron/web adaptation |
| --- | --- |
| iPhone screen | resizable desktop window and browser viewport |
| tab bar | sidebar + toolbar + optional command palette |
| Apple Watch rings | larger desktop ring panels plus compact menu bar/dock summaries |
| HealthKit direct mobile permissions | import, mobile sync backend, or explicit user-provided files |
| React Native components | React DOM components using SVG/CSS/Canvas as needed |
| watchOS companion | optional menubar/tray/dock badge/notification companion patterns |
| native iOS navigation | macOS-style sidebar, toolbar, split view, settings window, app menu |

## Reference strategy

There is no single modern open-source Electron project that is a full Apple Health clone with perfect macOS-native polish. Use a **reference-per-subsystem** strategy:

- Apple Health product patterns: Apple public Health/Fitness docs and open-source web dashboards.
- Electron shell/security: official Electron docs and security-focused templates.
- Modern build tooling: Electron Forge Vite + TypeScript or electron-vite.
- macOS native feel: Apple HIG + Electron BrowserWindow/menu/nativeTheme/tray/dock/dialog APIs.
- UI primitives: React Aria, Base UI, Radix UI, Floating UI, and shadcn/ui.
- Charts/rings: SVG rings, Motion, Recharts, visx, D3, Observable Plot.
- Local-first data: Dexie, PGlite, TanStack Query persistence, SQLite where needed.

## Architecture target

```text
apps/
  desktop/                 Electron main + preload + packaged renderer
  web/                     Vite web/PWA app
packages/
  domain/                  Metric, Sample, Goal, Ring, Badge, Trend, Recommendation
  ui/                      Shared React UI components
  data/                    Storage, import, sync, adapters
  platform/                PlatformBridge contract and implementations
  design-tokens/           CSS variables, typography, colors, density, motion
```

## Runtime boundaries

The renderer is a web app. Treat it like untrusted UI code even when bundled locally:

- no raw filesystem access;
- no raw shell access;
- no raw `ipcRenderer` access;
- no direct Node.js integration;
- no external URL opening without validation;
- no Health/fitness data upload without explicit consent.

The Electron main process owns native capabilities. The preload exposes a narrow, typed API. The web app uses a web implementation of the same bridge.

## Definition of done

A project using this skill should produce:

1. A shared React dashboard that can run in a browser and inside Electron.
2. A macOS-polished Electron shell with native menus, window behavior, file dialogs, dark mode, notifications, and signing plan.
3. Ring, badge, insight, chart, import, export, and settings patterns reusable across domains.
4. Security and privacy controls appropriate for sensitive personal data.
5. A clear statement of which Apple patterns are inspired and which assets/claims are prohibited.
