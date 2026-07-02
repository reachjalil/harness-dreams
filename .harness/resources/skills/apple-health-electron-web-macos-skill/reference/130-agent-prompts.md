# Agent Prompts

Use these prompts when asking an agent to implement parts of the skill.

## Architecture prompt

```text
Build a shared React + TypeScript architecture for an Apple Health-inspired dashboard that runs in Electron and web/PWA. Use a monorepo with apps/desktop, apps/web, packages/ui, packages/domain, packages/data, and packages/platform. The renderer must not depend directly on Electron APIs. Define a typed PlatformBridge with Electron and web implementations.
```

## macOS shell prompt

```text
Implement a macOS-native-feeling Electron shell. Use BrowserWindow with hiddenInset titlebar on macOS, real traffic lights, safe draggable toolbar regions, contextIsolation, sandbox, no nodeIntegration, nativeTheme bridge, native app menu roles, file import/export menu items, dock badge support, notification support, and no default Electron menu in production.
```

## Rings prompt

```text
Create an accessible SVG ActivityRings component for React DOM that supports arbitrary ring goals, overflow above 100%, reduced motion, dark mode track colors, keyboard focus, and screen-reader title/description. Do not copy Apple ring assets; use custom tokens.
```

## Badge engine prompt

```text
Create a rule-driven badge engine for a Health/Fitness-style app. Badges must be replayable from normalized daily facts. Include streaks, milestones, personal records, perfect weeks, monthly challenges, and recovery badges. Return progress, unlock reason, unlock date, and confidence.
```

## Recommendations prompt

```text
Implement a recommendation engine using observe -> compare -> explain -> recommend -> deep-link. Each insight must include metric IDs, current window, baseline window, delta, confidence, sample count, explanation, recommendation, and source provenance. Avoid medical diagnosis language.
```

## Import prompt

```text
Build an import pipeline for Apple Health export XML/ZIP, CSV, and JSON. The renderer must only request import through PlatformBridge. Electron should use native file dialogs and parse large files outside the renderer. Normalize records into MetricDefinition, Sample, and DataSource tables. Include duplicate detection, progress, cancellation, and source deletion.
```

## Security prompt

```text
Audit the Electron app against the official Electron security checklist. Verify contextIsolation, sandbox, nodeIntegration false, webSecurity true, restrictive CSP, no raw ipcRenderer exposure, sender validation for IPC, permission request handler, external URL validation, navigation/new-window blocking, safeStorage only for secrets, and signed/notarized release plan.
```

## PWA prompt

```text
Make the shared web app installable as a PWA with manifest, service worker, offline shell, update notification, and feature-gated browser platform bridge. Use file input and drag/drop fallbacks for imports. Do not assume direct Apple Health access in the browser.
```
