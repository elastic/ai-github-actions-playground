/**
 * Discriminated-union type for data-fetching hook results.
 *
 * Each page that fetches data should expose a hook returning this shape.
 * The component then switches on `status` to render loading, error, empty,
 * and success states — no impossible combinations possible.
 *
 * @example
 * ```ts
 * const result = useIngestPipelines();
 * switch (result.status) {
 *   case 'idle':    return null;
 *   case 'loading': return <Spinner />;
 *   case 'error':   return <Alert>{result.error}</Alert>;
 *   case 'success': return <List data={result.data} />;
 * }
 * ```
 */
export type DataFetchResult<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string };
