// ---------------------------------------------------------------------------
// Raw-request executor – extracted from ElasticsearchClient so that the
// API-console orchestration (timeout, abort propagation, body normalisation,
// response content-type parsing) lives in its own module.
// ---------------------------------------------------------------------------

/** Timeout applied to every raw request issued from the API console. */
export const RAW_REQUEST_TIMEOUT_MS = 30_000;

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
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
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
  try {
    const response = await doFetch(
      url,
      { ...headers },
      {
        method,
        body: rawBody,
        signal: controller.signal,
      },
    );
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    let responseBody: unknown;
    if (contentType.includes("application/json")) {
      responseBody = await response.json().catch(() => null);
    } else {
      const text = await response.text().catch(() => "");
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
