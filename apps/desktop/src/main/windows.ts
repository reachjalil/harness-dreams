import path from "node:path";
import { BrowserWindow, shell } from "electron";

/**
 * Window manager. Harness Health has a single visible surface — the React UI
 * (index.html) opened from the menu bar. Closing it hides rather than quits,
 * because this is a menu-bar app.
 *
 * Magic constants MAIN_WINDOW_VITE_* are injected by @electron-forge/plugin-vite.
 */

const PRELOAD = path.join(__dirname, "preload.js");
const DEFAULT_WIDTH = 1180;
const DEFAULT_HEIGHT = 820;
const MIN_WIDTH = 980;
const MIN_HEIGHT = 620;

let mainWin: BrowserWindow | null = null;
let peerHostWin: BrowserWindow | null = null;
let quitting = false;

export function setQuitting(value: boolean): void {
  quitting = value;
}

function loadIndex(
  win: BrowserWindow,
  query: Record<string, string> = {}
): void {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    void win.loadURL(url.toString());
  } else {
    void win.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { query }
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
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    title: "Harness Health",
    // Edge-to-edge: no title bar; traffic lights float, inset into the glass
    // sidebar. The whole window is a single frosted surface.
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 19, y: 19 },
    // Native macOS "glass" — the sidebar material shows through translucent UI.
    vibrancy: "sidebar",
    visualEffectState: "active",
    backgroundColor: "#00000000",
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

export function getOrCreatePeerHost(): BrowserWindow {
  if (peerHostWin && !peerHostWin.isDestroyed()) return peerHostWin;
  peerHostWin = new BrowserWindow({
    width: 320,
    height: 240,
    show: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Harness Health Peer Host",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  harden(peerHostWin);
  loadIndex(peerHostWin, { peerHost: "1" });
  peerHostWin.on("closed", () => {
    peerHostWin = null;
  });
  return peerHostWin;
}

export function showMain(): void {
  const win = getOrCreateMain();
  win.setMinimumSize(MIN_WIDTH, MIN_HEIGHT);
  const [width, height] = win.getSize();
  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    win.setSize(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    win.center();
  }
  win.show();
  win.focus();
}

export function broadcastToUi(channel: string, payload?: unknown): void {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send(channel, payload);
  }
}

export function broadcastToPeerHost(channel: string, payload?: unknown): void {
  if (peerHostWin && !peerHostWin.isDestroyed()) {
    peerHostWin.webContents.send(channel, payload);
  }
}

export function closePeerHost(): void {
  if (peerHostWin && !peerHostWin.isDestroyed()) {
    peerHostWin.close();
  }
  peerHostWin = null;
}
