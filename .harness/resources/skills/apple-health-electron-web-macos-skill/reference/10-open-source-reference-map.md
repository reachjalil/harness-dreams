# Open Source Reference Map

Use this map to choose the best reference for each implementation aspect.

## Recommended stack by subsystem

| Subsystem | Primary reference | Why | Caution |
| --- | --- | --- | --- |
| Official Electron app scaffold | Electron Forge Vite + TypeScript | Official Electron tooling, packaging path, TypeScript defaults | Vite support has had experimental notes in Forge docs; check current release notes |
| Fast Vite-oriented Electron DX | `electron-vite` and `electron-vite-react` | Clean main/preload/renderer Vite model, React/TS examples | Community build tool; validate packaging/signing path |
| Secure Electron defaults | Electron security docs + `1password/electron-secure-defaults` | Best source for security checklist and concrete secure defaults | Do not cargo-cult; adapt to your app's window/protocol needs |
| Security template | `cawa-93/vite-electron-builder` or `reZach/secure-electron-template` | Security-minded templates with CSP/context isolation ideas | Check maintenance and update dependency versions before use |
| macOS native shell | Electron BrowserWindow, custom title bar, Menu, nativeTheme, Tray, Dock, dialog docs | Official API references for native-feeling desktop behavior | Hidden titlebars/draggable regions have edge cases; test on real macOS |
| Apple desktop design language | Apple HIG: macOS, sidebars, toolbars, color, typography, app icons, SF Symbols | Primary design guidance for Apple-platform feel | Do not copy Apple assets; follow principles and build your own brand |
| Apple Health product IA | Apple Health/Fitness public docs | Summary, trends, charts, activity rings, export/privacy patterns | Desktop adaptation should use sidebar/toolbar, not mobile tab bars |
| Apple Health web dashboard | `MaximeHeckel/health-dashboard`, `markwk/apple-health-web-dashboard` | Concrete examples of HealthKit data shown in a React web dashboard | Older architecture; do not use as modern Electron scaffold |
| Activity rings in React | `JonasDoesThings/react-activity-rings`, `thecodehunter/react-activity-rings` | SVG ring approaches and props | Build custom ring engine for production overflow/accessibility |
| Accessible React primitives | React Aria, Base UI, Radix UI | Advanced keyboard, focus, ARIA, form, popover, menu behavior | Style them yourself to avoid generic web-app feel |
| Copy-owned components | shadcn/ui | Code distribution approach: copy, own, adapt | Defaults are not macOS-native; retokenize heavily |
| Floating overlays | Floating UI | Popover/tooltip/menu positioning and collision handling | Pair with accessible trigger/focus behavior |
| Animation | Motion for React | Production-grade React/SVG/layout animation | Respect reduced motion; do not over-animate health data |
| Charts | Recharts for speed, visx/D3 for custom, Observable Plot for analysis | Covers simple dashboards through bespoke visualizations | Use semantic labels and accessible summaries for charts |
| Local browser DB | Dexie | IndexedDB wrapper with React patterns and offline-first use | Large imports need chunking/workers |
| Local analytical DB | PGlite | WASM Postgres usable in browser/Node-like environments | Validate bundle size, startup cost, and persistence needs |
| Query persistence | TanStack Query persistence | Offline cache and paused retry patterns | Cache is not the source of truth for sensitive records |
| PWA support | MDN PWA, Web Manifest, Workbox, Vite PWA | Installability, service worker, offline, manifest | Not all native APIs exist in browsers |
| Electron E2E testing | Playwright Electron support | Modern alternative after Spectron deprecation | Electron support is still described as experimental; keep smoke tests focused |
| Unit/component testing | Vitest, React Testing Library, axe/jest-axe | Vite-native tests and a11y regression checks | Automated a11y catches only part of real accessibility issues |

## Source roles

### Product references

Use Apple Health/Fitness docs and open-source health dashboards to understand:

- what appears on the Summary surface;
- how trends are explained;
- how activity rings summarize daily goal progress;
- how users export/import data;
- how detail pages move from overview to historical charts.

Do not copy exact screens. Convert patterns into abstractions.

### Desktop references

Use Electron/Apple docs to create a native-feeling shell:

- real traffic lights;
- app menu with standard roles;
- titlebar/toolbar integration;
- system dark mode;
- native dialogs;
- dock badges and notifications;
- code signing/notarization and updates.

### Web references

Use MDN/Workbox/Vite PWA to keep the same app usable outside Electron:

- manifest and installability;
- standalone window behavior;
- service-worker caching;
- offline storage;
- Window Controls Overlay where appropriate.

## Reference anti-patterns

Avoid these shortcuts:

- starting from an old CRA health dashboard and adding Electron around it without security review;
- using `nodeIntegration: true` to make imports easier;
- exposing `ipcRenderer` directly;
- building fake macOS traffic lights in HTML when native controls can remain;
- copying Apple badge art or Health iconography;
- using chart colors as the only status signal;
- treating PWA installability as equivalent to a notarized desktop app.
