import type { ReactNode } from "react";
import Alert, { type AlertColor } from "@mui/material/Alert";
import type { SxProps, Theme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

import type { DataFetchResult } from "../types/query";

interface DataFetchAlertBaseProps {
  /** Alert severity level. Defaults to `"error"`. */
  severity?: AlertColor;
  /** Optional callback wired to the "Retry" button. */
  onRetry?: () => void;
  /** Optional callback wired to the Alert close button. */
  onDismiss?: () => void;
  /** Optional MUI `sx` overrides forwarded to the `<Alert>`. */
  sx?: SxProps<Theme>;
}

interface DataFetchAlertResultProps<T> extends DataFetchAlertBaseProps {
  /** The result returned by a data-fetching hook. */
  result: DataFetchResult<T>;
  error?: never;
}

interface DataFetchAlertErrorProps extends DataFetchAlertBaseProps {
  /** A plain error string. When falsy the component renders nothing. */
  error: string | null | undefined;
  result?: never;
}

type DataFetchAlertProps<T> = DataFetchAlertResultProps<T> | DataFetchAlertErrorProps;

/**
 * Canonical inline error `<Alert>` for data-fetching states.
 *
 * Accepts **either** a `DataFetchResult` via the `result` prop (renders only
 * when `status === "error"`) **or** a plain `error` string (renders only when
 * truthy).  All other statuses / falsy values render nothing.
 *
 * When using the `result` prop the alert is wrapped in a padded `<Box>` for
 * backward-compatible full-page error layouts.  The `error`-string form
 * renders a bare `<Alert>` suitable for inline placement.
 *
 * @example
 * ```tsx
 * // With a DataFetchResult
 * const result = useTasks();
 * if (result.status === "error") return <DataFetchAlert result={result} onRetry={result.refresh} />;
 *
 * // With a plain error string (inline)
 * const { error } = useFleetData();
 * <DataFetchAlert error={error} />
 * ```
 */
export default function DataFetchAlert<T>(props: DataFetchAlertProps<T>): ReactNode {
  const { severity = "error", onRetry, onDismiss, sx } = props;

  let errorMessage: string | undefined;
  let wrapped = false;

  if ("result" in props && props.result != null) {
    if (props.result.status !== "error") return null;
    errorMessage = props.result.error;
    wrapped = true;
  } else if ("error" in props) {
    if (!props.error) return null;
    errorMessage = props.error;
  } else {
    return null;
  }

  const alert = (
    <Alert
      severity={severity}
      sx={sx}
      onClose={onDismiss}
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    >
      {errorMessage}
    </Alert>
  );

  return wrapped ? <Box sx={{ p: 2 }}>{alert}</Box> : alert;
}
