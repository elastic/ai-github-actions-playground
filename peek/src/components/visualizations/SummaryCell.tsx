import { useEffect, useRef } from "react";
import Skeleton from "@mui/material/Skeleton";
import TableCell from "@mui/material/TableCell";
import Typography from "@mui/material/Typography";

import type { RowSummaryEntry } from "../../hooks/useRowSummaries";

/** Cell that registers with IntersectionObserver and displays the row summary. */
export default function SummaryCell({
  rowIdx,
  entry,
  observeRow,
  unobserveRow,
}: {
  rowIdx: number;
  entry: RowSummaryEntry | undefined;
  observeRow?: (index: number, element: Element | null) => void;
  unobserveRow?: (index: number) => void;
}) {
  const cellRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    const el = cellRef.current;
    if (el && observeRow) {
      observeRow(rowIdx, el);
    }
    return () => {
      if (unobserveRow) unobserveRow(rowIdx);
    };
  }, [rowIdx, observeRow, unobserveRow]);

  return (
    <TableCell
      ref={cellRef}
      sx={{
        minWidth: 200,
        maxWidth: 360,
        fontSize: "0.75rem",
        color: "text.secondary",
        whiteSpace: "normal",
        wordBreak: "break-word",
      }}
    >
      {entry?.loading ? (
        <Skeleton variant="text" width="80%" />
      ) : entry?.error ? (
        <Typography
          component="span"
          variant="caption"
          role="status"
          aria-live="polite"
          aria-label="Summary unavailable"
          sx={{ opacity: 0.4 }}
        >
          —
        </Typography>
      ) : entry?.summary ? (
        entry.summary
      ) : (
        <Typography
          component="span"
          variant="caption"
          role="status"
          aria-live="polite"
          aria-label="No summary available"
          sx={{ opacity: 0.3 }}
        >
          …
        </Typography>
      )}
    </TableCell>
  );
}
