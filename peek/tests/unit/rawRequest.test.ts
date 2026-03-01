import { describe, it, expect, vi } from "vitest";

import { executeRawRequest, RAW_REQUEST_TIMEOUT_MS } from "../../src/services/es/rawRequest";
import type { DoFetch } from "../../src/services/es/rawRequest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = "https://my-cluster.es.io:9243";
const HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...init?.headers },
  });
}

function textResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, {
    ...init,
    headers: { "content-type": "text/plain", ...init?.headers },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("executeRawRequest", () => {
  it("normalizes path without a leading slash", async () => {
    const doFetch: DoFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 200 }));

    await executeRawRequest(doFetch, BASE_URL, HEADERS, "GET", "_cat/indices?v");

    const [url, , opts] = (doFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      Record<string, string>,
      RequestInit,
    ];
    expect(url).toBe(`${BASE_URL}/_cat/indices?v`);
    expect(opts.method).toBe("GET");
  });

  it("keeps path that already starts with /", async () => {
    const doFetch: DoFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 200 }));

    await executeRawRequest(doFetch, BASE_URL, HEADERS, "GET", "/_search");

    const [url] = (doFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe(`${BASE_URL}/_search`);
  });

  it("normalizes baseUrl with trailing slashes", async () => {
    const doFetch: DoFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 200 }));

    await executeRawRequest(doFetch, `${BASE_URL}///`, HEADERS, "GET", "/_search");

    const [url] = (doFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe(`${BASE_URL}/_search`);
  });

  it("sends request body only when provided and non-empty", async () => {
    const doFetch: DoFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ acknowledged: true }, { status: 200 }));

    await executeRawRequest(doFetch, BASE_URL, HEADERS, "POST", "/_bulk", '{"index":{}}');

    const [, , opts] = (doFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      Record<string, string>,
      RequestInit,
    ];
    expect(opts.body).toBe('{"index":{}}');
  });

  it("omits body when it is only whitespace", async () => {
    const doFetch: DoFetch = vi.fn().mockResolvedValueOnce(jsonResponse({}, { status: 200 }));

    await executeRawRequest(doFetch, BASE_URL, HEADERS, "GET", "/", "   ");

    const [, , opts] = (doFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      Record<string, string>,
      RequestInit,
    ];
    expect(opts.body).toBeUndefined();
  });

  it("parses JSON responses when content-type is application/json", async () => {
    const doFetch: DoFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ hits: { total: 1 } }, { status: 200 }));

    const result = await executeRawRequest(doFetch, BASE_URL, HEADERS, "GET", "/_search");
    expect(result).toEqual({ status: 200, body: { hits: { total: 1 } } });
  });

  it("parses JSON responses for +json media types", async () => {
    const doFetch: DoFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/vnd.elasticsearch+json" },
      }),
    );

    const result = await executeRawRequest(doFetch, BASE_URL, HEADERS, "GET", "/_search");
    expect(result).toEqual({ status: 200, body: { ok: true } });
  });

  it("parses plain-text responses when content-type is not JSON", async () => {
    const doFetch: DoFetch = vi
      .fn()
      .mockResolvedValueOnce(textResponse("green 1 1 0 0 0 0 0 0 -", { status: 200 }));

    const result = await executeRawRequest(doFetch, BASE_URL, HEADERS, "GET", "/_cat/health?v");
    expect(result).toEqual({ status: 200, body: "green 1 1 0 0 0 0 0 0 -" });
  });

  it("maps fetch failures to RawRequestError shape", async () => {
    const doFetch: DoFetch = vi.fn().mockRejectedValue(new TypeError("network down"));

    await expect(executeRawRequest(doFetch, BASE_URL, HEADERS, "GET", "/")).rejects.toEqual(
      expect.objectContaining({ status: 0, message: "network down" }),
    );
  });

  it("propagates external abort signal", async () => {
    const controller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    const doFetch: DoFetch = vi.fn((_url, _headers, opts) => {
      requestSignal = opts?.signal;
      return new Promise((_resolve, reject) => {
        if (requestSignal?.aborted) {
          reject(requestSignal.reason);
          return;
        }
        requestSignal?.addEventListener("abort", () => reject(requestSignal?.reason), {
          once: true,
        });
      });
    });

    const pending = executeRawRequest(
      doFetch,
      BASE_URL,
      HEADERS,
      "GET",
      "/",
      undefined,
      controller.signal,
    );
    controller.abort(new DOMException("aborted by caller", "AbortError"));

    await expect(pending).rejects.toEqual(
      expect.objectContaining({ status: 0, message: expect.stringContaining("aborted by caller") }),
    );
    expect(requestSignal?.aborted).toBe(true);
  });

  it("aborts request when timeout is reached", async () => {
    vi.useFakeTimers();
    try {
      let requestSignal: AbortSignal | undefined;
      const doFetch: DoFetch = vi.fn((_url, _headers, opts) => {
        requestSignal = opts?.signal;
        return new Promise((_resolve, reject) => {
          requestSignal?.addEventListener("abort", () => reject(requestSignal?.reason), {
            once: true,
          });
        });
      });

      const pending = executeRawRequest(doFetch, BASE_URL, HEADERS, "GET", "/");
      const assertion = expect(pending).rejects.toEqual(
        expect.objectContaining({
          status: 0,
          message: expect.stringContaining("Request timed out"),
        }),
      );
      await vi.advanceTimersByTimeAsync(RAW_REQUEST_TIMEOUT_MS + 1);
      await assertion;
      expect(requestSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("exports the timeout constant", () => {
    expect(RAW_REQUEST_TIMEOUT_MS).toBe(30_000);
  });
});
