// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

import { fetchCapabilitiesForConnection } from "../../src/services/es";
import { useSessionResume } from "../../src/hooks/useSessionResume";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

vi.mock("../../src/services/es", () => ({
  fetchCapabilitiesForConnection: vi.fn(),
  isElasticsearchError: (err: unknown): err is { message: string } =>
    typeof err === "object" && err !== null && "message" in err,
}));

const mockFetch = vi.mocked(fetchCapabilitiesForConnection);

const CAPS = {
  canManageDataStreams: true,
  canReadSecurityUsers: false,
  canReadSecurityRoles: false,
};

const CONN = { url: "https://es.example.com:9200", apiKey: "test-key" };
const MANUAL_CONN = { url: "https://manual.example.com:9200", apiKey: "manual-key" };
const PROXY_CONN = {
  url: "https://es.example.com:9200",
  apiKey: "test-key",
  proxyUrl: "https://proxy.example.com",
};
const MANUAL_CAPS = {
  canManageDataStreams: false,
  canReadSecurityUsers: true,
  canReadSecurityRoles: true,
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useSessionResume", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
    mockFetch.mockReset();
  });

  it("does nothing when no connection is persisted", () => {
    const { result } = renderHook(() => useSessionResume());

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.resumeError).toBeNull();
    expect(useConnectionStore.getState().connected).toBe(false);
  });

  it("does nothing when already connected", () => {
    useConnectionStore.setState({ connection: CONN, connected: true });

    renderHook(() => useSessionResume());

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sets connected and capabilities on successful resume", async () => {
    useConnectionStore.setState({ connection: CONN, connected: false });
    mockFetch.mockResolvedValue(CAPS);

    renderHook(() => useSessionResume());

    await waitFor(() => expect(useConnectionStore.getState().connected).toBe(true));
    expect(useConnectionStore.getState().capabilities).toEqual(CAPS);
  });

  it("does not apply stale capabilities after a manual reconnect", async () => {
    useConnectionStore.setState({ connection: CONN, connected: false });
    const deferred = createDeferred<typeof CAPS>();
    mockFetch.mockReturnValue(deferred.promise);

    renderHook(() => useSessionResume());

    useConnectionStore.setState({
      connection: MANUAL_CONN,
      connected: true,
      capabilities: MANUAL_CAPS,
    });

    deferred.resolve(CAPS);

    await waitFor(() => expect(useConnectionStore.getState().connection).toEqual(MANUAL_CONN));
    expect(useConnectionStore.getState().connected).toBe(true);
    expect(useConnectionStore.getState().capabilities).toEqual(MANUAL_CAPS);
  });

  it("does not apply stale capabilities when proxy settings change", async () => {
    useConnectionStore.setState({ connection: CONN, connected: false });
    const deferred = createDeferred<typeof CAPS>();
    mockFetch.mockReturnValue(deferred.promise);

    renderHook(() => useSessionResume());

    useConnectionStore.setState({ connection: PROXY_CONN, connected: false, capabilities: null });

    deferred.resolve(CAPS);

    await waitFor(() => expect(useConnectionStore.getState().connection).toEqual(PROXY_CONN));
    expect(useConnectionStore.getState().connected).toBe(false);
    expect(useConnectionStore.getState().capabilities).toBeNull();
  });

  it("surfaces resumeError on validation failure", async () => {
    useConnectionStore.setState({ connection: CONN, connected: false });
    mockFetch.mockRejectedValue({ message: "Connection refused" });

    const { result } = renderHook(() => useSessionResume());

    await waitFor(() => expect(result.current.resumeError).toBe("Connection refused"));
    expect(useConnectionStore.getState().connected).toBe(false);
  });

  it("clearResumeError clears the error", async () => {
    useConnectionStore.setState({ connection: CONN, connected: false });
    mockFetch.mockRejectedValue({ message: "Timeout" });

    const { result } = renderHook(() => useSessionResume());

    await waitFor(() => expect(result.current.resumeError).toBe("Timeout"));

    act(() => {
      result.current.clearResumeError();
    });

    expect(result.current.resumeError).toBeNull();
  });
});
