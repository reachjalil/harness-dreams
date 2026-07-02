# Sources

This source guide summarizes the best references to use when building the Electron/web/macOS version of the Apple Health-inspired skill.

## Official Electron references

- Electron security checklist — use for context isolation, sandboxing, CSP, permission handlers, IPC sender validation, and safe external links.
  - https://github.com/electron/electron/blob/main/docs/tutorial/security.md
- Electron context isolation — use for preload/renderer boundary design.
  - https://www.electronjs.org/docs/latest/tutorial/context-isolation
- Electron BrowserWindow — use for window behavior, ready-to-show, background color, and customization.
  - https://www.electronjs.org/docs/latest/api/browser-window
- Electron custom title bar — use for hidden titlebars, native controls, titleBarOverlay, and traffic-light/titlebar patterns.
  - https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
- Electron custom window interactions — use for draggable and no-drag regions.
  - https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions
- Electron Menu/Application Menu — use for native macOS app menu roles.
  - https://www.electronjs.org/docs/latest/api/menu
  - https://www.electronjs.org/docs/latest/tutorial/application-menu
- Electron nativeTheme/Dark Mode — use for system dark/light/high-contrast behavior.
  - https://www.electronjs.org/docs/latest/api/native-theme
  - https://www.electronjs.org/docs/latest/tutorial/dark-mode
- Electron Tray/Dock/Notifications/dialog/safeStorage — use for macOS-specific native affordances.
  - https://www.electronjs.org/docs/latest/tutorial/tray
  - https://www.electronjs.org/docs/latest/api/dock
  - https://www.electronjs.org/docs/latest/tutorial/notifications
  - https://www.electronjs.org/docs/latest/api/dialog
  - https://www.electronjs.org/docs/latest/api/safe-storage
- Electron signing and updates.
  - https://www.electronjs.org/docs/latest/tutorial/code-signing
  - https://www.electronjs.org/docs/latest/api/auto-updater

## Build and template references

- Electron Forge Vite + TypeScript template.
  - https://www.electronforge.io/templates/vite-%2B-typescript
- Electron Forge Vite plugin.
  - https://www.electronforge.io/config/plugins/vite
- electron-vite.
  - https://electron-vite.org/
- electron-vite React starter.
  - https://github.com/electron-vite/electron-vite-react
- Secure templates/defaults.
  - https://github.com/1Password/electron-secure-defaults
  - https://github.com/cawa-93/vite-electron-builder
  - https://github.com/reZach/secure-electron-template

## Apple and Health/Fitness references

- Apple Human Interface Guidelines.
  - https://developer.apple.com/design/human-interface-guidelines
- Designing for macOS.
  - https://developer.apple.com/design/human-interface-guidelines/designing-for-macos
- Sidebars, toolbars, color, typography, app icons.
  - https://developer.apple.com/design/human-interface-guidelines/sidebars
  - https://developer.apple.com/design/human-interface-guidelines/toolbars
  - https://developer.apple.com/design/human-interface-guidelines/color
  - https://developer.apple.com/design/human-interface-guidelines/typography
  - https://developer.apple.com/design/human-interface-guidelines/app-icons
- SF Symbols.
  - https://developer.apple.com/sf-symbols/
- Apple Health overview and support pages.
  - https://www.apple.com/health/
  - https://support.apple.com/guide/iphone/view-your-health-data-iphe3d379c32/ios
  - https://support.apple.com/guide/iphone/share-your-health-data-iph5ede58c3d/ios
  - https://www.apple.com/watch/close-your-rings/

## Open-source health/dashboard references

- MaximeHeckel Health Dashboard — personal web interface for HealthKit data using React, GraphQL, Go, and MongoDB.
  - https://github.com/MaximeHeckel/health-dashboard
- markwk Apple Health Web Dashboard — React web dashboard for daily Apple Health data.
  - https://github.com/markwk/apple-health-web-dashboard
- markwk Apple Health Sync Backend — Go backend for daily health sync and MongoDB storage.
  - https://github.com/markwk/apple-health-sync-backend
- Apple Health Parser — Python package for Apple Health export XML.
  - https://github.com/alxdrcirilo/apple-health-parser
- Apple Health export parser/converter.
  - https://github.com/mhrstmnn/Apple_Health_Export
- Health Auto Export Server — Node/Grafana web interface for Apple Health data.
  - https://github.com/HealthyApps/health-auto-export-server

## React/UI references

- React.
  - https://react.dev/
- Vite.
  - https://vite.dev/guide/
- React Aria.
  - https://react-aria.adobe.com/
- Base UI.
  - https://base-ui.com/
- Radix UI.
  - https://www.radix-ui.com/
- shadcn/ui.
  - https://ui.shadcn.com/docs
- Floating UI.
  - https://floating-ui.com/docs/getting-started
- Motion for React.
  - https://motion.dev/docs/react

## Visualization references

- Recharts.
  - https://recharts.org/
- visx.
  - https://github.com/airbnb/visx
- D3.
  - https://d3js.org/
- Observable Plot.
  - https://observablehq.com/plot/
- React activity rings.
  - https://github.com/JonasDoesThings/react-activity-rings
  - https://github.com/thecodehunter/react-activity-rings

## Storage/PWA/testing references

- Dexie.
  - https://dexie.org/docs
- PGlite.
  - https://pglite.dev/
- TanStack Query persistence/offline.
  - https://tanstack.com/query/latest
- MDN Progressive Web Apps.
  - https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps
- Web App Manifest.
  - https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest
- Window Controls Overlay.
  - https://developer.mozilla.org/en-US/docs/Web/API/Window_Controls_Overlay_API
- Workbox.
  - https://developer.chrome.com/docs/workbox
- Vite PWA.
  - https://vite-pwa-org.netlify.app/
- Playwright Electron.
  - https://playwright.dev/docs/api/class-electron
- Electron automated testing.
  - https://www.electronjs.org/docs/latest/tutorial/automated-testing
- Vitest.
  - https://vitest.dev/
- jest-axe.
  - https://github.com/NickColley/jest-axe
