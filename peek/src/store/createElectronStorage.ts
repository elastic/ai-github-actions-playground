import type { StorageValue } from "zustand/middleware";

/**
 * Async Zustand storage adapter for the Electron shell.
 *
 * Replaces sessionStorage with Electron's safeStorage (OS keychain) for
 * credential persistence.  Non-sensitive state still lives in localStorage.
 *
 * Compatible with Zustand's `persist` middleware which accepts async
 * `getItem`/`setItem`/`removeItem` via the `StateStorage` interface.
 */

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
  const { restoreSecrets, persistSecrets, stripSecrets, clearSecrets } = callbacks;

  return {
    getItem: async (name: string): Promise<StorageValue<S> | null> => {
      const localRaw = localStorage.getItem(name);
      if (!localRaw) return null;
      try {
        const stored = JSON.parse(localRaw) as StorageValue<S>;
        if (!stored || !stored.state) return null;
        stored.state = await restoreSecrets(name, stored.state);
        return stored;
      } catch {
        return null;
      }
    },

    setItem: async (name: string, value: StorageValue<S>): Promise<void> => {
      await persistSecrets(name, value.state);
      const toStore: StorageValue<S> = { ...value, state: stripSecrets(value.state) };
      localStorage.setItem(name, JSON.stringify(toStore));
    },

    removeItem: async (name: string): Promise<void> => {
      await clearSecrets(name, localStorage.getItem(name));
      localStorage.removeItem(name);
    },
  };
}
