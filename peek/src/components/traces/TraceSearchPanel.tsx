import { useState, useCallback, useMemo } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CancelIcon from "@mui/icons-material/Cancel";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import { TRACE_TIME_RANGE_OPTIONS } from "../timePresets";
import { COMPONENT_HEIGHTS } from "../../types/tokens";
import SignalSearchPanel from "../SignalSearchPanel";

import { getServiceColor } from "./traceColors";
import { formatStatusLabel } from "./traceUtils";
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
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const TOOLBAR_CONTROL_HEIGHT = COMPONENT_HEIGHTS.input;

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
  collapsed,
  onToggleCollapsed,
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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    count += filters.services.length;
    count += filters.statusCodes.length;
    count += filters.tags.length;
    if (filters.minDurationMs !== null) count++;
    if (filters.maxDurationMs !== null) count++;
    if (filters.timeFrom !== null) count++;
    return count;
  }, [filters]);

  const handleResetFilters = useCallback(() => {
    resetFilters();
    setMinDurationInput("");
    setMaxDurationInput("");
  }, [resetFilters]);

  const renderFilterControls = useCallback(
    () => (
      <>
        {/* Filter pills */}
        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mt: 0.5, mb: 1 }}>
          {filters.statusCodes.map((status) => (
            <Chip
              key={status}
              label={`status: ${formatStatusLabel(status)}`}
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
            "& .MuiAutocomplete-inputRoot.MuiOutlinedInput-root.MuiInputBase-root": {
              height: "auto",
              minHeight: TOOLBAR_CONTROL_HEIGHT,
              paddingBlock: 0,
            },
            "& .MuiOutlinedInput-input": {
              boxSizing: "border-box",
              height: TOOLBAR_CONTROL_HEIGHT,
            },
            "& .MuiOutlinedInput-notchedOutline": { top: 0 },
            "& .MuiOutlinedInput-root.MuiInputBase-root": { height: TOOLBAR_CONTROL_HEIGHT },
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
              <TextField
                {...params}
                size="small"
                placeholder="Service name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (e.nativeEvent.isComposing) return;
                    const target = e.target;
                    if (!(target instanceof HTMLInputElement)) return;
                    const val = target.value.trim();
                    if (val && !filters.services.includes(val)) {
                      (e as typeof e & { defaultMuiPrevented?: boolean }).defaultMuiPrevented =
                        true;
                      applyFiltersAndRun({ services: [...filters.services, val] });
                    }
                  }
                }}
              />
            )}
            sx={{
              minWidth: 160,
              "& .MuiInputBase-root.MuiOutlinedInput-root": {
                height: "auto",
                minHeight: TOOLBAR_CONTROL_HEIGHT,
                paddingBlock: 0,
              },
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
              sx={{ minHeight: TOOLBAR_CONTROL_HEIGHT }}
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
            sx={{
              minWidth: 150,
              "&.MuiInputBase-root": { height: TOOLBAR_CONTROL_HEIGHT },
            }}
          >
            {TRACE_TIME_RANGE_OPTIONS.map((opt) => (
              <MenuItem key={opt.label} value={opt.from ?? ""}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", ml: "auto" }}>
            {(
              [
                { value: "Error", label: "Error" },
                { value: "OK", label: "Success" },
              ] as const
            ).map(({ value, label }) => (
              <Chip
                key={value}
                label={label}
                size="medium"
                variant={filters.statusCodes.includes(value) ? "filled" : "outlined"}
                color={value === "Error" ? "error" : "default"}
                sx={{ height: TOOLBAR_CONTROL_HEIGHT }}
                onClick={() => {
                  if (filters.statusCodes.includes(value)) {
                    applyFiltersAndRun({
                      statusCodes: filters.statusCodes.filter((s) => s !== value),
                    });
                  } else {
                    applyFiltersAndRun({
                      statusCodes: [...filters.statusCodes, value],
                    });
                  }
                }}
              />
            ))}
          </Stack>
        </Box>
      </>
    ),
    [filters, applyFiltersAndRun, handleApplyDuration, minDurationInput, maxDurationInput],
  );

  return (
    <SignalSearchPanel
      title="Trace Search"
      resultNoun="traces"
      effectiveQuery={effectiveQuery}
      onRawQueryChange={onRawQueryChange}
      onCreateEditor={onCreateEditor}
      queryEditorExtensions={queryEditorExtensions}
      themeMode={themeMode}
      searchLoading={searchLoading}
      onSearch={onSearch}
      searchResultCount={searchResultCount}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      activeFilterCount={activeFilterCount}
      onResetFilters={handleResetFilters}
      renderFilterControls={renderFilterControls}
    />
  );
}
