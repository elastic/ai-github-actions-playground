/**
 * Type declarations for the Electron IPC bridge.
 *
 * `window.electronAPI` is only present when the React app is loaded inside the
 * Electron shell.  All renderer code that needs to branch on runtime should
 * check `window.electronAPI?.isElectron === true`.
 */

export type { ESFetchRequest, ESFetchResponse } from "../electron/ipcTypes";

export interface ElectronAPI {
  readonly isElectron: true;
  /** Route an HTTP request through the main process (no CORS). */
  fetchES: (req: ESFetchRequest) => Promise<ESFetchResponse>;
  /** Persist a credential value encrypted with the OS keychain. */
  storeCredential: (key: string, value: string) => Promise<void>;
  /** Retrieve a previously stored credential; returns "" when not found. */
  retrieveCredential: (key: string) => Promise<string>;
  /** Remove a stored credential. */
  deleteCredential: (key: string) => Promise<void>;
}

declare global {
  interface Window {
    /** Present only when running inside the Electron shell. */
    electronAPI?: ElectronAPI;
  }
}
