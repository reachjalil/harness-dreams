import path from 'node:path';
import { app, BrowserWindow, ipcMain, nativeTheme, shell, dialog, Notification } from 'electron';
import { buildApplicationMenu } from './menu';

let mainWindow: BrowserWindow | null = null;

function createMainWindow() {
  const preloadPath = path.join(__dirname, '../preload/preload.js');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#101014' : '#f5f5f7',
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

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrlSafely(url).catch(console.error);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function assertTrustedSender(frame: Electron.WebFrameMain | null) {
  if (!frame || !mainWindow || frame.top !== mainWindow.webContents.mainFrame) {
    throw new Error('Untrusted IPC sender');
  }
}

function assertHttpsUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('Only HTTPS URLs can be opened externally');
  return url.toString();
}

async function openExternalUrlSafely(raw: string) {
  await shell.openExternal(assertHttpsUrl(raw));
}

function registerIpc() {
  ipcMain.handle('platform:capabilities', (event) => {
    assertTrustedSender(event.senderFrame);
    return {
      kind: process.platform === 'darwin' ? 'electron-macos' : process.platform === 'win32' ? 'electron-windows' : 'electron-linux',
      canOpenNativeFileDialog: true,
      canSaveNativeFileDialog: true,
      canUseSecureStorage: true,
      canUseDockBadge: process.platform === 'darwin',
      canUseTray: true,
      canUseNativeNotifications: true,
      canUseWindowControlsOverlay: false,
    };
  });

  ipcMain.handle('theme:get', (event) => {
    assertTrustedSender(event.senderFrame);
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });

  ipcMain.handle('external:open', async (event, rawUrl: string) => {
    assertTrustedSender(event.senderFrame);
    await openExternalUrlSafely(rawUrl);
  });

  ipcMain.handle('file:open-health-import', async (event) => {
    assertTrustedSender(event.senderFrame);
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Import Health Data',
      properties: ['openFile'],
      filters: [
        { name: 'Health exports', extensions: ['zip', 'xml', 'csv', 'json'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    // Production note: do not read huge files here. Return a file token or enqueue a worker import.
    return { path: result.filePaths[0] };
  });

  ipcMain.handle('dock:set-badge', (event, payload: { count: number }) => {
    assertTrustedSender(event.senderFrame);
    const count = Math.max(0, Math.min(999, Math.floor(Number(payload.count) || 0)));
    app.setBadgeCount(count);
  });

  ipcMain.handle('notification:show', (event, payload: { title: string; body: string }) => {
    assertTrustedSender(event.senderFrame);
    if (Notification.isSupported()) {
      new Notification({ title: payload.title, body: payload.body }).show();
    }
  });
}

app.whenReady().then(() => {
  registerIpc();
  buildApplicationMenu(() => mainWindow);
  createMainWindow();

  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
