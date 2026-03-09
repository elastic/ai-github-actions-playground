import { useCallback, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";
import Button from "@mui/material/Button";

import ContentSkeleton from "../ContentSkeleton";
import EmptyState from "../EmptyState";
import RankedValueList from "../RankedValueList";
import DateRangePicker from "../DateRangePicker";
import { toDashboardTimeRange, toTraceTimeRange } from "../timePresets";
import type { ElasticsearchConnection } from "../../services/es";
import { useRankedDimensionValues } from "../../hooks/useRankedDimensionValues";

import {
  buildDistinctValuesQuery,
  PROFILING_DIMENSION_LABELS,
  type ProfilingFocusDimension,
} from "./profilingQueryBuilder";
import { isMissingProfilingIndex } from "./profilingUtils";

interface ProfilingValuePickerProps {
  dimension: ProfilingFocusDimension;
  connection: ElasticsearchConnection;
  timeFrom: string;
  timeTo: string;
  onTimeRangeChange?: (from: string, to: string) => void;
  onSelect: (value: string) => void;
  onBack: () => void;
}

export default function ProfilingValuePicker({
  dimension,
  connection,
  timeFrom,
  timeTo,
  onTimeRangeChange,
  onSelect,
  onBack,
}: ProfilingValuePickerProps) {
  const [search, setSearch] = useState("");

  const buildQuery = useCallback(
    () => buildDistinctValuesQuery(dimension, timeFrom, timeTo),
    [dimension, timeFrom, timeTo],
  );

  const { rows, loading, error } = useRankedDimensionValues({
    connection,
    buildQuery,
    dimensionColumn: dimension,
    metricColumn: "samples",
    deps: [buildQuery],
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? rows.filter((r) => r.value.toLowerCase().includes(term)) : rows;
  }, [rows, search]);

  const dimensionLabel = PROFILING_DIMENSION_LABELS[dimension];
  const noData = rows.length === 0;
  const emptyHeading = noData
    ? `No ${dimensionLabel.toLowerCase()} data found`
    : `No results match "${search}"`;
  const emptyDescription = noData
    ? dimension === "service.name"
      ? "No service labels were found in profiling samples for the current time range. Try Process focus, expand the time range, or ensure service.name is attached to profiling data."
      : dimension === "host.name"
        ? "No host labels were found in profiling samples for the current time range. Try Process focus, expand the time range, or ensure host.name is attached to profiling data."
        : "No profiling samples found for the current time range."
    : undefined;

  const missingIndex = error ? isMissingProfilingIndex(error) : false;

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 2 }}>
        <Button
          size="small"
          variant="text"
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{ mr: 1 }}
        >
          Back
        </Button>
        <Box>
          <Typography variant="h6">Pick a {dimensionLabel.toLowerCase()}</Typography>
          <Typography variant="body2" color="text.secondary">
            Ranked by profiling activity in the current time range
          </Typography>
        </Box>
      </Box>

      {onTimeRangeChange && (
        <Box sx={{ mb: 2 }}>
          <DateRangePicker
            value={toDashboardTimeRange({ from: timeFrom, to: timeTo })}
            onChange={(range) => {
              const traceRange = toTraceTimeRange(range);
              onTimeRangeChange(traceRange.from, traceRange.to);
            }}
          />
        </Box>
      )}

      <TextField
        placeholder={`Search ${dimensionLabel.toLowerCase()} names…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          },
        }}
      />

      {loading && <ContentSkeleton variant="list" />}

      {error && missingIndex && (
        <EmptyState
          heading="No profiling data available"
          description="The profiling-events data stream was not found. Enable Universal Profiling in your Elastic cluster to start collecting continuous profiling data."
          size="small"
        />
      )}
      {error && !missingIndex && <Alert severity="error">{error}</Alert>}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState heading={emptyHeading} description={emptyDescription} size="small" />
      )}

      {!loading && !error && filtered.length > 0 && (
        <RankedValueList rows={filtered} metricLabel="samples" onSelect={onSelect} />
      )}
    </Paper>
  );
}
