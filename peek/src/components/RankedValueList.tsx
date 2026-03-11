import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";

import type { RankedValueRow } from "../hooks/useRankedDimensionValues";

interface RankedValueListProps {
  rows: RankedValueRow[];
  /** Label appended after the count, e.g. "logs" or "samples". */
  metricLabel: string;
  /** Optional fixed maximum used to preserve scale when rendering filtered subsets. */
  maxMetric?: number;
  onSelect: (value: string) => void;
}

/**
 * Presentational list of ranked values with per-row proportional progress
 * bars. Shared between Logs and Profiling value pickers.
 */
export default function RankedValueList({
  rows,
  metricLabel,
  maxMetric: maxMetricProp,
  onSelect,
}: RankedValueListProps) {
  const maxMetric = maxMetricProp ?? rows[0]?.metric ?? 1;

  return (
    <List disablePadding>
      {rows.map((row) => (
        <ListItemButton
          key={row.value}
          onClick={() => onSelect(row.value)}
          sx={{ mb: 0.5, borderRadius: 1 }}
        >
          <ListItemText
            primary={row.value}
            secondary={
              <Box component="span" sx={{ display: "flex", gap: 1, alignItems: "center", mt: 0.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={(row.metric / maxMetric) * 100}
                  sx={{ flex: 1, height: 4, borderRadius: 2 }}
                />
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ whiteSpace: "nowrap" }}
                >
                  {row.metric.toLocaleString()} {metricLabel}
                </Typography>
              </Box>
            }
            slotProps={{ secondary: { component: "div" } }}
          />
        </ListItemButton>
      ))}
    </List>
  );
}
