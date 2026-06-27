import path from "node:path";

import { BrowserWindow, shell } from "electron";

/**
 * Window manager. Harness Dreams has a single visible surface — the React UI
 * (index.html) opened from the menu bar. Closing it hides rather than quits,
 * because this is a menu-bar app.
 *
 * Magic constants MAIN_WINDOW_VITE_* are injected by @electron-forge/plugin-vite.
 */

const PRELOAD = path.join(__dirname, "preload.js");

let mainWin: BrowserWindow | null = null;
let quitting = false;

export function setQuitting(value: boolean): void {
  quitting = value;
}

function loadIndex(win: BrowserWindow): void {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
}

/** Deny in-app navigation + popups; route external links to the OS browser. */
function harden(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url !== win.webContents.getURL()) {
      event.preventDefault();
      if (/^https?:/.test(url)) void shell.openExternal(url);
    }
  });
}

export function getOrCreateMain(): BrowserWindow {
  if (mainWin && !mainWin.isDestroyed()) return mainWin;
  mainWin = new BrowserWindow({
    width: 480,
    height: 720,
    show: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Harness Dreams",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0a0e1f",
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  harden(mainWin);
  loadIndex(mainWin);
  // Keep the app alive when the window is closed (menu-bar app).
  mainWin.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWin?.hide();
    }
  });
  return mainWin;
}

export function showMain(): void {
  const win = getOrCreateMain();
  win.show();
  win.focus();
}

export function broadcastToUi(channel: string, payload?: unknown): void {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send(channel, payload);
  }
}
