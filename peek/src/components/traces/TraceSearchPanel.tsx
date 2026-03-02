import { useState, useCallback } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
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

const TOOLBAR_CONTROL_MIN_HEIGHT = 32;

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
  const [minDurationInput, setMinDurationInput] = useState("");
  const [maxDurationInput, setMaxDurationInput] = useState("");

  const handleApplyDuration = useCallback(() => {
    const minMs = minDurationInput !== "" ? Number(minDurationInput) : null;
    const maxMs = maxDurationInput !== "" ? Number(maxDurationInput) : null;
    const validMin = minMs !== null && Number.isFinite(minMs) && minMs >= 0 ? minMs : null;
    const validMax = maxMs !== null && Number.isFinite(maxMs) && maxMs >= 0 ? maxMs : null;
    const shouldSwap = validMin !== null && validMax !== null && validMax < validMin;
    applyFiltersAndRun({
      minDurationMs: shouldSwap ? validMax : validMin,
      maxDurationMs: shouldSwap ? validMin : validMax,
    });
  }, [minDurationInput, maxDurationInput, applyFiltersAndRun]);

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
      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
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
      </Stack>

      {/* Quick filters row */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          alignItems: "center",
          mb: 1,
          "& .MuiOutlinedInput-input": { paddingBlock: "4.5px" },
          "& .MuiOutlinedInput-notchedOutline": { top: 0 },
          "& .MuiOutlinedInput-root": {
            height: TOOLBAR_CONTROL_MIN_HEIGHT,
            minHeight: TOOLBAR_CONTROL_MIN_HEIGHT,
          },
          "& .MuiSelect-select.MuiInputBase-inputSizeSmall": { paddingBlock: "4.5px" },
        }}
      >
        <Autocomplete
          multiple
          freeSolo
          options={[] as string[]}
          value={filters.services}
          onChange={(_event, newValue) => {
            const unique = [
              ...new Set((newValue as string[]).map((v) => v.trim()).filter(Boolean)),
            ];
            applyFiltersAndRun({ services: unique });
          }}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const { key, ...rest } = getTagProps({ index });
              return (
                <Chip
                  key={key}
                  {...rest}
                  label={`service: ${option}`}
                  size="small"
                  sx={{ borderLeft: `3px solid ${getServiceColor(option)}` }}
                />
              );
            })
          }
          renderInput={(params) => (
            <TextField {...params} size="small" placeholder="Service name" />
          )}
          sx={{
            minWidth: 160,
            "& .MuiInputBase-root": { minHeight: TOOLBAR_CONTROL_MIN_HEIGHT },
          }}
        />
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
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
          <Button
            size="small"
            variant="outlined"
            onClick={handleApplyDuration}
            sx={{ minHeight: TOOLBAR_CONTROL_MIN_HEIGHT }}
          >
            Apply
          </Button>
        </Stack>
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
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", ml: "auto" }}>
          {(["Error", "OK"] as const).map((status) => (
            <Chip
              key={status}
              label={status}
              size="medium"
              variant={filters.statusCodes.includes(status) ? "filled" : "outlined"}
              color={status === "Error" ? "error" : "default"}
              sx={{ height: TOOLBAR_CONTROL_MIN_HEIGHT }}
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
        </Stack>
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

      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Button
          variant="contained"
          size="small"
          sx={{ minHeight: TOOLBAR_CONTROL_MIN_HEIGHT }}
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
      </Stack>
    </Paper>
  );
}
