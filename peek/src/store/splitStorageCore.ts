import type { StorageValue } from "zustand/middleware";

export type MaybePromise<T> = T | Promise<T>;

export interface SplitStorageCallbacks<S> {
  /** Read secrets and merge them into the restored state. */
  restoreSecrets: (name: string, state: S) => MaybePromise<S>;
  /** Write secrets from state to the chosen secret store. */
  persistSecrets: (name: string, state: S) => MaybePromise<void>;
  /** Return a copy of state with secrets stripped (safe for localStorage). */
  stripSecrets: (state: S) => S;
  /**
   * Remove all secret-related keys from the secret store.
   * Receives the raw localStorage string so implementations can derive
   * dynamic keys (e.g. per-profile credential keys).
   */
  clearSecrets: (name: string, localRaw: string | null) => MaybePromise<void>;
}

/**
 * Generic split-storage adapter for Zustand's `persist` middleware.
 *
 * Non-sensitive state lives in localStorage while credentials are delegated
 * to the callbacks (sessionStorage, Electron safeStorage, etc.).
 *
 * Returns **async** storage methods, which Zustand's persist middleware
 * accepts via the `StateStorage` interface.
 */
export function createSplitStorage<S>(callbacks: SplitStorageCallbacks<S>) {
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
