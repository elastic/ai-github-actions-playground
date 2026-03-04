import { useMemo } from "react";
import Box from "@mui/material/Box";
import { EditorView } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { SQLDialect } from "@codemirror/lang-sql";

import { useUIStore } from "../../store/useUIStore";
import { usePageSlotInsights } from "../../hooks/usePageSlotInsights";
import { INSIGHT_GUARDRAIL } from "../../hooks/insightPromptUtils";
import { InsightSlotProvider } from "../InsightSlotContext";
import InsightSlot from "../InsightSlot";
import { makeLLMCompletionExtension } from "../llmCompletionExtension";

import TraceSearchPanel from "./TraceSearchPanel";
import TraceResultsView from "./TraceResultsView";
import TraceErrorAlerts from "./TraceErrorAlerts";
import SpanDetailDrawer from "./SpanDetailDrawer";
import { useTracesOrchestrator } from "./useTracesOrchestrator";
import { TRACES_INSIGHT_SLOT_IDS, TRACES_INSIGHT_SLOTS } from "./tracesInsightSlots";

const TRACES_SYSTEM_PROMPT =
  "You are a distributed-tracing observability assistant." +
  " Analyse the trace search context and produce per-slot insights." +
  INSIGHT_GUARDRAIL;

export default function TracesPage() {
  const themeMode = useUIStore((s) => s.themeMode);
  const orchestrator = useTracesOrchestrator();

  const slotContext = useMemo(
    () =>
      JSON.stringify({
        effectiveQuery: orchestrator.effectiveQuery,
        filters: orchestrator.filters,
        resultCount: orchestrator.searchResult?.values.length ?? 0,
        selectedTraceId: orchestrator.selectedTraceId,
        selectedSpanId: orchestrator.selectedSpanId,
        viewMode: orchestrator.viewMode,
      }),
    [
      orchestrator.effectiveQuery,
      orchestrator.filters,
      orchestrator.searchResult?.values.length,
      orchestrator.selectedTraceId,
      orchestrator.selectedSpanId,
      orchestrator.viewMode,
    ],
  );

  const slotInsights = usePageSlotInsights({
    context: slotContext,
    systemPrompt: TRACES_SYSTEM_PROMPT,
    cacheKey: `traces-slots::${slotContext}`,
    slots: TRACES_INSIGHT_SLOTS,
  });

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

  return (
    <InsightSlotProvider
      summary={slotInsights.summary}
      insights={slotInsights.insights}
      loading={slotInsights.loading}
      error={slotInsights.error}
      refresh={slotInsights.refresh}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: "100%" }}>
        <InsightSlot slotId={TRACES_INSIGHT_SLOT_IDS.traceSearch}>
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
        </InsightSlot>

        <TraceErrorAlerts
          errors={[
            orchestrator.searchError,
            orchestrator.searchSpansError,
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
            <InsightSlot slotId={TRACES_INSIGHT_SLOT_IDS.traceResults}>
              <TraceResultsView
                viewMode={orchestrator.viewMode}
                onViewModeChange={orchestrator.setViewMode}
                searchResult={orchestrator.searchResult}
                searchLoading={orchestrator.searchLoading}
                searchSpansLoading={orchestrator.searchSpansLoading}
                traceRows={orchestrator.traceRows}
                selectedTraceId={orchestrator.selectedTraceId}
                onSelectTrace={orchestrator.handleSelectTrace}
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
                onOpenInQueryLab={
                  orchestrator.selectedTraceId
                    ? () =>
                        orchestrator.handleOpenInDiscover(
                          orchestrator.selectedTraceId!,
                          orchestrator.selectedRootSpanId,
                          orchestrator.selectedTraceTimestamp,
                        )
                    : undefined
                }
              />
            </InsightSlot>
          </Box>
        </Box>

        <InsightSlot slotId={TRACES_INSIGHT_SLOT_IDS.traceWaterfall}>
          <SpanDetailDrawer
            span={orchestrator.selectedSpan}
            open={orchestrator.drawerOpen}
            selectedSpanId={orchestrator.selectedSpanId}
            traceSpans={orchestrator.selectedTraceSpans}
            searchSpans={orchestrator.searchSpans}
            onClose={() => orchestrator.setDrawerOpen(false)}
            onSelectSpan={orchestrator.handleSelectSpan}
            onFilterBy={orchestrator.handleDrawerFilterBy}
            onExclude={orchestrator.handleDrawerExclude}
            onOpenInQueryLab={orchestrator.handleDrawerOpenInQueryLab}
          />
        </InsightSlot>
      </Box>
    </InsightSlotProvider>
  );
}
