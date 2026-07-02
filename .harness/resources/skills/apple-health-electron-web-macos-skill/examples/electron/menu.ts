import { app, BrowserWindow, Menu, shell } from 'electron';

export function buildApplicationMenu(getMainWindow: () => BrowserWindow | null) {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => getMainWindow()?.webContents.send('route:navigate', '/settings') },
            { type: 'separator' as const },
            { role: 'services' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const },
          ],
        }]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'Import Data…', accelerator: 'CmdOrCtrl+I', click: () => getMainWindow()?.webContents.send('command:import-data') },
        { label: 'Export Data…', accelerator: 'Shift+CmdOrCtrl+E', click: () => getMainWindow()?.webContents.send('command:export-data') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Summary', accelerator: 'CmdOrCtrl+1', click: () => getMainWindow()?.webContents.send('route:navigate', '/summary') },
        { label: 'Browse', accelerator: 'CmdOrCtrl+2', click: () => getMainWindow()?.webContents.send('route:navigate', '/browse') },
        { label: 'Trends', accelerator: 'CmdOrCtrl+3', click: () => getMainWindow()?.webContents.send('route:navigate', '/trends') },
        { label: 'Awards', accelerator: 'CmdOrCtrl+4', click: () => getMainWindow()?.webContents.send('route:navigate', '/awards') },
        { type: 'separator' },
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\', click: () => getMainWindow()?.webContents.send('view:toggle-sidebar') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : [])],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Privacy', click: () => getMainWindow()?.webContents.send('route:navigate', '/settings/privacy') },
        { label: 'Documentation', click: () => shell.openExternal('https://example.com/docs') },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
