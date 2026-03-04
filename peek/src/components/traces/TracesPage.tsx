import { useMemo } from "react";
import Box from "@mui/material/Box";
import { EditorView } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { SQLDialect } from "@codemirror/lang-sql";

import { useThemeStore } from "../../store/useThemeStore";
import { usePageSlotInsights } from "../../hooks/usePageSlotInsights";
import { INSIGHT_GUARDRAIL, INSIGHT_SPECIFICITY_POLICY } from "../../hooks/insightPromptUtils";
import type { InsightSlotDefinition } from "../../types/insightSlots";
import { InsightSlotProvider } from "../InsightSlotContext";
import InsightSlot from "../InsightSlot";
import { makeLLMCompletionExtension } from "../llmCompletionExtension";

import TraceSearchPanel from "./TraceSearchPanel";
import TraceResultsView from "./TraceResultsView";
import TraceErrorAlerts from "./TraceErrorAlerts";
import SpanDetailDrawer from "./SpanDetailDrawer";
import { buildSpanTree } from "./traceUtils";
import { identifySiblingGroups } from "./span-tree-plugin/spanTreeGrouping";
import { useTracesOrchestrator } from "./useTracesOrchestrator";
import {
  TRACES_INSIGHT_SLOT_IDS,
  TRACES_INSIGHT_SLOTS,
  traceGroupRowSlotId,
  traceRowSlotId,
} from "./tracesInsightSlots";

const TRACES_SYSTEM_PROMPT =
  "You are a distributed-tracing observability assistant." +
  " Analyse the trace search context and produce per-slot insights." +
  " Prefer selection-aware reasoning: selected span first, then selected trace, then grouped rows, then panel aggregate." +
  " For row/group slots, focus on that row or group only; avoid page-wide recap text." +
  INSIGHT_SPECIFICITY_POLICY +
  INSIGHT_GUARDRAIL;

export default function TracesPage() {
  const themeMode = useThemeStore((s) => s.themeMode);
  const orchestrator = useTracesOrchestrator();

  const rowInsightModel = useMemo(() => {
    if (orchestrator.viewMode !== "list" || orchestrator.searchSpans.length === 0) {
      return {
        slots: [] as InsightSlotDefinition[],
        spanSlotById: {} as Record<string, string>,
        groupSlotByKey: {} as Record<string, string>,
        rowContext: {
          topSpanRows: [] as Array<{
            slotId: string;
            spanId: string;
            traceId: string;
            serviceName: string;
            operationName: string;
            status: string;
            durationUs: number;
          }>,
          groupedRows: [] as Array<{
            slotId: string;
            groupKey: string;
            serviceName: string;
            operationName: string;
            count: number;
            errorCount: number;
            totalDurationUs: number;
          }>,
        },
      };
    }

    const roots = buildSpanTree(orchestrator.searchSpans);
    const groupMap = identifySiblingGroups(roots, 3);
    const spanRows = [...orchestrator.searchSpans]
      .sort((a, b) => b.durationUs - a.durationUs)
      .slice(0, 8)
      .map((span) => ({
        slotId: traceRowSlotId(span.spanId),
        spanId: span.spanId,
        traceId: span.traceId,
        serviceName: span.serviceName,
        operationName: span.name,
        status: span.status,
        durationUs: span.durationUs,
      }));

    const groupedRows = [...groupMap.values()]
      .flat()
      .sort(
        (a, b) =>
          b.stats.count - a.stats.count || b.stats.totalDurationUs - a.stats.totalDurationUs,
      )
      .slice(0, 8)
      .map((run) => ({
        slotId: traceGroupRowSlotId(run.key),
        groupKey: run.key,
        serviceName: run.stats.serviceName,
        operationName: run.stats.operationName,
        count: run.stats.count,
        errorCount: run.stats.errorCount,
        totalDurationUs: run.stats.totalDurationUs,
      }));

    const slots: InsightSlotDefinition[] = [
      ...spanRows.map((row) => ({
        slotId: row.slotId,
        label: `Trace row: ${row.serviceName} / ${row.operationName} (${row.spanId})`,
      })),
      ...groupedRows.map((row) => ({
        slotId: row.slotId,
        label: `Grouped row: ${row.serviceName} / ${row.operationName} (x${row.count})`,
      })),
    ];

    return {
      slots,
      spanSlotById: Object.fromEntries(spanRows.map((row) => [row.spanId, row.slotId])),
      groupSlotByKey: Object.fromEntries(groupedRows.map((row) => [row.groupKey, row.slotId])),
      rowContext: {
        topSpanRows: spanRows,
        groupedRows,
      },
    };
  }, [orchestrator.viewMode, orchestrator.searchSpans]);

  const slotContext = useMemo(
    () =>
      JSON.stringify({
        effectiveQuery: orchestrator.effectiveQuery,
        filters: orchestrator.filters,
        resultCount: orchestrator.searchResult?.values.length ?? 0,
        selectedTraceId: orchestrator.selectedTraceId,
        selectedSpanId: orchestrator.selectedSpanId,
        viewMode: orchestrator.viewMode,
        rowFocus: rowInsightModel.rowContext,
      }),
    [
      orchestrator.effectiveQuery,
      orchestrator.filters,
      orchestrator.searchResult?.values.length,
      orchestrator.selectedTraceId,
      orchestrator.selectedSpanId,
      orchestrator.viewMode,
      rowInsightModel.rowContext,
    ],
  );

  const slotInsights = usePageSlotInsights({
    context: slotContext,
    systemPrompt: TRACES_SYSTEM_PROMPT,
    cacheKey: `traces-slots::${slotContext}`,
    slots: [...TRACES_INSIGHT_SLOTS, ...rowInsightModel.slots],
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
                spanInsightSlotIds={rowInsightModel.spanSlotById}
                groupInsightSlotIds={rowInsightModel.groupSlotByKey}
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
