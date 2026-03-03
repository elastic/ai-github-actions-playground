import { useMemo } from "react";
import Box from "@mui/material/Box";
import { EditorView } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { SQLDialect } from "@codemirror/lang-sql";

import { useUIStore } from "../../store/useUIStore";
import { makeLLMCompletionExtension } from "../llmCompletionExtension";
import ResizableSplitPane from "../ResizableSplitPane";

import TraceSearchPanel from "./TraceSearchPanel";
import TraceDetailPanel from "./TraceDetailPanel";
import TraceResultsView from "./TraceResultsView";
import TraceErrorAlerts from "./TraceErrorAlerts";
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
          "You are an ES|QL inline completion engine for OpenTelemetry trace data. " +
          "The primary index is traces-*-* with OTEL fields: " +
          "trace.id, span.id, parent_span.id, service.name, span.name, " +
          "span.kind, span.duration.us, span.status.code, @timestamp.\n" +
          "- ES|QL is a piped language (FROM … | WHERE … | STATS …), NOT SQL.\n" +
          "- If a query error is shown, fix the error.\n" +
          "- If the user writes natural language, replace it with valid ES|QL.\n" +
          "- Return ONLY query text. No explanations, no markdown fences.",
        esqlGuide: true,
      }),
    ],
    [],
  );

  const resultsView = (
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
    />
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
          {orchestrator.selectedTraceId ? (
            <ResizableSplitPane
              /* 45 % top / 55 % bottom keeps the waterfall chart majority-visible on load */
              initialTopFraction={0.45}
              minPaneHeight={140}
              top={resultsView}
              bottom={
                <TraceDetailPanel
                  selectedTraceId={orchestrator.selectedTraceId}
                  selectedTraceSpans={orchestrator.selectedTraceSpans}
                  detailLoading={orchestrator.detailLoading}
                  onOpenInQueryLab={() =>
                    orchestrator.handleOpenInDiscover(
                      orchestrator.selectedTraceId!,
                      orchestrator.selectedRootSpanId,
                      orchestrator.selectedTraceTimestamp,
                    )
                  }
                  onClose={orchestrator.clearTraceSelection}
                />
              }
            />
          ) : (
            resultsView
          )}
        </Box>
      </Box>
    </Box>
  );
}
