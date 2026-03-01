// ---------------------------------------------------------------------------
// Profiling types
// ---------------------------------------------------------------------------

export interface ProfilingTopFunctionsRequest {
  limit: number;
  query: {
    bool: {
      filter: Array<Record<string, unknown>>;
    };
  };
}
