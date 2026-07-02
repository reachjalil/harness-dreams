# Apple Health Electron + Web + macOS Skill

This package is a research-backed skill for building **Apple Health / Apple Fitness-inspired desktop and web experiences** with a shared React application, an Electron desktop shell, and a macOS-native interaction layer.

It adapts the React Native/iPhone/Apple Watch skill into a desktop/web architecture. The key shift is that the **Health-like product model** stays the same — rings, badges, recommendations, trends, favorites, detail pages, and privacy-first data flows — while the runtime changes to:

- a shared React + TypeScript renderer for Electron and browser/PWA;
- an Electron main/preload layer for native desktop APIs;
- a macOS shell layer for traffic lights, titlebar layout, app menu, dock, tray, notifications, secure storage, file import/export, and updater;
- a browser/PWA layer for installability, service workers, offline cache, and web-safe data adapters.

The package is intentionally framed as an **inspired product/design-system and architecture skill**, not a literal Apple clone. Use Apple's publicly documented design and product patterns as references, but do not copy Apple-owned assets, screenshots, private UI artwork, exact marketing language, proprietary icons, or imply Apple affiliation.

## Install into a skills library

```bash
unzip apple-health-electron-web-macos-skill.zip
cp -R apple-health-electron-web-macos-skill .skills/
```

## What is inside

- `SKILL.md` — routing metadata, workflow, quality gates, and reference map.
- `reference/` — detailed implementation docs for Electron architecture, macOS-native feel, web/PWA compatibility, rings, badges, insights, data, security, packaging, and testing.
- `examples/` — starter TypeScript/CSS patterns for Electron main/preload, menus, native bridge, PWA manifest, SVG rings, badge rules, recommendation logic, storage adapters, and tests.
- `research/source-catalog.json` — current source catalog with URLs and rationale.
- `research/repo-scorecard.csv` — curated reference comparison by aspect.
- `SOURCES.md` — human-readable source guide.
- `SKILL_REPORT.md` — packaging report and validation notes.

## Core architecture rule

Build one **shared React product surface** and wrap it differently per runtime:

```text
apps/web             -> browser + PWA
apps/desktop         -> Electron main/preload + same renderer
packages/ui          -> Health-style cards, rings, charts, badges, shell components
packages/domain      -> Metric, Sample, Goal, Ring, Badge, Trend, Recommendation
packages/data        -> adapters for IndexedDB, SQLite/PGlite, import/export, sync
packages/platform    -> web bridge and Electron bridge interfaces
```

The renderer should not know whether it is in Electron or the browser except through a typed `PlatformBridge`.

## Highest-value references

- Official Electron docs for security, context isolation, BrowserWindow, titlebars, menus, dark mode, tray, safeStorage, code signing, and auto-update.
- Electron Forge Vite + TypeScript template for official modern scaffolding.
- `electron-vite` and `electron-vite-react` for a fast Vite-oriented project structure.
- `1password/electron-secure-defaults` and secure Electron templates for security posture references.
- Apple Human Interface Guidelines for macOS sidebars, toolbars, color, typography, icons, and platform feel.
- React Aria, Base UI, Radix UI, Floating UI, and shadcn/ui for accessible React primitives and copy-owned component patterns.
- Motion, Recharts, visx, D3, and Observable Plot for animation and health-style visualization.
- Dexie, PGlite, TanStack Query persistence, and Electron safeStorage for local-first desktop/web data.
- `markwk/apple-health-web-dashboard`, `MaximeHeckel/health-dashboard`, and `JonasDoesThings/react-activity-rings` as open-source Apple Health/web/ring reference material.

## Read order

1. `reference/00-overview.md`
2. `reference/05-research-method.md`
3. `reference/10-open-source-reference-map.md`
4. `reference/20-apple-health-product-patterns.md`
5. `reference/30-electron-web-architecture.md`
6. `reference/40-macos-native-electron-shell.md`
7. `reference/50-design-system-and-tokens.md`
8. `reference/60-rings-badges-web-implementation.md`
9. `reference/70-recommendations-and-insights-engine.md`
10. `reference/80-data-storage-sync-and-import.md`
11. `reference/90-web-pwa-compatibility.md`
12. `reference/100-security-privacy-compliance.md`
13. `reference/110-packaging-updates-distribution.md`
14. `reference/120-testing-quality-checklist.md`
15. `reference/130-agent-prompts.md`
