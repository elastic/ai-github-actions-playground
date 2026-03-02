import { useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import CircularProgress from "@mui/material/CircularProgress";
import CancelIcon from "@mui/icons-material/Cancel";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";

import { TRACE_TIME_RANGE_OPTIONS } from "../timePresets";
import PageHeader from "../PageHeader";

import { getServiceColor } from "./traceColors";
import type { TraceFilters } from "./traceQueryBuilder";

interface TraceSearchPanelProps {
  filters: TraceFilters;
  resetFilters: () => void;
  applyFiltersAndRun: (updates: Partial<TraceFilters>) => void;
  effectiveQuery: string;
  onRawQueryChange: (val: string) => void;
  onCreateEditor: (view: EditorView) => void;
  queryEditorExtensions: Extension[];
  themeMode: "light" | "dark";
  searchLoading: boolean;
  onSearch: () => void;
  searchResultCount: number | null;
}

export default function TraceSearchPanel({
  filters,
  resetFilters,
  applyFiltersAndRun,
  effectiveQuery,
  onRawQueryChange,
  onCreateEditor,
  queryEditorExtensions,
  themeMode,
  searchLoading,
  onSearch,
  searchResultCount,
}: TraceSearchPanelProps) {
  const [serviceFilter, setServiceFilter] = useState("");
  const [minDurationInput, setMinDurationInput] = useState("");
  const [maxDurationInput, setMaxDurationInput] = useState("");

  const handleApplyDuration = useCallback(() => {
    const minMs = minDurationInput !== "" ? Number(minDurationInput) : null;
    const maxMs = maxDurationInput !== "" ? Number(maxDurationInput) : null;
    applyFiltersAndRun({
      minDurationMs: minMs !== null && !isNaN(minMs) ? minMs : null,
      maxDurationMs: maxMs !== null && !isNaN(maxMs) ? maxMs : null,
    });
  }, [minDurationInput, maxDurationInput, applyFiltersAndRun]);

  const handleAddService = useCallback(() => {
    const trimmed = serviceFilter.trim();
    if (trimmed && !filters.services.includes(trimmed)) {
      applyFiltersAndRun({
        services: [...filters.services, trimmed],
      });
      setServiceFilter("");
    }
  }, [serviceFilter, filters.services, applyFiltersAndRun]);

  const handleRemoveService = useCallback(
    (service: string) => {
      applyFiltersAndRun({
        services: filters.services.filter((s) => s !== service),
      });
    },
    [filters.services, applyFiltersAndRun],
  );

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
        <PageHeader
          title="Trace Search"
          actions={
            <Button
              size="small"
              variant="text"
              onClick={() => {
                resetFilters();
                setServiceFilter("");
                setMinDurationInput("");
                setMaxDurationInput("");
              }}
            >
              Reset Filters
            </Button>
          }
        />
      </Box>

      {/* Filter pills */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
        {filters.services.map((svc) => (
          <Chip
            key={svc}
            label={`service: ${svc}`}
            size="small"
            onDelete={() => handleRemoveService(svc)}
            sx={{
              borderLeft: `3px solid ${getServiceColor(svc)}`,
            }}
          />
        ))}
        {filters.statusCodes.map((status) => (
          <Chip
            key={status}
            label={`status: ${status}`}
            size="small"
            color={status === "Error" ? "error" : "default"}
            deleteIcon={
              <CancelIcon data-testid={`trace-status-chip-delete-${status.toLowerCase()}`} />
            }
            onDelete={() =>
              applyFiltersAndRun({
                statusCodes: filters.statusCodes.filter((s) => s !== status),
              })
            }
          />
        ))}
        {filters.minDurationMs !== null && (
          <Chip
            label={`min: ${filters.minDurationMs}ms`}
            size="small"
            onDelete={() => {
              applyFiltersAndRun({ minDurationMs: null });
              setMinDurationInput("");
            }}
          />
        )}
        {filters.maxDurationMs !== null && (
          <Chip
            label={`max: ${filters.maxDurationMs}ms`}
            size="small"
            onDelete={() => {
              applyFiltersAndRun({ maxDurationMs: null });
              setMaxDurationInput("");
            }}
          />
        )}
        {filters.tags.map((tag, i) => (
          <Chip
            key={`${tag.key}-${tag.value}-${i}`}
            label={`${tag.exclude ? "NOT " : ""}${tag.key}: ${tag.value}`}
            size="small"
            color={tag.exclude ? "warning" : "default"}
            onDelete={() =>
              applyFiltersAndRun({
                tags: filters.tags.filter((_, idx) => idx !== i),
              })
            }
          />
        ))}
        {filters.timeFrom !== null && (
          <Chip
            label={`time: ${TRACE_TIME_RANGE_OPTIONS.find((o) => o.from === filters.timeFrom)?.label ?? "Custom range"}`}
            size="small"
            onDelete={() => applyFiltersAndRun({ timeFrom: null, timeTo: null })}
          />
        )}
      </Box>

      {/* Quick filters row */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          alignItems: "center",
          mb: 1,
        }}
      >
        <TextField
          size="small"
          placeholder="Service name"
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddService();
          }}
          sx={{ width: 160 }}
        />
        <Button size="small" variant="outlined" onClick={handleAddService}>
          Add Service
        </Button>
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          <TextField
            size="small"
            placeholder="Min (ms)"
            value={minDurationInput}
            onChange={(e) => setMinDurationInput(e.target.value)}
            sx={{ width: 100 }}
          />
          <Typography variant="body1" sx={{ px: 0.5 }}>
            —
          </Typography>
          <TextField
            size="small"
            placeholder="Max (ms)"
            value={maxDurationInput}
            onChange={(e) => setMaxDurationInput(e.target.value)}
            sx={{ width: 100 }}
          />
          <Button size="small" variant="outlined" onClick={handleApplyDuration}>
            Apply
          </Button>
        </Box>
        <Select
          size="small"
          displayEmpty
          aria-label="Time range"
          value={filters.timeFrom ?? ""}
          onChange={(e) => {
            const selectedFrom = e.target.value === "" ? null : e.target.value;
            const opt = TRACE_TIME_RANGE_OPTIONS.find((o) => o.from === selectedFrom);
            if (opt) {
              applyFiltersAndRun({ timeFrom: opt.from, timeTo: opt.to });
            }
          }}
          sx={{ minWidth: 150 }}
        >
          {TRACE_TIME_RANGE_OPTIONS.map((opt) => (
            <MenuItem key={opt.label} value={opt.from ?? ""}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", ml: "auto" }}>
          {(["Error", "OK"] as const).map((status) => (
            <Chip
              key={status}
              label={status}
              size="small"
              variant={filters.statusCodes.includes(status) ? "filled" : "outlined"}
              color={status === "Error" ? "error" : "default"}
              onClick={() => {
                if (filters.statusCodes.includes(status)) {
                  applyFiltersAndRun({
                    statusCodes: filters.statusCodes.filter((s) => s !== status),
                  });
                } else {
                  applyFiltersAndRun({
                    statusCodes: [...filters.statusCodes, status],
                  });
                }
              }}
            />
          ))}
        </Box>
      </Box>

      {/* ES|QL editor */}
      <Box sx={{ overflow: "hidden", mb: 1, border: 1, borderColor: "divider", borderRadius: 1 }}>
        <CodeMirror
          value={effectiveQuery}
          onChange={onRawQueryChange}
          onCreateEditor={onCreateEditor}
          extensions={queryEditorExtensions}
          theme={themeMode}
          height="120px"
          basicSetup={{ lineNumbers: true, foldGutter: false, indentOnInput: false }}
          aria-label="Trace search query editor"
        />
      </Box>

      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Button
          variant="contained"
          size="small"
          startIcon={
            searchLoading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />
          }
          onClick={onSearch}
          disabled={searchLoading || !effectiveQuery.trim()}
        >
          Search Traces
        </Button>
        {searchResultCount !== null && (
          <Typography variant="caption" color="text.secondary">
            {searchResultCount} traces found
          </Typography>
        )}
      </Box>
    </Paper>
  );
}
