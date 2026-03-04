import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";

import DateRangePicker from "../DateRangePicker";
import { toDashboardTimeRange, toTraceTimeRange } from "../timePresets";

interface ServiceDashboardControlsProps {
  loading: boolean;
  timeFrom: string;
  timeTo: string;
  onReset: () => void;
  onTimeRangeChange: (from: string, to: string) => void;
}

export default function ServiceDashboardControls({
  loading,
  timeFrom,
  timeTo,
  onReset,
  onTimeRangeChange,
}: ServiceDashboardControlsProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
        <DateRangePicker
          value={toDashboardTimeRange({ from: timeFrom, to: timeTo })}
          onChange={(range) => {
            const traceRange = toTraceTimeRange(range);
            onTimeRangeChange(traceRange.from, traceRange.to);
          }}
        />
        <Button variant="text" size="small" onClick={onReset} disabled={loading}>
          Reset
        </Button>
      </Box>
    </Paper>
  );
}
