import { useEffect, useRef, useState } from "react";

import { useConnectionStore } from "../store/useConnectionStore";
import { fetchCapabilitiesForConnection, isElasticsearchError } from "../services/es";
import type { ElasticsearchConnection } from "../services/es";

function isSameConnection(a: ElasticsearchConnection, b: ElasticsearchConnection): boolean {
  return (
    a.url === b.url &&
    (a.apiKey ?? "") === (b.apiKey ?? "") &&
    (a.otlpApiKey ?? "") === (b.otlpApiKey ?? "") &&
    (a.username ?? "") === (b.username ?? "") &&
    (a.password ?? "") === (b.password ?? "") &&
    (a.proxyUrl ?? "") === (b.proxyUrl ?? "") &&
    (a.otlpEndpoint ?? "") === (b.otlpEndpoint ?? "") &&
    (a.otlpEnabled ?? false) === (b.otlpEnabled ?? false) &&
    (a.otlpUseElasticAuth ?? true) === (b.otlpUseElasticAuth ?? true)
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
  const connection = useConnectionStore((s) => s.connection);
  const connected = useConnectionStore((s) => s.connected);
  const attemptedRef = useRef(false);

  useEffect(() => {
    // Skip if already connected, no connection available, or we already
    // attempted a resume.  The ref guard preserves the original "run at most
    // once" semantics while allowing the effect to re-run when async persist
    // hydration delivers the connection after the initial mount.
    if (connected) {
      attemptedRef.current = true;
      return;
    }
    if (!connection || attemptedRef.current) return;
    attemptedRef.current = true;

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
  }, [connection, connected]);

  return { resumeError, clearResumeError: () => setResumeError(null) };
}
