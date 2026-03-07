import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import { EditorView } from "@codemirror/view";

import { useThemeStore } from "../../store/useThemeStore";
import { usePageSlotInsights } from "../../hooks/usePageSlotInsights";
import { INSIGHT_GUARDRAIL, INSIGHT_SPECIFICITY_POLICY } from "../../hooks/insightPromptUtils";
import type { InsightSlotDefinition } from "../../types/insightSlots";
import { InsightSlotProvider } from "../InsightSlotContext";
import InsightSlot from "../InsightSlot";

import TraceEditorPanel from "./TraceEditorPanel";
import TraceMetricsCharts from "./TraceMetricsCharts";
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
import { useTraceQueryEditorExtensions } from "./useTraceQueryEditorExtensions";

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
  const [tracesEditorFocused, setTracesEditorFocused] = useState(false);

  const queryEditorExtensions = useTraceQueryEditorExtensions(orchestrator.handleSearch);

  const tracesQueryEditorExtensions = useMemo(
    () => [
      EditorView.contentAttributes.of({ "aria-label": "ES|QL query editor" }),
      ...queryEditorExtensions,
      EditorView.focusChangeEffect.of((_state, focusing) => {
        setTracesEditorFocused(focusing);
        return null;
      }),
    ],
    [queryEditorExtensions],
  );

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
          <TraceEditorPanel
            editorFocused={tracesEditorFocused}
            editorHeight={orchestrator.traceEditorHeight}
            setEditorHeight={orchestrator.setTraceEditorHeight}
            effectiveQuery={orchestrator.effectiveQuery}
            onQueryChange={(val) => orchestrator.setRawQuery(val)}
            onCreateEditor={(view) => orchestrator.setQueryContextView(view)}
            queryEditorExtensions={tracesQueryEditorExtensions}
            themeMode={themeMode}
            loading={orchestrator.searchLoading}
            onRun={orchestrator.handleSearch}
            onFormat={orchestrator.handleFormatQuery}
            collapsed={orchestrator.traceSearchCollapsed}
            onToggleCollapsed={() =>
              orchestrator.setTraceSearchCollapsed(!orchestrator.traceSearchCollapsed)
            }
          />
        </InsightSlot>

        <TraceMetricsCharts
          timeseriesResult={orchestrator.timeseriesResult}
          timeseriesLoading={orchestrator.timeseriesLoading}
          traceRows={orchestrator.traceRows}
          searchLoading={orchestrator.searchLoading}
          onSelectTracePoint={(point) => {
            orchestrator.handleSelectTrace(point.traceId, point.spanId, point.timestamp);
            if (point.spanId) orchestrator.handleSelectSpan(point.spanId);
          }}
          collapsed={orchestrator.traceMetricsChartsCollapsed}
          onToggleCollapsed={() =>
            orchestrator.setTraceMetricsChartsCollapsed(!orchestrator.traceMetricsChartsCollapsed)
          }
          timeFrom={orchestrator.filters.timeFrom}
          timeTo={orchestrator.filters.timeTo}
        />

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
