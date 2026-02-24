import path from "path";
import { fileURLToPath } from "url";

import { app, BrowserWindow } from "electron";

import { registerIpcHandlers } from "./ipcHandlers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In development the vite-plugin-electron injects VITE_DEV_SERVER_URL.
const isDev = !app.isPackaged;

function createWindow(): void {
  const preloadPath = path.join(__dirname, "preload.js");

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "Elastic Peek",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: true,
    },
  });

  if (isDev) {
    // VITE_DEV_SERVER_URL is injected by vite-plugin-electron in dev mode
    const devUrl = process.env["VITE_DEV_SERVER_URL"] ?? "http://localhost:3000/";
    void win.loadURL(devUrl);
    win.webContents.openDevTools();
  } else {
    // In production, load the built renderer from dist/index.html.
    // The Vite build uses base: './' when ELECTRON=true so relative asset
    // paths resolve correctly under the file:// protocol.
    void win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    // macOS: re-open a window when the dock icon is clicked with no windows open
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // On macOS apps conventionally stay alive until the user explicitly quits
  if (process.platform !== "darwin") app.quit();
});
