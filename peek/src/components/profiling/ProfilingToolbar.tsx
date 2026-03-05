import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import DateRangePicker from "../DateRangePicker";
import { toDashboardTimeRange, toTraceTimeRange } from "../timePresets";
import { COMPONENT_HEIGHTS } from "../../types/tokens";

import type { ViewMode } from "./useProfilingData";

interface ProfilingToolbarProps {
  timeFrom: string;
  timeTo: string;
  onTimeChange: (from: string, to: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showOpenInQueryLab: boolean;
  onOpenInQueryLab: () => void;
  onAdvancedView: () => void;
}

export default function ProfilingToolbar({
  timeFrom,
  timeTo,
  onTimeChange,
  viewMode,
  onViewModeChange,
  showOpenInQueryLab,
  onOpenInQueryLab,
  onAdvancedView,
}: ProfilingToolbarProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 1 }}>
        <DateRangePicker
          value={toDashboardTimeRange({ from: timeFrom, to: timeTo })}
          onChange={(range) => {
            const traceRange = toTraceTimeRange(range);
            onTimeChange(traceRange.from, traceRange.to);
          }}
        />
        <Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
          {showOpenInQueryLab && (
            <Button
              size="small"
              variant="text"
              endIcon={<OpenInNewIcon fontSize="small" />}
              onClick={onOpenInQueryLab}
              sx={{ height: COMPONENT_HEIGHTS.input }}
            >
              Open in Query Lab
            </Button>
          )}
          <Button
            size="small"
            variant="text"
            onClick={onAdvancedView}
            sx={{ height: COMPONENT_HEIGHTS.input }}
          >
            Advanced view
          </Button>
        </Box>
      </Box>
      <Box
        role="group"
        aria-label="Profiling view modes"
        sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
      >
        {(["flamegraph", "topFunctions", "timeline", "flamescope", "stacktraces"] as const).map(
          (mode) => (
            <Chip
              key={mode}
              label={
                mode === "topFunctions"
                  ? "Top Functions"
                  : mode === "stacktraces"
                    ? "Stacktraces"
                    : mode === "timeline"
                      ? "Timeline"
                      : mode === "flamegraph"
                        ? "Flamegraph"
                        : "Flamescope"
              }
              size="small"
              variant={viewMode === mode ? "filled" : "outlined"}
              color={viewMode === mode ? "primary" : "default"}
              aria-pressed={viewMode === mode}
              onClick={() => onViewModeChange(mode)}
              sx={{ height: COMPONENT_HEIGHTS.input, cursor: "pointer" }}
            />
          ),
        )}
      </Box>
    </Paper>
  );
}
