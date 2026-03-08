import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useAsyncAction } from "../../src/hooks/useAsyncAction";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useAsyncAction", () => {
  it("starts in idle state", () => {
    const { result } = renderHook(
      () =>
        useAsyncAction({
          actionFn: async () => {},
        }),
      { wrapper: createWrapper() },
    );
    expect(result.current.status).toBe("idle");
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("transitions to loading → idle on success", async () => {
    let resolve: () => void;
    const actionFn = vi.fn().mockImplementation(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useAsyncAction({ actionFn, onSuccess }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.execute();
    });

    // While the promise is unresolved, the hook should become pending
    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
      expect(result.current.status).toBe("loading");
    });

    // Resolve and verify it transitions to idle
    await act(async () => {
      resolve!();
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("transitions to loading → error on failure", async () => {
    const actionFn = vi.fn().mockRejectedValue(new Error("Connection refused"));
    const onError = vi.fn();

    const { result } = renderHook(() => useAsyncAction({ actionFn, onError }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.execute();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBe("Connection refused");
    expect(onError).toHaveBeenCalledOnce();
  });

  it("resets error state back to idle", async () => {
    const actionFn = vi.fn().mockRejectedValue(new Error("Boom"));

    const { result } = renderHook(() => useAsyncAction({ actionFn }), { wrapper: createWrapper() });

    act(() => {
      result.current.execute();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    act(() => {
      result.current.reset();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("idle");
    });
    expect(result.current.error).toBeNull();
  });

  it("can be re-executed after an error", async () => {
    let callCount = 0;
    const actionFn = vi.fn().mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) throw new Error("First failure");
    });

    const { result } = renderHook(() => useAsyncAction({ actionFn }), { wrapper: createWrapper() });

    // First call — fails
    act(() => {
      result.current.execute();
    });
    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    expect(result.current.error).toBe("First failure");

    // Second call — succeeds
    act(() => {
      result.current.execute();
    });
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
      expect(result.current.status).toBe("idle");
    });
    expect(result.current.error).toBeNull();
  });
});
