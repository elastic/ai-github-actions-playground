import { useCallback, useRef } from "react";

/**
 * Typed callbacks invoked at each stage of the request lifecycle.
 * Every callback is guarded so it only fires when the request has not been
 * superseded by a newer `run` call or an explicit `cancel`.
 */
export interface AbortableQueryCallbacks<T> {
  /** Fires synchronously before the async function is invoked. */
  onStart?: () => void;
  /** Fires with the resolved value when the async function succeeds. */
  onSuccess?: (result: T) => void;
  /** Fires with the thrown error when the async function rejects. */
  onError?: (error: unknown) => void;
  /** Fires after either success or error (like `finally`). */
  onSettled?: () => void;
}

/**
 * Shared hook that encapsulates the "latest request wins" abort lifecycle.
 *
 * Calling `run` cancels any in-flight request, creates a fresh
 * `AbortController`, and invokes the provided async function.
 * Success/error/settled callbacks are guarded so they only fire when the
 * request has **not** been superseded.
 *
 * `cancel` aborts the current request without starting a new one.
 */
export function useAbortableQueryRun() {
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const run = useCallback(
    async <T>(
      fn: (signal: AbortSignal) => Promise<T>,
      callbacks?: AbortableQueryCallbacks<T>,
    ): Promise<void> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      callbacks?.onStart?.();

      try {
        const result = await fn(controller.signal);
        if (!controller.signal.aborted) {
          callbacks?.onSuccess?.(result);
        }
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          callbacks?.onError?.(err);
        }
      } finally {
        if (!controller.signal.aborted) {
          callbacks?.onSettled?.();
        }
      }
    },
    [],
  );

  return { run, cancel };
}
