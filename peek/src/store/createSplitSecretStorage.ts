import { createSplitStorage } from "./splitStorageCore";

export interface SplitSecretStorageCallbacks<S> {
  /** Read secrets from sessionStorage and inject them into the restored state. */
  restoreSecrets: (name: string, state: S) => S;
  /** Write secrets from state into sessionStorage. */
  persistSecrets: (name: string, state: S) => void;
  /** Return a copy of state with secrets stripped (safe for localStorage). */
  stripSecrets: (state: S) => S;
  /**
   * Remove all secret-related keys from sessionStorage.
   * Receives the raw localStorage string (before removal) so implementations
   * can derive dynamic keys (e.g. per-profile credential keys).
   */
  clearSecrets: (name: string, localRaw: string | null) => void;
}

/**
 * Creates a Zustand persist storage adapter that keeps non-sensitive state in
 * localStorage while storing credentials exclusively in sessionStorage
 * (cleared when the browser session ends).
 *
 * @typeParam S - The persisted state type managed by the Zustand store slice.
 *
 * Store-specific credential handling is delegated to the provided callbacks,
 * keeping this helper free of domain knowledge.
 */
export function createSplitSecretStorage<S>(callbacks: SplitSecretStorageCallbacks<S>) {
  return createSplitStorage<S>(callbacks);
}
