import { useCallback } from "react";
import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import type { DataFetchResult } from "../types/query";

type AsyncActionStatus = DataFetchResult<void>["status"];

export interface AsyncActionState {
  /** Current status of the action. */
  status: AsyncActionStatus;
  /** `true` while the action is in flight. */
  isPending: boolean;
  /** Human-readable error message, or `null` when there is no error. */
  error: string | null;
  /** Trigger the action. */
  execute: () => void;
  /** Reset back to idle so the action can be retried. */
  reset: () => void;
}

/**
 * Standardises the `[isPending, error, execute]` tuple for one-shot async
 * actions such as "Test Connection", "Save", "Delete", etc.
 *
 * Built on top of React-Query's `useMutation` so callers get automatic
 * deduplication and the full mutation lifecycle for free.
 *
 * @example
 * ```tsx
 * const { isPending, error, execute } = useAsyncAction({
 *   actionFn: () => client.testConnection(),
 * });
 *
 * return (
 *   <>
 *     <Button onClick={execute} disabled={isPending}>
 *       {isPending ? "Testing…" : "Test Connection"}
 *     </Button>
 *     {error && <Alert severity="error">{error}</Alert>}
 *   </>
 * );
 * ```
 */
export function useAsyncAction<TResult = void>(options: {
  /** The async function to execute. */
  actionFn: () => Promise<TResult>;
  /** Called after a successful execution. */
  onSuccess?: (data: TResult) => void;
  /** Called after an error. */
  onError?: (error: Error) => void;
  /** Additional React-Query mutation options. */
  mutationOptions?: Omit<UseMutationOptions<TResult, Error, void>, "mutationFn">;
}): AsyncActionState {
  const mutation = useMutation<TResult, Error, void>({
    ...options.mutationOptions,
    mutationFn: options.actionFn,
    onSuccess: options.onSuccess,
    onError: options.onError,
  });

  const execute = useCallback(() => {
    mutation.mutate();
  }, [mutation.mutate]);

  const reset = useCallback(() => {
    mutation.reset();
  }, [mutation.reset]);

  let status: AsyncActionStatus = "idle";
  if (mutation.isPending) status = "loading";
  else if (mutation.isError) status = "error";
  else if (mutation.isSuccess) status = "idle";

  return {
    status,
    isPending: mutation.isPending,
    error: mutation.isError ? (mutation.error?.message ?? String(mutation.error)) : null,
    execute,
    reset,
  };
}
