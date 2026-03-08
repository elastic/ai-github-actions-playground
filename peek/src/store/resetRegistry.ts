/**
 * Registration-based reset composition.
 *
 * Stores self-register their reset handlers at import time so that adding or
 * changing a domain store never requires editing a centralised list.
 *
 * Usage:
 *   // in your store file
 *   registerResetter("myDomain", () => useMyStore.getState().reset());
 *
 *   // at reset time
 *   getRegisteredResetters().forEach(fn => fn());
 */

const registry = new Map<string, () => void>();

/** Register a named resetter.  Duplicate names overwrite silently (idempotent). */
export function registerResetter(name: string, fn: () => void): void {
  registry.set(name, fn);
}

/** Return all registered reset functions (order is insertion order). */
export function getRegisteredResetters(): ReadonlyArray<() => void> {
  return Array.from(registry.values());
}

/** Return all registered resetter names (useful for diagnostics / tests). */
export function getRegisteredResetterNames(): ReadonlyArray<string> {
  return Array.from(registry.keys());
}
