import type { ReactNode } from "react";
import LinearProgress from "@mui/material/LinearProgress";

import type { DataFetchResult } from "../types/query";

import ContentSkeleton from "./ContentSkeleton";
import DataFetchAlert from "./DataFetchAlert";

type ContentSkeletonVariant = "table" | "cards" | "chart" | "chart-cell" | "list" | "detail-panel";

interface DataBoundaryProps<T> {
  /** The result returned by a data-fetching hook. */
  result: DataFetchResult<T>;
  /** Rendered when status is `"success"`. Receives the unwrapped data. */
  children: (data: T) => ReactNode;
  /**
   * Rendered while loading.
   * Pass a `ContentSkeleton` variant string for a pre-built skeleton,
   * or a ReactNode for a fully custom fallback.
   * Defaults to `<LinearProgress />`.
   */
  loading?: ContentSkeletonVariant | ReactNode;
  /** Optional callback wired to the error state "Retry" button. */
  onRetry?: () => void;
  /** Rendered when status is `"idle"` (no connection / not yet triggered). */
  idle?: ReactNode;
}

/**
 * Declarative wrapper around `DataFetchResult<T>` that eliminates the
 * repetitive `if (loading) … if (error) … if (success) …` boilerplate
 * found in almost every page component.
 *
 * @example
 * ```tsx
 * const result = useIndices();
 * return (
 *   <DataBoundary result={result} loading="table" onRetry={result.refresh}>
 *     {(indices) => <IndexTable data={indices} />}
 *   </DataBoundary>
 * );
 * ```
 */
export default function DataBoundary<T>({
  result,
  children,
  loading,
  onRetry,
  idle = null,
}: DataBoundaryProps<T>): ReactNode {
  switch (result.status) {
    case "idle":
      return idle;

    case "loading":
      return renderLoading(loading);

    case "error":
      return <DataFetchAlert result={result} onRetry={onRetry} />;

    case "success":
      return children(result.data);
  }
}

function renderLoading(loading: DataBoundaryProps<unknown>["loading"]): ReactNode {
  if (loading === undefined || loading === null) {
    return <LinearProgress />;
  }
  if (typeof loading === "string") {
    return <ContentSkeleton variant={loading as ContentSkeletonVariant} />;
  }
  return loading;
}
