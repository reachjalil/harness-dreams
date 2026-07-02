---
name: apple-health-electron-web-macos-skill
description: Use when building Apple Health/Fitness-inspired Electron and web dashboards with macOS-native feel. Do NOT use to copy Apple assets or bypass Electron security.
---

# Apple Health Electron + Web + macOS Skill

## When to Use

Use this skill when the user wants to build a polished desktop/web health, wellness, habit, productivity, learning, analytics, or quantified-self app that follows the **interaction patterns** of Apple Health, Apple Fitness, and Activity Rings while running as:

- an Electron desktop app;
- a web app or PWA;
- a shared React + TypeScript codebase used by both;
- a macOS-native-feeling Electron app with traffic lights, toolbar/titlebar integration, app menus, dark mode, keyboard shortcuts, native dialogs, notifications, dock behavior, and secure local storage.

Use it for:

- Health/Fitness-style desktop dashboards with cards, rings, highlights, trends, badges, and detail views.
- Cross-platform React UI systems that must feel at home in Electron and browser/PWA.
- Apple Health data import/export workflows from XML, CSV, JSON, or mobile sync backends.
- Local-first apps that store personal metrics on device.
- Domain-general ring systems for learning, focus, habits, recovery, productivity, finance, education, or operations.

Do **not** use this skill to:

- Copy Apple-owned artwork, Health icons, Fitness badges, screenshots, app layouts pixel-for-pixel, private animations, or proprietary wording.
- Claim Apple endorsement, Apple Health compatibility, or Apple platform affiliation unless the product actually qualifies.
- Expose Node.js, filesystem, shell, or Electron APIs directly to renderer code.
- Disable Electron security controls for convenience.
- Store or analyze sensitive health data without explicit consent, data minimization, export/delete support, and legal/privacy review.
- Treat a browser/PWA as equivalent to HealthKit access. Web apps do not directly read Apple Health; use explicit imports or a consented mobile sync path.

## Inputs

Collect as many of these as possible:

- Target product domain: health, wellness, productivity, learning, habits, recovery, coaching, analytics, or another measurable domain.
- Runtime targets: Electron macOS-only, Electron cross-platform, browser web, PWA, local-only, cloud-sync.
- Data sources: Apple Health export XML, CSV, JSON, user-created logs, backend sync, wearable APIs, HealthKit mobile bridge, synthetic data.
- Desktop features: native app menu, tray/menu bar extra, dock badge, file import/export, notifications, auto-updates, global shortcuts, native file dialogs, deep links.
- macOS fidelity target: minimal native chrome, fully integrated toolbar/titlebar, native sidebar feel, translucent surfaces, Settings window, keyboard-first navigation.
- Privacy constraints: local-only, encrypted tokens, cloud sync, HIPAA/GDPR/clinical review, user export/delete.
- UI constraints: Apple-like but brand-safe, dark mode, high contrast, keyboard navigation, reduced motion, localization.

## Outputs

Produce concrete implementation guidance:

- Architecture recommendation for shared React web/Electron renderer, Electron main/preload, and platform bridge.
- Reference map: best source/repo per subsystem and caution notes.
- Screen breakdown: desktop Summary, Browse/Library, metric detail, trends, awards, recommendations, import/export, settings, and web/PWA variants.
- macOS shell plan: BrowserWindow options, titlebar/traffic light strategy, app menu, tray/dock/notification behavior, native dialogs, updater, signing/notarization.
- Component plan: rings, metric cards, chart panels, badge grids, recommendation cards, sidebars, toolbars, command palette, search, empty states, disclosure panels.
- Data contracts: metric, sample, goal, ring, badge, trend, recommendation, import job, sync status, platform capabilities.
- Security checklist: context isolation, sandbox, typed IPC, CSP, protocol handlers, external URL validation, safeStorage, permissions, update trust.
- Implementation roadmap with milestones and quality gates.

## Workflow

1. **Keep product primitives independent of runtime.** Convert the domain into `Metric`, `Sample`, `Goal`, `Ring`, `Badge`, `Trend`, `Recommendation`, and `ImportJob` types. Put these in `packages/domain` so web and Electron share the same logic.

2. **Choose the desktop/web architecture.** Prefer a monorepo with `apps/desktop`, `apps/web`, `packages/ui`, `packages/domain`, `packages/data`, and `packages/platform`. Use Vite for the renderer. Use Electron Forge + Vite or electron-vite for desktop scaffolding.

3. **Build a typed platform bridge.** The renderer calls `window.platform.openFile()`, `window.platform.saveFile()`, `window.platform.getTheme()`, `window.platform.secureStore`, and `window.platform.notifications`. The browser implementation uses safe web APIs; the Electron implementation routes through preload and validated IPC.

4. **Design the macOS shell first.** Pick a titlebar strategy before drawing the UI. Use a hidden or hidden-inset titlebar with real traffic lights, safe draggable areas, native app menu roles, system color adaptation, and no custom fake macOS controls unless unavoidable.

5. **Adapt Health-style IA to desktop.** On desktop, prefer sidebar + toolbar + content split. Keep Summary/Favorites/Highlights/Trends as the home surface. Put Browse/Library in the sidebar. Put metric detail in the main pane with optional inspector/drilldown.

6. **Build a web-compatible design system.** Use CSS custom properties, semantic tokens, `system-ui` / `-apple-system`, accessible primitives, focus rings, reduced motion, high contrast, and container-aware responsive layouts.

7. **Implement rings and badges as domain-general components.** Use SVG for portable web/Electron rings unless performance requires Canvas/WebGL. Support overflow, reduced motion, readable labels, keyboard focus, and non-color status indicators.

8. **Implement recommendations as explainable insights.** Use observe → compare → explain → recommend → deep-link. Every insight must include the source metrics, comparison window, confidence, and a user-facing explanation.

9. **Pick a storage strategy by sensitivity and runtime.** Browser/PWA can use Dexie/IndexedDB or PGlite. Electron can use IndexedDB for shared renderer state, SQLite/PGlite for heavier local analytics, and `safeStorage` only for secrets/tokens. Large imports should run outside the renderer.

10. **Harden Electron.** Follow the Electron security checklist: no Node integration in renderer, context isolation, sandboxing, restrictive CSP, permission handlers, sender validation for IPC, safe external-link handling, and current Electron versions.

11. **Package like a real Mac app.** Plan app ID, code signing, notarization, auto-updates, entitlements, icons, app menu names, first-run UX, privacy copy, and import/export workflows before release.

12. **Validate web and desktop separately.** Run component tests, ring math tests, import parser tests, Playwright browser tests, Playwright Electron smoke tests, accessibility audits, dark/high-contrast/reduced-motion checks, and macOS notarized build checks.

## Quality Checklist

- The app feels native to macOS but does not copy Apple-owned assets or exact Health/Fitness screens.
- `SKILL.md` has frontmatter, `Use when`, and `Do NOT use` routing language.
- Every external repo/source has a stated purpose, confidence level, and caution.
- Electron renderer code does not receive raw `ipcRenderer`, Node.js, filesystem, or shell access.
- `contextIsolation`, `sandbox`, `webSecurity`, CSP, permission handlers, and IPC sender validation are part of the design.
- The same domain and UI components work in Electron and browser/PWA unless explicitly gated by `PlatformCapabilities`.
- macOS-specific polish includes native app menu roles, hidden/inset titlebar handling, safe draggable regions, native theme sync, file dialogs, notifications, and code signing/notarization planning.
- Rings support arbitrary metrics, overflow above 100%, reduced motion, keyboard focus, and text alternatives.
- Badges are rule-driven and replayable from history.
- Recommendations are explainable and traceable to data.
- Local data import/export is private by default and never silently uploads personal data.
- The web/PWA version remains installable/offline-capable where required without assuming Electron APIs.

## References

Read the reference pack in this order:

- `reference/00-overview.md`
- `reference/05-research-method.md`
- `reference/10-open-source-reference-map.md`
- `reference/20-apple-health-product-patterns.md`
- `reference/30-electron-web-architecture.md`
- `reference/40-macos-native-electron-shell.md`
- `reference/50-design-system-and-tokens.md`
- `reference/60-rings-badges-web-implementation.md`
- `reference/70-recommendations-and-insights-engine.md`
- `reference/80-data-storage-sync-and-import.md`
- `reference/90-web-pwa-compatibility.md`
- `reference/100-security-privacy-compliance.md`
- `reference/110-packaging-updates-distribution.md`
- `reference/120-testing-quality-checklist.md`
- `reference/130-agent-prompts.md`

Source catalog:

- `SOURCES.md`
- `research/source-catalog.json`
- `research/repo-scorecard.csv`
