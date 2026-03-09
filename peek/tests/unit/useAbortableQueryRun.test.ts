// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useAbortableQueryRun } from "../../src/hooks/useAbortableQueryRun";

describe("useAbortableQueryRun", () => {
  it("calls onStart, onSuccess, and onSettled on a successful run", async () => {
    const onStart = vi.fn();
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onSettled = vi.fn();

    const { result } = renderHook(() => useAbortableQueryRun());

    await act(async () => {
      await result.current.run(() => Promise.resolve("data"), {
        onStart,
        onSuccess,
        onError,
        onSettled,
      });
    });

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith("data");
    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("calls onStart, onError, and onSettled on a failed run", async () => {
    const onStart = vi.fn();
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onSettled = vi.fn();
    const error = new Error("boom");

    const { result } = renderHook(() => useAbortableQueryRun());

    await act(async () => {
      await result.current.run(() => Promise.reject(error), {
        onStart,
        onSuccess,
        onError,
        onSettled,
      });
    });

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(error);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("cancels the previous request when run is called again", async () => {
    const { result } = renderHook(() => useAbortableQueryRun());

    const signals: AbortSignal[] = [];
    const firstOnSuccess = vi.fn();
    const secondOnSuccess = vi.fn();

    await act(async () => {
      // First run — will never resolve (simulates slow request)
      const first = result.current.run(
        (signal) => {
          signals.push(signal);
          return new Promise(() => {});
        },
        { onSuccess: firstOnSuccess },
      );

      // Second run — cancels the first and resolves immediately
      const second = result.current.run(
        (signal) => {
          signals.push(signal);
          return Promise.resolve("second");
        },
        { onSuccess: secondOnSuccess },
      );

      await second;
      // First promise never resolves, that's expected
      void first;
    });

    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    expect(firstOnSuccess).not.toHaveBeenCalled();
    expect(secondOnSuccess).toHaveBeenCalledWith("second");
  });

  it("suppresses callbacks when the request is aborted via cancel", async () => {
    const { result } = renderHook(() => useAbortableQueryRun());

    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onSettled = vi.fn();
    let capturedSignal: AbortSignal | undefined;

    await act(async () => {
      const promise = result.current.run(
        (signal) => {
          capturedSignal = signal;
          return new Promise((_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => reject(new DOMException("aborted", "AbortError")),
              {
                once: true,
              },
            );
          });
        },
        { onSuccess, onError, onSettled },
      );

      // Cancel before the promise settles
      result.current.cancel();

      // Await to let the catch/finally run
      await promise;
    });

    expect(capturedSignal!.aborted).toBe(true);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("cancel clears the controller reference", async () => {
    const { result } = renderHook(() => useAbortableQueryRun());

    // Calling cancel when no request is in flight should be safe
    act(() => {
      result.current.cancel();
    });

    // Subsequent run should work normally
    const onSuccess = vi.fn();
    await act(async () => {
      await result.current.run(() => Promise.resolve(42), { onSuccess });
    });

    expect(onSuccess).toHaveBeenCalledWith(42);
  });

  it("passes the AbortSignal to the async function", async () => {
    const { result } = renderHook(() => useAbortableQueryRun());

    let receivedSignal: AbortSignal | undefined;

    await act(async () => {
      await result.current.run((signal) => {
        receivedSignal = signal;
        return Promise.resolve("ok");
      });
    });

    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal!.aborted).toBe(false);
  });

  it("works without any callbacks provided", async () => {
    const { result } = renderHook(() => useAbortableQueryRun());

    // Should not throw when callbacks are omitted
    await act(async () => {
      await result.current.run(() => Promise.resolve("ok"));
    });

    await act(async () => {
      await result.current.run(() => Promise.reject(new Error("fail")));
    });
  });

  it("suppresses error callbacks from a superseded request that rejects late", async () => {
    const { result } = renderHook(() => useAbortableQueryRun());

    const firstOnError = vi.fn();
    const firstOnSettled = vi.fn();
    const secondOnSuccess = vi.fn();

    let rejectFirst!: (err: Error) => void;
    const firstPromise = new Promise<never>((_resolve, reject) => {
      rejectFirst = reject;
    });

    await act(async () => {
      // Start first request (will be superseded)
      const first = result.current.run(() => firstPromise, {
        onError: firstOnError,
        onSettled: firstOnSettled,
      });

      // Start second request — supersedes first
      await result.current.run(() => Promise.resolve("second"), {
        onSuccess: secondOnSuccess,
      });

      // First request rejects after being superseded
      rejectFirst(new Error("late error"));

      await first;
    });

    expect(firstOnError).not.toHaveBeenCalled();
    expect(firstOnSettled).not.toHaveBeenCalled();
    expect(secondOnSuccess).toHaveBeenCalledWith("second");
  });
});
