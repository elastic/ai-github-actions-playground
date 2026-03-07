import { useCallback, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

import { InsightSlotProvider } from "../InsightSlotContext";
import InsightSlot from "../InsightSlot";

import LogsFocusPicker, { type LogsFocusDimension } from "./LogsFocusPicker";
import LogsSearchPanel from "./LogsSearchPanel";
import { LOGS_INSIGHT_SLOT_IDS } from "./logsInsightSlots";
import type { LogsViewMode } from "./logsUtils";
import { useLogsPageState } from "./useLogsPageState";
import LogsQueryEditor from "./LogsQueryEditor";
import LogsFieldSidebar from "./LogsFieldSidebar";
import LogsResultsView from "./LogsResultsView";
import ExtractFieldsDialog from "./ExtractFieldsDialog";

export default function LogsPage() {
  const state = useLogsPageState();
  const [focusChosen, setFocusChosen] = useState(false);

  const handleOpenExtractDialogFromCell = useCallback(
    (source: string) => {
      state.setExtractSource(source);
      state.setExtractMethod("DISSECT");
      state.setExtractPattern("%{extracted.value}");
      state.setExtractDialogOpen(true);
    },
    [
      state.setExtractSource,
      state.setExtractMethod,
      state.setExtractPattern,
      state.setExtractDialogOpen,
    ],
  );

  const handleFocusSelect = useCallback(
    (dimension: LogsFocusDimension | null) => {
      setFocusChosen(true);
      if (dimension) {
        state.addFilter({ field: dimension, value: "*" });
      }
    },
    [state.addFilter],
  );

  // Show the focus picker when the user hasn't interacted yet and there are no results
  const showFocusPicker = !focusChosen && !state.result && !state.loading;

  return (
    <InsightSlotProvider
      summary={state.slotInsights.summary}
      insights={state.slotInsights.insights}
      loading={state.slotInsights.loading}
      error={state.slotInsights.error}
      refresh={state.slotInsights.refresh}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: "100%" }}>
        <Box sx={{ width: "100%" }}>
          <InsightSlot slotId={LOGS_INSIGHT_SLOT_IDS.logsSearch}>
            <Box sx={{ width: "100%" }}>
              <LogsSearchPanel
                searchText={state.searchText}
                onSearchTextChange={state.setSearchText}
                filters={state.filters}
                onAddFilter={state.addFilter}
                onRemoveFilter={state.removeFilter}
                onClearFilters={state.clearFilters}
                effectiveQuery={state.effectiveQuery}
                onRawQueryChange={state.setRawQuery}
                onCreateEditor={state.setQueryContextView}
                queryEditorExtensions={state.queryEditorExtensions}
                themeMode={state.themeMode}
                searchLoading={state.loading}
                onSearch={state.runLogsQuery}
                searchResultCount={state.result ? state.result.values.length : null}
                collapsed={state.logsSearchCollapsed}
                onToggleCollapsed={() => state.setLogsSearchCollapsed(!state.logsSearchCollapsed)}
                onGuidedGenericMatch={state.runGuidedGenericMatch}
                onUseCaseChangePoint={state.runChangePointExperience}
                onUseCaseCategorize={state.runCategorizeQuery}
                onUseCaseErrorTriage={state.runErrorTriageExperience}
                onUseCaseServicePivot={state.runServicePivotExperience}
                onUseCaseTraceCorrelation={state.runTraceCorrelationExperience}
                onUseCaseExtractFields={state.handleOpenExtractBuilder}
              />
            </Box>
          </InsightSlot>
        </Box>

        <LogsQueryEditor
          effectiveQuery={state.effectiveQuery}
          onRawQueryChange={state.setRawQuery}
          onCreateEditor={state.setQueryContextView}
          editorExtensions={state.logsQueryEditorExtensions}
          themeMode={state.themeMode}
          collapsed={state.logsQueryEditorCollapsed}
          onToggleCollapsed={() => state.setLogsQueryEditorCollapsed((v) => !v)}
          editorFocused={state.logsEditorFocused}
          explainOpen={state.logsExplainOpen}
          onToggleExplain={() => state.setLogsExplainOpen((v) => !v)}
          explainPanelId={state.logsExplainPanelId}
          queryExplanation={state.logsQueryExplanation}
        />

        {/* View mode toggle */}
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <ToggleButtonGroup
            size="small"
            color="primary"
            value={state.viewMode}
            exclusive
            onChange={(_, next: LogsViewMode | null) => {
              if (next) state.setViewMode(next);
            }}
            aria-label="Logs view mode"
          >
            <ToggleButton value="lines">Lines</ToggleButton>
            <ToggleButton value="chart">Chart</ToggleButton>
            <ToggleButton value="patterns">Patterns</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {state.error && <Alert severity="error">{state.error}</Alert>}

        {showFocusPicker && <LogsFocusPicker onSelect={handleFocusSelect} />}

        <Box sx={{ flex: 1, width: "100%", minHeight: 0 }}>
          <InsightSlot slotId={LOGS_INSIGHT_SLOT_IDS.logsResults}>
            <Box
              sx={{
                display: "flex",
                flex: 1,
                gap: 1,
                width: "100%",
                height: "100%",
                minHeight: 0,
              }}
            >
              <LogsFieldSidebar
                sidebarFields={state.sidebarFields}
                fieldValues={state.fieldValues}
                extractedFieldValues={state.extractedFieldValues}
                fieldValuesLoading={state.fieldValuesLoading}
                fieldValuesError={state.fieldValuesError}
                onCellFilter={state.handleCellFilter}
              />
              <LogsResultsView
                result={state.result}
                loading={state.loading}
                viewMode={state.viewMode}
                histogramBuckets={state.histogramBuckets}
                patternGroups={state.patternGroups}
                onCellFilter={state.handleCellFilter}
                onTracePivot={state.handleTracePivot}
                onAnomalyDrillIn={state.handleAnomalyDrillIn}
                onSearchTextChange={state.setSearchText}
                onViewModeChange={state.setViewMode}
                onOpenExtractDialog={handleOpenExtractDialogFromCell}
              />
            </Box>
          </InsightSlot>
        </Box>

        <ExtractFieldsDialog
          open={state.extractDialogOpen}
          onClose={() => state.setExtractDialogOpen(false)}
          extractMethod={state.extractMethod}
          onExtractMethodChange={state.setExtractMethod}
          extractPattern={state.extractPattern}
          onExtractPatternChange={state.setExtractPattern}
          extractSource={state.extractSource}
          onApply={state.handleApplyExtraction}
        />
      </Box>
    </InsightSlotProvider>
  );
}
