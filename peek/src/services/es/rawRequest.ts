// ---------------------------------------------------------------------------
// Raw-request executor – extracted from ElasticsearchClient so that the
// API-console orchestration (timeout, abort propagation, body normalisation,
// response content-type parsing) lives in its own module.
// ---------------------------------------------------------------------------

/** Timeout applied to every raw request issued from the API console. */
export const RAW_REQUEST_TIMEOUT_MS = 30_000;

/** Back-off delays for automatic retries on transient (network / 5xx) failures. */
export const RETRY_DELAYS_MS: readonly number[] = [500, 1_000];

/** Function signature matching `ElasticsearchClient._doFetch`. */
export type DoFetch = (
  url: string,
  headers: Record<string, string>,
  options?: RequestInit & { signal?: AbortSignal },
) => Promise<Response>;

export interface RawRequestError {
  status: number;
  message: string;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/** Status codes that should trigger an automatic retry. */
const RETRY_STATUSES = new Set([429, 503, 504]);
const RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Adds a small amount of random jitter (±10%) to a delay to prevent multiple
 * clients from retrying at the exact same moment.
 */
function addJitter(ms: number): number {
  const jitter = ms * 0.1;
  return ms + (Math.random() * jitter * 2 - jitter);
}

/** Signal-aware delay that rejects immediately when the signal fires. */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  const jitteredMs = addJitter(ms);
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(id);
      reject(signal.reason);
    };
    const id = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, jitteredMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Execute an arbitrary HTTP request against an Elasticsearch cluster.
 *
 * This is the logic that backs the API-console feature.  It handles
 * timeout / abort propagation, body normalisation, and content-type–aware
 * response parsing.
 */
export async function executeRawRequest(
  doFetch: DoFetch,
  baseUrl: string,
  headers: Record<string, string>,
  method: string,
  path: string,
  body?: string,
  signal?: AbortSignal,
): Promise<{ status: number; body: unknown }> {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const trimmedPath = path.trim();
  const url = `${normalizedBaseUrl}${trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException("Request timed out", "AbortError"));
  }, RAW_REQUEST_TIMEOUT_MS);
  const onAbort = () => {
    controller.abort(signal?.reason);
  };
  if (signal?.aborted) {
    onAbort();
  } else {
    signal?.addEventListener("abort", onAbort, { once: true });
  }
  const rawBody = body && body.trim() ? body : undefined;
  const normalizedMethod = method.toUpperCase();
  const shouldRetryMethod = RETRYABLE_METHODS.has(normalizedMethod);
  try {
    let response: Response | undefined;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await doFetch(
          url,
          { ...headers },
          {
            method: normalizedMethod,
            body: rawBody,
            signal: controller.signal,
          },
        );

        const isRetryableStatus = RETRY_STATUSES.has(response.status) || response.status >= 500;
        if (!shouldRetryMethod || !isRetryableStatus || attempt >= RETRY_DELAYS_MS.length) {
          break;
        }
      } catch (err) {
        if (isAbortError(err) || !shouldRetryMethod || attempt >= RETRY_DELAYS_MS.length) {
          throw err;
        }
      }
      await delay(RETRY_DELAYS_MS[attempt] ?? 0, controller.signal);
    }
    if (!response) {
      throw new Error("No response received");
    }
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    let responseBody: unknown;
    if (contentType.includes("application/json") || contentType.includes("+json")) {
      responseBody = await response.json().catch((err: unknown) => {
        if (isAbortError(err)) {
          throw err;
        }
        return null;
      });
    } else {
      const text = await response.text().catch((err: unknown) => {
        if (isAbortError(err)) {
          throw err;
        }
        return "";
      });
      responseBody = text || null;
    }
    return { status: response.status, body: responseBody };
  } catch (err) {
    throw {
      status: 0,
      message: err instanceof Error ? err.message : String(err),
    } satisfies RawRequestError;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onAbort);
  }
}
