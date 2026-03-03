import { createSplitStorage } from "./splitStorageCore";

export interface ElectronSplitStorageCallbacks<S> {
  /** Read credentials from safeStorage (via IPC) and merge into state. */
  restoreSecrets: (name: string, state: S) => Promise<S>;
  /** Write credentials to safeStorage (via IPC). */
  persistSecrets: (name: string, state: S) => Promise<void>;
  /** Return a copy of state with credentials stripped (safe for localStorage). */
  stripSecrets: (state: S) => S;
  /**
   * Delete all credential keys from safeStorage.
   * Receives the raw localStorage string so implementations can derive
   * dynamic keys (e.g. per-profile credential keys).
   */
  clearSecrets: (name: string, localRaw: string | null) => Promise<void>;
}

/**
 * Returns true when the renderer is running inside the Electron shell and the
 * IPC bridge is available.
 */
export function isElectronAvailable(): boolean {
  return typeof window !== "undefined" && window.electronAPI?.isElectron === true;
}

export function createElectronStorage<S>(callbacks: ElectronSplitStorageCallbacks<S>) {
  return createSplitStorage<S>(callbacks);
}
