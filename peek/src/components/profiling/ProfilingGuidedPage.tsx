import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import { parseAsString, useQueryState } from "nuqs";

import { PAGE_MANIFEST } from "../../routes/manifest";
import { useConnectionStore } from "../../store/useConnectionStore";
import { useQueryStore } from "../../store/useQueryStore";
import { usePageFiltersStore } from "../../store/usePageFiltersStore";
import { EMPTY_PROFILING_FILTERS } from "../../types/pageFilters";

import { PROFILING_DIMENSION_LABELS, type ProfilingFocusDimension } from "./profilingQueryBuilder";
import ProfilingFocusPicker from "./ProfilingFocusPicker";
import ProfilingFocusHeader from "./ProfilingFocusHeader";
import ProfilingValuePicker from "./ProfilingValuePicker";
import ProfilingToolbar from "./ProfilingToolbar";
import ProfilingResults from "./ProfilingResults";
import { useProfilingData } from "./useProfilingData";

function isProfilingFocusDimension(value: string | null): value is ProfilingFocusDimension {
  return !!value && Object.prototype.hasOwnProperty.call(PROFILING_DIMENSION_LABELS, value);
}

export default function ProfilingGuidedPage() {
  const navigate = useNavigate();
  const connection = useConnectionStore((state) => state.connection);
  const setDiscoverQueryDraft = useQueryStore((state) => state.setDiscoverQueryDraft);
  const { expandedStacktraceIds, toggleExpandedStacktraceId } = usePageFiltersStore(
    useShallow((s) => ({
      expandedStacktraceIds: s.expandedStacktraceIds,
      toggleExpandedStacktraceId: s.toggleExpandedStacktraceId,
    })),
  );

  // URL-persisted focus state
  const [urlDimension, setUrlDimension] = useQueryState("focus", parseAsString);
  const [urlValue, setUrlValue] = useQueryState("value", parseAsString);

  const isEverything = urlDimension === "";
  const dimension = isProfilingFocusDimension(urlDimension) ? urlDimension : null;
  const value = urlValue ?? null;

  // Time range (local state, not shared with advanced page)
  const [timeFrom, setTimeFrom] = useState(EMPTY_PROFILING_FILTERS.timeFrom);
  const [timeTo, setTimeTo] = useState(EMPTY_PROFILING_FILTERS.timeTo);

  // View mode (flamegraph by default in guided flow)
  const [viewMode, setViewMode] = useState<
    "topFunctions" | "stacktraces" | "timeline" | "flamegraph" | "flamescope"
  >("flamegraph");

  // Track "ready to show results": dimension has been chosen (null = "Everything") and if
  // dimension is non-null, a value must also be set.
  const showResults = (isEverything || dimension !== null) && (isEverything || urlValue !== null);

  const {
    loading,
    error,
    topFunctionsRows,
    timelineResult,
    stacktraces,
    setFlamescopeWindow,
    flamegraphTree,
    handleOpenInQueryLab,
    handleFrameClick,
    hasRun,
    resetResults,
  } = useProfilingData({
    connection,
    viewMode,
    dimension,
    value,
    timeFrom,
    timeTo,
    showResults,
    navigate,
    setDiscoverQueryDraft,
  });

  const handleSelectDimension = useCallback(
    async (dim: ProfilingFocusDimension | null) => {
      if (dim === null) {
        // "Everything" — skip value picker, go straight to results
        await Promise.all([setUrlDimension(""), setUrlValue(null)]);
      } else {
        await Promise.all([setUrlDimension(dim), setUrlValue(null)]);
      }
    },
    [setUrlDimension, setUrlValue],
  );

  const handleSelectValue = useCallback(
    async (val: string) => {
      await setUrlValue(val);
    },
    [setUrlValue],
  );

  const handleChangeFocus = useCallback(async () => {
    resetResults();
    await Promise.all([setUrlDimension(null), setUrlValue(null)]);
  }, [resetResults, setUrlDimension, setUrlValue]);

  const displayDimension = isEverything ? null : dimension;

  // ── Step 1: Focus picker ────────────────────────────────────────────────────
  if (urlDimension === null || (!isEverything && dimension === null)) {
    return <ProfilingFocusPicker onSelect={(dim) => void handleSelectDimension(dim)} />;
  }

  // ── Step 2: Value picker (only if a specific dimension was chosen) ──────────
  if (dimension && urlValue === null && connection) {
    return (
      <ProfilingValuePicker
        dimension={dimension}
        connection={connection}
        timeFrom={timeFrom}
        timeTo={timeTo}
        onSelect={(val) => void handleSelectValue(val)}
        onBack={() => void handleChangeFocus()}
      />
    );
  }

  // ── Step 3: Results view ────────────────────────────────────────────────────
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: "100%" }}>
      <ProfilingFocusHeader
        dimension={displayDimension}
        value={value}
        onChangeFocus={() => void handleChangeFocus()}
      />

      <ProfilingToolbar
        timeFrom={timeFrom}
        timeTo={timeTo}
        onTimeChange={(from, to) => {
          setTimeFrom(from);
          setTimeTo(to);
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showOpenInQueryLab={viewMode !== "topFunctions"}
        onOpenInQueryLab={handleOpenInQueryLab}
        onAdvancedView={() => navigate(PAGE_MANIFEST.profilingAdvanced.path)}
      />

      {loading && <LinearProgress />}

      {error && <Alert severity="error">{error}</Alert>}

      <ProfilingResults
        loading={loading}
        hasRun={hasRun}
        error={error}
        viewMode={viewMode}
        topFunctionsRows={topFunctionsRows}
        timelineResult={timelineResult}
        stacktraces={stacktraces}
        flamegraphTree={flamegraphTree}
        onFlamescopeWindowChange={setFlamescopeWindow}
        handleFrameClick={handleFrameClick}
        expandedStacktraceIds={expandedStacktraceIds}
        toggleExpandedStacktraceId={toggleExpandedStacktraceId}
      />
    </Box>
  );
}
