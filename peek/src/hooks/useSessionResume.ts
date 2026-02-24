import { useEffect, useState } from "react";

import { useConnectionStore } from "../store/useConnectionStore";
import { fetchCapabilitiesForConnection, isElasticsearchError } from "../services/es";
import type { ElasticsearchConnection } from "../services/es";

function isSameConnection(a: ElasticsearchConnection, b: ElasticsearchConnection): boolean {
  return (
    a.url === b.url &&
    (a.apiKey ?? "") === (b.apiKey ?? "") &&
    (a.username ?? "") === (b.username ?? "") &&
    (a.password ?? "") === (b.password ?? "") &&
    (a.proxyUrl ?? "") === (b.proxyUrl ?? "")
  );
}

/**
 * Attempts to resume the last-used connection on app startup.
 *
 * If the store has a persisted connection but `connected` is false (e.g. after
 * a page reload), this hook fires a single background validation request.  On
 * success it sets the store to the connected state; on failure it surfaces the
 * error string so the caller can present a one-click "Reconnect" affordance.
 */
export function useSessionResume() {
  const [resumeError, setResumeError] = useState<string | null>(null);

  useEffect(() => {
    // Read store state once at mount time (startup hydration).  We intentionally
    // use `getState()` — a point-in-time snapshot — rather than reactive
    // selectors so the effect never re-fires after the initial run.  The
    // `cancelled` flag handles React 18 Strict Mode double-invocation: the
    // cleanup from the first invocation cancels any in-flight request, and the
    // second invocation reads fresh state from the store.
    const { connection, connected } = useConnectionStore.getState();

    if (connected || !connection) return;

    let cancelled = false;

    fetchCapabilitiesForConnection(connection)
      .then((caps) => {
        if (cancelled) return;

        const latest = useConnectionStore.getState();
        if (
          latest.connected ||
          !latest.connection ||
          !isSameConnection(latest.connection, connection)
        ) {
          return;
        }

        latest.setConnected(true);
        latest.setCapabilities(caps);
      })
      .catch((err: unknown) => {
        if (cancelled) return;

        const latest = useConnectionStore.getState();
        if (
          latest.connected ||
          !latest.connection ||
          !isSameConnection(latest.connection, connection)
        ) {
          return;
        }

        const message = isElasticsearchError(err) ? err.message : String(err);
        setResumeError(message);
      });

    return () => {
      cancelled = true;
    };
  }, []); // run once on mount

  return { resumeError, clearResumeError: () => setResumeError(null) };
}
