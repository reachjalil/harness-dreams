# Web and PWA Compatibility

The web version is not an afterthought. It should be a first-class runtime with graceful feature detection.

## PWA goals

- Installable where supported.
- Offline shell and cached recent data.
- Same core UI as Electron.
- No Electron assumptions.
- Clear limitations around local file access, notifications, and Apple Health.

## Manifest baseline

```json
{
  "name": "Health Pattern Dashboard",
  "short_name": "Dashboard",
  "start_url": "/summary",
  "scope": "/",
  "display": "standalone",
  "background_color": "#f5f5f7",
  "theme_color": "#f5f5f7",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

For desktop PWAs that use custom titlebar areas, explore `display_override: ["window-controls-overlay"]` with robust fallback.

## Service worker

Use Vite PWA/Workbox for:

- app shell precache;
- stale-while-revalidate static assets;
- offline fallback route;
- update notification;
- cache cleanup.

Do not cache sensitive API responses blindly. Use explicit cache rules and respect logout/delete.

## Web bridge

Implement a browser version of `PlatformBridge`:

```ts
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
  // ...
};
```

Fallback hierarchy for imports:

1. File System Access API where available.
2. `<input type="file">` fallback.
3. Drag-and-drop file area.
4. Paste/upload JSON/CSV text.

## Responsive desktop/web layout

Use container queries and breakpoints:

| Width | Layout |
| ---: | --- |
| < 720px | mobile-style single column, bottom/compact nav optional |
| 720-980px | collapsible sidebar, 2-column cards |
| 980-1280px | sidebar + main dashboard grid |
| > 1280px | sidebar + main + optional inspector |

## Browser limitations

Browser/PWA cannot reliably provide:

- direct Apple Health access;
- full filesystem paths;
- always-available native menu bar;
- macOS dock menu;
- guaranteed notifications without permission/browser support;
- notarized desktop distribution;
- deep native OS integrations equivalent to Electron.

Use capability checks and explicit UI copy.

## PWA-native titlebar parity

For desktop installed PWAs, the Window Controls Overlay API can make web apps feel more app-like, but it is not the same as Electron BrowserWindow control. Use it only if:

- installed PWA target matters;
- controls are not obscured;
- CSS env variables are handled;
- fallback titlebar is acceptable.

## Offline behavior

Offline mode should support:

- viewing cached summary/history;
- creating manual logs locally;
- queueing sync operations;
- showing import history;
- exporting local data if possible;
- explaining stale data.

Offline mode should not:

- pretend remote sync succeeded;
- generate high-confidence new trends from incomplete data;
- hide source gaps.
