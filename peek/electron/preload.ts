import { contextBridge, ipcRenderer } from "electron";

import type { ESFetchRequest, ESFetchResponse } from "../src/ipcTypes.js";

/**
 * Expose a minimal, typed IPC bridge to the renderer process.
 *
 * contextIsolation ensures the renderer cannot access Node.js APIs directly —
 * only the surface deliberately exposed here is available.
 */
contextBridge.exposeInMainWorld("electronAPI", {
  /** Sentinel used by the renderer to detect the Electron environment. */
  isElectron: true as const,

  /**
   * Perform an HTTP request via the main process.
   * The main process uses Electron's `net` module which is not subject to
   * CORS restrictions, so any Elasticsearch URL can be reached directly.
   */
  fetchES: (req: ESFetchRequest): Promise<ESFetchResponse> =>
    ipcRenderer.invoke("es:fetch", req) as Promise<ESFetchResponse>,

  /**
   * Persist a credential value encrypted with the OS keychain (safeStorage).
   * Use this instead of sessionStorage so credentials survive app restarts.
   */
  storeCredential: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke("credentials:store", key, value) as Promise<void>,

  /** Retrieve a previously stored credential. Returns "" when not found. */
  retrieveCredential: (key: string): Promise<string> =>
    ipcRenderer.invoke("credentials:retrieve", key) as Promise<string>,

  /** Remove a stored credential. */
  deleteCredential: (key: string): Promise<void> =>
    ipcRenderer.invoke("credentials:delete", key) as Promise<void>,
});
