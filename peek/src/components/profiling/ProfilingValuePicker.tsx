import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";
import Button from "@mui/material/Button";

import ContentSkeleton from "../ContentSkeleton";
import EmptyState from "../EmptyState";
import DateRangePicker from "../DateRangePicker";
import { toDashboardTimeRange, toTraceTimeRange } from "../timePresets";
import { ElasticsearchClient, isElasticsearchError } from "../../services/es";
import type { ElasticsearchConnection } from "../../services/es";

import {
  buildDistinctValuesQuery,
  PROFILING_DIMENSION_LABELS,
  type ProfilingFocusDimension,
} from "./profilingQueryBuilder";
import { isMissingProfilingIndex } from "./profilingUtils";

interface ValueRow {
  value: string;
  samples: number;
}

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
  const [rows, setRows] = useState<ValueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const fetchValues = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const client = new ElasticsearchClient(connection);
      const query = buildDistinctValuesQuery(dimension, timeFrom, timeTo);
      const result = await client.query({ query }, controller.signal);
      const dimCol = result.columns.findIndex((c) => c.name === dimension);
      const samplesCol = result.columns.findIndex((c) => c.name === "samples");
      const parsed: ValueRow[] = result.values
        .map((row) => ({
          value: String(row[dimCol] ?? ""),
          samples: Number(row[samplesCol] ?? 0),
        }))
        .filter((r) => r.value.length > 0);
      setRows(parsed);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setError(isElasticsearchError(err) ? err.message : String(err));
    } finally {
      if (!controller.signal.aborted && abortRef.current === controller) setLoading(false);
    }
  }, [connection, dimension, timeFrom, timeTo]);

  useEffect(() => {
    void fetchValues();
    return () => abortRef.current?.abort();
  }, [fetchValues]);

  const maxSamples = rows[0]?.samples || 1;
  const filtered = search.trim()
    ? rows.filter((r) => r.value.toLowerCase().includes(search.trim().toLowerCase()))
    : rows;

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

      {error && isMissingProfilingIndex(error) && (
        <EmptyState
          heading="No profiling data available"
          description="The profiling-events data stream was not found. Enable Universal Profiling in your Elastic cluster to start collecting continuous profiling data."
          size="small"
        />
      )}
      {error && !isMissingProfilingIndex(error) && <Alert severity="error">{error}</Alert>}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState heading={emptyHeading} description={emptyDescription} size="small" />
      )}

      {!loading && !error && filtered.length > 0 && (
        <List disablePadding>
          {filtered.map((row) => (
            <ListItemButton
              key={row.value}
              onClick={() => onSelect(row.value)}
              sx={{ mb: 0.5, borderRadius: 1 }}
            >
              <ListItemText
                primary={row.value}
                secondary={
                  <Box
                    component="span"
                    sx={{ display: "flex", gap: 1, alignItems: "center", mt: 0.5 }}
                  >
                    <LinearProgress
                      variant="determinate"
                      value={(row.samples / maxSamples) * 100}
                      sx={{ flex: 1, height: 4, borderRadius: 2 }}
                    />
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ whiteSpace: "nowrap" }}
                    >
                      {row.samples.toLocaleString()} samples
                    </Typography>
                  </Box>
                }
                slotProps={{ secondary: { component: "div" } }}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Paper>
  );
}
