import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import { PAGE_PATHS } from "../../routes/paths";
import { escapeEsqlString } from "../../services/es/esqlUtils";
import { useConnectionStore } from "../../store/useConnectionStore";
import {
  useProfilingFiltersStore,
  type ProfilingViewMode,
} from "../../store/useProfilingFiltersStore";
import { useOpenInDiscover } from "../../hooks/useOpenInDiscover";

import ProfilingAdvancedView from "./ProfilingAdvancedView";
import { useProfilingAdvancedData } from "./useProfilingAdvancedData";

export default function ProfilingPage() {
  const navigate = useNavigate();
  const connection = useConnectionStore((state) => state.connection);
  const openInDiscover = useOpenInDiscover();
  const {
    filters,
    rawQuery,
    viewMode,
    expandedStacktraceIds,
    updateFilters,
    setRawQuery,
    setViewMode,
    toggleExpandedStacktraceId,
    resetFilters,
  } = useProfilingFiltersStore(
    useShallow((state) => ({
      filters: state.profilingFilters,
      rawQuery: state.profilingRawQuery,
      viewMode: state.profilingViewMode,
      expandedStacktraceIds: state.expandedStacktraceIds,
      updateFilters: state.updateProfilingFilters,
      setRawQuery: state.setProfilingRawQuery,
      setViewMode: state.setProfilingViewMode,
      toggleExpandedStacktraceId: state.toggleExpandedStacktraceId,
      resetFilters: state.resetProfilingFilters,
    })),
  );

  const data = useProfilingAdvancedData({ connection, viewMode, filters, rawQuery });

  const handleOpenInQueryLab = useCallback(() => {
    if (viewMode === "topFunctions") return;
    const draft =
      viewMode === "flamescope" && data.flamescopeWindow
        ? `${data.effectiveQuery}\n| WHERE @timestamp >= "${escapeEsqlString(data.flamescopeWindow.from)}" AND @timestamp < "${escapeEsqlString(data.flamescopeWindow.to)}"`
        : data.effectiveQuery;
    openInDiscover(draft);
  }, [data.effectiveQuery, data.flamescopeWindow, openInDiscover, viewMode]);

  const handleFrameClick = useCallback(
    (frameName: string) => {
      if (frameName === "(unknown)") return;
      const draft = `${data.effectiveQuery}\n| WHERE Stackframe.function.name == "${escapeEsqlString(frameName)}"`;
      openInDiscover(draft);
    },
    [data.effectiveQuery, openInDiscover],
  );

  return (
    <ProfilingAdvancedView
      onNavigateGuided={() => navigate(PAGE_PATHS.profiling.path)}
      onResetFilters={() => {
        resetFilters();
        data.resetResults();
      }}
      onOpenInQueryLab={handleOpenInQueryLab}
      onRun={data.handleRun}
      viewMode={viewMode as ProfilingViewMode}
      onViewModeChange={setViewMode}
      filters={filters}
      onUpdateFilters={updateFilters}
      effectiveQuery={data.effectiveQuery}
      onRawQueryChange={setRawQuery}
      loading={data.loading}
      error={data.error}
      hasRunByMode={data.hasRunByMode}
      topFunctionsRows={data.topFunctionsRows}
      timelineResult={data.timelineResult}
      stacktraces={data.stacktraces}
      expandedStacktraceIds={expandedStacktraceIds}
      onToggleExpandedStacktraceId={toggleExpandedStacktraceId}
      flamegraphTree={data.flamegraphTree}
      onFrameClick={handleFrameClick}
      onFlamescopeWindowChange={data.setFlamescopeWindow}
    />
  );
}
