import type { ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

import type { DataFetchResult } from "../types/query";

interface DataFetchAlertProps<T> {
  /** The result returned by a data-fetching hook. */
  result: DataFetchResult<T>;
  /** Optional callback wired to the "Retry" button. */
  onRetry?: () => void;
}

/**
 * Renders an error `<Alert>` when `result.status === "error"` and nothing
 * otherwise.  Use this for pages that manage their own loading / success
 * rendering but still want a standardised error banner.
 *
 * @example
 * ```tsx
 * const result = useTasks();
 * if (result.status === "error") return <DataFetchAlert result={result} onRetry={result.refresh} />;
 * ```
 */
export default function DataFetchAlert<T>({ result, onRetry }: DataFetchAlertProps<T>): ReactNode {
  if (result.status !== "error") return null;

  return (
    <Box sx={{ p: 2 }}>
      <Alert
        severity="error"
        action={
          onRetry ? (
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          ) : undefined
        }
      >
        {result.error}
      </Alert>
    </Box>
  );
}
