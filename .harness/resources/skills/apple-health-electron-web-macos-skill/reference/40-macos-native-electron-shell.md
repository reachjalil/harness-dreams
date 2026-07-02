# macOS-Native Electron Shell

A macOS-native-feeling Electron app is mostly about respecting platform conventions, not about drawing fake Cocoa controls in HTML.

## Native-feeling priorities

1. Real traffic lights in the correct place.
2. Titlebar/toolbar layout that does not fight window dragging.
3. Native app menu with standard roles.
4. System dark/light/high-contrast adaptation.
5. Native file dialogs for import/export.
6. Keyboard shortcuts and context menus.
7. Dock badge/notification behavior that respects user attention.
8. Signed/notarized builds for release.

## BrowserWindow configuration

Recommended starting point:

```ts
const mainWindow = new BrowserWindow({
  width: 1280,
  height: 860,
  minWidth: 980,
  minHeight: 680,
  show: false,
  backgroundColor: '#f5f5f7',
  titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  trafficLightPosition: process.platform === 'darwin' ? { x: 18, y: 18 } : undefined,
  vibrancy: process.platform === 'darwin' ? 'sidebar' : undefined,
  visualEffectState: process.platform === 'darwin' ? 'followWindow' : undefined,
  webPreferences: {
    preload: preloadPath,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    webSecurity: true,
  },
});

mainWindow.once('ready-to-show', () => mainWindow.show());
```

Adapt colors and vibrancy carefully. Heavy transparency can hurt readability, performance, and accessibility. Use vibrancy most safely for sidebars/toolbar backgrounds, not dense metric content.

## Titlebar and draggable regions

When hiding the titlebar, define a top toolbar drag region and mark controls as no-drag.

```css
.app-toolbar {
  app-region: drag;
  height: 52px;
  display: flex;
  align-items: center;
  padding-left: var(--traffic-light-safe-left, 76px);
}

.app-toolbar button,
.app-toolbar input,
.app-toolbar [role='button'],
.app-toolbar .no-drag {
  app-region: no-drag;
}
```

Rules:

- Never put clickable controls inside a drag region unless they are explicitly `no-drag`.
- Leave safe space for traffic lights.
- Test double-click behavior, full screen, and resize on real macOS.
- On Windows/Linux, use default frame or a separate window-controls strategy.

## Sidebar + toolbar layout

A Health-style desktop app should feel like a modern Mac app:

```text
┌──────────────────────────────────────────────────────────────────┐
│ traffic lights  Toolbar: Summary  Search  Range  Import  Profile │
├───────────────┬──────────────────────────────────────────────────┤
│ Sidebar       │ Main content                                      │
│ Summary       │ Rings + metric cards + insights                   │
│ Favorites     │                                                  │
│ Browse        │                                                  │
│ Trends        │                                                  │
│ Awards        │                                                  │
│ Imports       │                                                  │
│ Settings      │                                                  │
└───────────────┴──────────────────────────────────────────────────┘
```

Use an inspector panel only when detail density is high.

## App menu

Use standard macOS roles where possible:

- App: About, Settings, Services, Hide, Quit
- File: Import Data, Export Data, Close Window
- Edit: Undo, Redo, Cut, Copy, Paste, Select All
- View: Toggle Sidebar, Toggle Inspector, Reload in development, Actual Size, Zoom
- Navigate: Summary, Browse, Trends, Awards, Search
- Window: Minimize, Zoom, Bring All to Front
- Help: Documentation, Privacy, Support

The app menu is part of native feel. Do not leave the default Electron menu in production.

## Settings window

Use a dedicated settings route or a separate BrowserWindow:

- General
- Data Sources
- Privacy
- Import/Export
- Notifications
- Appearance
- Advanced

On macOS, expose Settings through the app menu role and `Cmd+,`.

## Dock, tray, notifications

Use these sparingly for health/wellness apps.

Good uses:

- dock badge for unread insights or pending import errors;
- notification for completed import/export;
- notification for user-enabled goal reminders;
- tray/menu bar extra for compact daily progress only when product calls for it.

Avoid:

- nagging reminders;
- alarming health interpretations;
- notification spam;
- medical-sounding alerts without clinical review.

## Native dialogs

Use native file dialogs for:

- Import Apple Health export ZIP/XML;
- Import CSV/JSON;
- Export personal data;
- Save report;
- Choose local database location in advanced mode.

Keep file handling in main/worker. The renderer should receive structured results or safe file handles, not arbitrary path access unless explicitly needed and validated.

## Dark mode

Bridge Electron `nativeTheme` to CSS:

```ts
nativeTheme.on('updated', () => {
  mainWindow.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
});
```

Renderer CSS should also respect:

```css
@media (prefers-color-scheme: dark) { ... }
@media (prefers-contrast: more) { ... }
@media (prefers-reduced-motion: reduce) { ... }
```

## Native feel checklist

- App name appears correctly in menu and About panel.
- The default Electron menu is replaced.
- Traffic lights are native and correctly spaced.
- Toolbar is draggable but controls are not blocked.
- Sidebar uses appropriate selected, hover, and focus states.
- Dark mode follows system preference.
- Keyboard shortcuts match macOS expectations.
- Import/export uses native dialogs.
- Notifications only appear after permission/user intent.
- Release build is signed and notarized.
