/**
 * Type declarations for the Electron IPC bridge.
 *
 * `window.electronAPI` is only present when the React app is loaded inside the
 * Electron shell.  All renderer code that needs to branch on runtime should
 * check `window.electronAPI?.isElectron === true`.
 */

export interface ESFetchRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface ESFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  /** Raw response body as a UTF-8 string.  Parse as JSON when needed. */
  body: string;
  contentType: string;
}

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
