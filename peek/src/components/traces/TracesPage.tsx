import { useMemo } from "react";
import Box from "@mui/material/Box";
import { EditorView } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { SQLDialect } from "@codemirror/lang-sql";

import { useUIStore } from "../../store/useUIStore";
import { makeLLMCompletionExtension } from "../llmCompletionExtension";

import TraceSearchPanel from "./TraceSearchPanel";
import TraceResultsView from "./TraceResultsView";
import TraceErrorAlerts from "./TraceErrorAlerts";
import SpanDetailDrawer from "./SpanDetailDrawer";
import { useTracesOrchestrator } from "./useTracesOrchestrator";

export default function TracesPage() {
  const themeMode = useUIStore((s) => s.themeMode);
  const orchestrator = useTracesOrchestrator();

  const queryEditorExtensions = useMemo(
    () => [
      SQLDialect.define({ slashComments: true }).language,
      Prec.highest(
        EditorState.languageData.of(() => [
          { commentTokens: { line: "//", block: { open: "/*", close: "*/" } } },
        ]),
      ),
      EditorView.lineWrapping,
      makeLLMCompletionExtension({
        prompt:
          "You are an ES|QL expert specializing in OpenTelemetry trace queries. " +
          "Complete the ES|QL query at the cursor. " +
          "If a recent query error is shown, suggest a fix. " +
          "If the user writes plain language (e.g. 'count traces by service'), " +
          "complete with the valid ES|QL implementation of their intent. " +
          "Return only the completion text.",
        esqlGuide: true,
      }),
    ],
    [],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: "100%" }}>
      <TraceSearchPanel
        filters={orchestrator.filters}
        resetFilters={orchestrator.resetFilters}
        applyFiltersAndRun={orchestrator.applyFiltersAndRun}
        effectiveQuery={orchestrator.effectiveQuery}
        onRawQueryChange={(val) => orchestrator.setRawQuery(val)}
        onCreateEditor={(view) => orchestrator.setQueryContextView(view)}
        queryEditorExtensions={queryEditorExtensions}
        themeMode={themeMode}
        searchLoading={orchestrator.searchLoading}
        onSearch={orchestrator.handleSearch}
        searchResultCount={
          orchestrator.searchResult ? orchestrator.searchResult.values.length : null
        }
        collapsed={orchestrator.traceSearchCollapsed}
        onToggleCollapsed={() =>
          orchestrator.setTraceSearchCollapsed(!orchestrator.traceSearchCollapsed)
        }
      />

      <TraceErrorAlerts
        errors={[
          orchestrator.searchError,
          orchestrator.detailError,
          orchestrator.timeseriesError,
          orchestrator.driftRadarError,
          orchestrator.driftRadarBaselineError,
        ]}
      />

      {/* Content area */}
      <Box
        sx={{
          position: "relative",
          display: "flex",
          flex: 1,
          gap: 1,
          minHeight: 0,
        }}
      >
        {/* Results panel */}
        <Box
          sx={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <TraceResultsView
            viewMode={orchestrator.viewMode}
            onViewModeChange={orchestrator.setViewMode}
            searchResult={orchestrator.searchResult}
            searchLoading={orchestrator.searchLoading}
            traceRows={orchestrator.traceRows}
            selectedTraceId={orchestrator.selectedTraceId}
            onSelectTrace={orchestrator.handleSelectTrace}
            maxDuration={orchestrator.maxDuration}
            rawQuery={orchestrator.rawQuery}
            timeseriesLoading={orchestrator.timeseriesLoading}
            timeseriesResult={orchestrator.timeseriesResult}
            detailLoading={orchestrator.detailLoading}
            selectedTraceSpans={orchestrator.selectedTraceSpans}
            onServiceMapNodeClick={orchestrator.handleServiceMapNodeClick}
            driftRadarLoading={orchestrator.driftRadarLoading}
            driftRadarBaselineLoading={orchestrator.driftRadarBaselineLoading}
            driftRadarSpans={orchestrator.driftRadarSpans}
            driftRadarBaselineSpans={orchestrator.driftRadarBaselineSpans}
            driftRadarBaselineEnabled={orchestrator.driftRadarBaselineEnabled}
            onDriftRadarBaselineChange={orchestrator.handleDriftRadarBaselineChange}
            filters={orchestrator.filters}
            onSearch={orchestrator.handleSearch}
            searchSpans={orchestrator.searchSpans}
            selectedSpanId={orchestrator.selectedSpanId}
            onSelectSpan={orchestrator.handleSelectSpan}
            onClearTraceSelection={orchestrator.clearTraceSelection}
            onOpenInQueryLab={() =>
              orchestrator.handleOpenInDiscover(
                orchestrator.selectedTraceId!,
                orchestrator.selectedRootSpanId,
                orchestrator.selectedTraceTimestamp,
              )
            }
          />
        </Box>
      </Box>

      <SpanDetailDrawer
        span={orchestrator.selectedSpan}
        open={orchestrator.drawerOpen}
        onClose={() => orchestrator.setDrawerOpen(false)}
        onFilterBy={orchestrator.handleDrawerFilterBy}
        onExclude={orchestrator.handleDrawerExclude}
        onOpenInQueryLab={orchestrator.handleDrawerOpenInQueryLab}
      />
    </Box>
  );
}
