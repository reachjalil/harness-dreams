# Research Method

Research date: 2026-06-29

The source pack was built from four categories of references.

## 1. Official platform documentation

Primary references were preferred when documenting platform behavior:

- Electron documentation for security, BrowserWindow, titlebars, custom window interactions, menus, nativeTheme, tray, dock, notifications, dialog, safeStorage, code signing, and auto-update.
- Electron Forge documentation for Vite + TypeScript scaffolding and macOS signing/notarization.
- Apple Human Interface Guidelines for macOS design principles, sidebars, toolbars, color, typography, app icons, and SF Symbols.
- MDN, W3C, Workbox, and Vite PWA docs for browser/PWA behavior.
- Apple Health/Fitness public docs for product patterns, trends, exports, and activity rings.

## 2. Open-source implementation references

Open-source repos were selected only if they helped with a concrete subsystem:

- Apple Health web dashboard references: `MaximeHeckel/health-dashboard`, `markwk/apple-health-web-dashboard`, `markwk/apple-health-sync-backend`.
- React activity rings: `JonasDoesThings/react-activity-rings`, `thecodehunter/react-activity-rings`.
- Electron + Vite templates: `electron-vite/electron-vite-react`, `alex8088/electron-vite-boilerplate`, official Electron Forge Vite templates.
- Security references: `1password/electron-secure-defaults`, `cawa-93/vite-electron-builder`, `reZach/secure-electron-template`.
- UI primitives: React Aria, Base UI, Radix UI, Floating UI, shadcn/ui.
- Charts: Recharts, visx, D3, Observable Plot.
- Storage: Dexie, PGlite, TanStack Query persistence.

## 3. Best-reference-per-aspect scoring

Each source was scored on:

- relevance to Electron/web/macOS native feel;
- modernity and maintainability;
- source authority;
- implementation specificity;
- security posture;
- usefulness for agent-guided rebuilding.

The result is intentionally not a single repo recommendation. Health-style desktop apps require multiple references.

## 4. Known limitations

- Some Apple HIG pages are JavaScript-rendered. Use the Apple Developer pages as primary design references, but verify current wording in a browser when preparing production-facing guidance.
- Open-source health dashboards are useful for data flow and visual structure but are often older than current React/Electron practice. Treat them as reference material, not scaffolds.
- Browser/PWA apps cannot directly access Apple Health. Use Apple Health export XML, user-provided CSV/JSON, a mobile HealthKit bridge, or a consented backend.
- Electron APIs evolve quickly. Confirm versions and API behavior before implementation.
