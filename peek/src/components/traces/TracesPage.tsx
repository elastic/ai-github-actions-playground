import { useMemo } from "react";
import Box from "@mui/material/Box";
import { EditorView } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { SQLDialect } from "@codemirror/lang-sql";

import { useUIStore } from "../../store/useUIStore";
import { makeLLMCompletionExtension } from "../llmCompletionExtension";
import ResizableSplitPane from "../ResizableSplitPane";

import SpanDetailDrawer from "./SpanDetailDrawer";
import TraceSearchPanel from "./TraceSearchPanel";
import TraceDetailPanel from "./TraceDetailPanel";
import TraceResultsView from "./TraceResultsView";
import TraceErrorAlerts from "./TraceErrorAlerts";
import { useTracesOrchestrator } from "./useTracesOrchestrator";

export default function TracesPage() {
  const themeMode = useUIStore((s) => s.themeMode);
  const o = useTracesOrchestrator();

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

  const resultsView = (
    <TraceResultsView
      viewMode={o.viewMode}
      onViewModeChange={o.setViewMode}
      searchResult={o.searchResult}
      searchLoading={o.searchLoading}
      traceRows={o.traceRows}
      selectedTraceId={o.selectedTraceId}
      onSelectTrace={o.handleSelectTrace}
      maxDuration={o.maxDuration}
      rawQuery={o.rawQuery}
      timeseriesLoading={o.timeseriesLoading}
      timeseriesResult={o.timeseriesResult}
      detailLoading={o.detailLoading}
      selectedTraceSpans={o.selectedTraceSpans}
      onServiceMapNodeClick={o.handleServiceMapNodeClick}
      driftRadarLoading={o.driftRadarLoading}
      driftRadarBaselineLoading={o.driftRadarBaselineLoading}
      driftRadarSpans={o.driftRadarSpans}
      driftRadarBaselineSpans={o.driftRadarBaselineSpans}
      driftRadarBaselineEnabled={o.driftRadarBaselineEnabled}
      onDriftRadarBaselineChange={o.handleDriftRadarBaselineChange}
      filters={o.filters}
      onSearch={o.handleSearch}
    />
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: "100%" }}>
      <TraceSearchPanel
        filters={o.filters}
        resetFilters={o.resetFilters}
        applyFiltersAndRun={o.applyFiltersAndRun}
        effectiveQuery={o.effectiveQuery}
        onRawQueryChange={(val) => o.setRawQuery(val)}
        onCreateEditor={(view) => o.setQueryContextView(view)}
        queryEditorExtensions={queryEditorExtensions}
        themeMode={themeMode}
        searchLoading={o.searchLoading}
        onSearch={o.handleSearch}
        searchResultCount={o.searchResult ? o.searchResult.values.length : null}
        collapsed={o.traceSearchCollapsed}
        onToggleCollapsed={() => o.setTraceSearchCollapsed(!o.traceSearchCollapsed)}
      />

      <TraceErrorAlerts
        errors={[
          o.searchError,
          o.detailError,
          o.timeseriesError,
          o.driftRadarError,
          o.driftRadarBaselineError,
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
          {o.selectedTraceId ? (
            <ResizableSplitPane
              /* 45 % top / 55 % bottom keeps the waterfall chart majority-visible on load */
              initialTopFraction={0.45}
              minPaneHeight={140}
              top={resultsView}
              bottom={
                <TraceDetailPanel
                  selectedTraceId={o.selectedTraceId}
                  selectedTraceSpans={o.selectedTraceSpans}
                  detailLoading={o.detailLoading}
                  selectedSpanId={o.selectedSpanId}
                  onSpanClick={(spanId) => o.setSelectedSpanId(spanId)}
                  onOpenInQueryLab={() =>
                    o.handleOpenInDiscover(
                      o.selectedTraceId!,
                      o.selectedRootSpanId,
                      o.selectedTraceTimestamp,
                    )
                  }
                  onClose={o.clearTraceSelection}
                />
              }
            />
          ) : (
            resultsView
          )}
        </Box>
      </Box>

      {/* Span Detail Drawer */}
      <SpanDetailDrawer
        span={o.selectedSpan}
        open={o.drawerOpen}
        onClose={() => o.setDrawerOpen(false)}
        onFilterBy={o.handleDrawerFilterBy}
        onExclude={o.handleDrawerExclude}
        onOpenInQueryLab={o.handleDrawerOpenInQueryLab}
      />
    </Box>
  );
}
