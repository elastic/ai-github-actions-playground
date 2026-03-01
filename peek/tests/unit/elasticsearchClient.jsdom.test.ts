// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { ElasticsearchClient } from "../../src/services/es/client";
import type { ElasticsearchConnection } from "../../src/services/es/client";
import type { ElectronAPI, ESFetchRequest, ESFetchResponse } from "../../src/electron";

function makeElectronAPI(
  fetchESImpl: (req: ESFetchRequest) => Promise<ESFetchResponse>,
): ElectronAPI {
  return {
    isElectron: true,
    fetchES: fetchESImpl,
    storeCredential: vi.fn().mockResolvedValue(undefined),
    retrieveCredential: vi.fn().mockResolvedValue(""),
    deleteCredential: vi.fn().mockResolvedValue(undefined),
  };
}

const BASE_URL = "https://my-cluster.es.io:9243";

function makeClient(overrides: Partial<ElasticsearchConnection> = {}): ElasticsearchClient {
  return new ElasticsearchClient({ url: BASE_URL, ...overrides });
}

// ── Electron IPC transport ────────────────────────────────────────────────

describe("Electron IPC transport", () => {
  afterEach(() => {
    // Restore window.electronAPI after each test
    Object.defineProperty(window, "electronAPI", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it("routes _fetch through window.electronAPI.fetchES when isElectron is true", async () => {
    const fetchESSpy = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      body: JSON.stringify({ cluster_name: "electron-cluster" }),
      contentType: "application/json",
    } satisfies ESFetchResponse);

    Object.defineProperty(window, "electronAPI", {
      value: makeElectronAPI(fetchESSpy),
      writable: true,
      configurable: true,
    });

    const globalFetchSpy = vi.fn();
    vi.stubGlobal("fetch", globalFetchSpy);

    const client = makeClient();
    const result = await client.getClusterInfo();

    expect(result).toEqual({ cluster_name: "electron-cluster" });
    // Browser fetch must NOT have been called
    expect(globalFetchSpy).not.toHaveBeenCalled();
    // IPC fetchES must have been called with the correct URL
    expect(fetchESSpy).toHaveBeenCalledOnce();
    const [req] = fetchESSpy.mock.calls[0] as [ESFetchRequest];
    expect(req.url).toBe(`${BASE_URL}/`);
  });

  it("passes auth headers through the IPC request", async () => {
    const fetchESSpy = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      body: JSON.stringify({ cluster_name: "ok" }),
      contentType: "application/json",
    } satisfies ESFetchResponse);

    Object.defineProperty(window, "electronAPI", {
      value: makeElectronAPI(fetchESSpy),
      writable: true,
      configurable: true,
    });

    const client = makeClient({ apiKey: "test-key" });
    await client.getClusterInfo();

    const [req] = fetchESSpy.mock.calls[0] as [ESFetchRequest];
    expect(req.headers?.["Authorization"]).toBe("ApiKey test-key");
  });

  it("throws ElasticsearchError when IPC fetchES rejects", async () => {
    const fetchESSpy = vi.fn().mockRejectedValueOnce(new TypeError("IPC channel closed"));

    Object.defineProperty(window, "electronAPI", {
      value: makeElectronAPI(fetchESSpy),
      writable: true,
      configurable: true,
    });

    const client = makeClient();
    await expect(client.getClusterInfo()).rejects.toEqual(
      expect.objectContaining({ status: 0, message: "IPC channel closed" }),
    );
  });

  it("throws ElasticsearchError on non-OK IPC response", async () => {
    const fetchESSpy = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      body: JSON.stringify({ error: { reason: "missing authentication" } }),
      contentType: "application/json",
    } satisfies ESFetchResponse);

    Object.defineProperty(window, "electronAPI", {
      value: makeElectronAPI(fetchESSpy),
      writable: true,
      configurable: true,
    });

    const client = makeClient();
    await expect(client.getClusterInfo()).rejects.toEqual(
      expect.objectContaining({ status: 401, message: "missing authentication" }),
    );
  });

  it("routes rawRequest through IPC in Electron", async () => {
    const fetchESSpy = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      body: JSON.stringify({ hits: { total: 5 } }),
      contentType: "application/json; charset=utf-8",
    } satisfies ESFetchResponse);

    Object.defineProperty(window, "electronAPI", {
      value: makeElectronAPI(fetchESSpy),
      writable: true,
      configurable: true,
    });

    const globalFetchSpy = vi.fn();
    vi.stubGlobal("fetch", globalFetchSpy);

    const client = makeClient();
    const result = await client.rawRequest("GET", "/_search");

    expect(result).toEqual({ status: 200, body: { hits: { total: 5 } } });
    expect(globalFetchSpy).not.toHaveBeenCalled();
    expect(fetchESSpy).toHaveBeenCalledOnce();
  });
});
