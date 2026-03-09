import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";

import DateRangePicker from "../DateRangePicker";
import { toDashboardTimeRange, toTraceTimeRange } from "../timePresets";
import ToolbarRow from "../ToolbarRow";

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
      <ToolbarRow>
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
      </ToolbarRow>
    </Paper>
  );
}
