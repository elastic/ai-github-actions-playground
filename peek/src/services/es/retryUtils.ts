// ---------------------------------------------------------------------------
// Shared retry / back-off utilities used by both ElasticsearchClient and
// the raw-request executor (API console).
// ---------------------------------------------------------------------------

/** HTTP status codes that should trigger an automatic retry. */
export const RETRY_STATUSES = new Set([429, 503, 504]);

/** Maximum number of retry attempts (used by ElasticsearchClient). */
export const MAX_RETRIES = 3;

/** Initial back-off delay in milliseconds (used by ElasticsearchClient). */
export const INITIAL_BACKOFF_MS = 500;

/** Fixed back-off delays for raw-request retries. */
export const RETRY_DELAYS_MS: readonly number[] = [500, 1_000];

/**
 * Adds a small amount of random jitter (±10 %) to a delay to prevent multiple
 * clients from retrying at the exact same moment.
 */
export function addJitter(ms: number): number {
  const jitter = ms * 0.1;
  return ms + (Math.random() * jitter * 2 - jitter);
}

/**
 * Signal-aware delay that rejects immediately when the signal fires.
 * Applies ±10 % jitter to the provided millisecond value.
 */
export function sleepWithJitter(ms: number, signal?: AbortSignal | null): Promise<void> {
  const jitteredMs = addJitter(ms);
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      // signal is guaranteed non-null here: onAbort is only registered when signal is truthy
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, jitteredMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
