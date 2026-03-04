import { useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Chip from "@mui/material/Chip";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import TableChartIcon from "@mui/icons-material/TableChart";

import { useSearchPanelUIStore } from "../store/useSearchPanelUIStore";

import QueryProfilePanel from "./QueryProfilePanel";
import PartialResultPanel from "./PartialResultPanel";
import EmptyState from "./EmptyState";
import FieldPickerSidebar from "./FieldPickerSidebar";
import DataTable from "./visualizations/DataTable";
import DiscoverEditorPanel from "./DiscoverEditorPanel";
import { useDiscoverOrchestrator } from "./useDiscoverOrchestrator";

interface DiscoverPageProps {
  mode?: "query-lab" | "logs";
}

export default function DiscoverPage({ mode = "query-lab" }: DiscoverPageProps) {
  const o = useDiscoverOrchestrator(mode);
  const setDiscoverSearchCollapsed = o.setDiscoverSearchCollapsed;

  // Cmd/Ctrl+[ toggles the query panel collapse
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest("input, textarea, select, [contenteditable='true'], .cm-editor") ||
          target.getAttribute("role") === "textbox" ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "[" && !e.repeat) {
        e.preventDefault();
        setDiscoverSearchCollapsed(!useSearchPanelUIStore.getState().discoverSearchCollapsed);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setDiscoverSearchCollapsed]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        height: { md: "100%", xs: "auto" },
        minHeight: 0,
      }}
    >
      <DiscoverEditorPanel
        isLogsExplorer={o.isLogsExplorer}
        editorFocused={o.editorFocused}
        discoverEditorHeight={o.discoverEditorHeight}
        setDiscoverEditorHeight={o.setDiscoverEditorHeight}
        effectiveQuery={o.effectiveQuery}
        handleQueryChange={o.handleQueryChange}
        handleCreateEditor={o.handleCreateEditor}
        queryEditorExtensions={o.queryEditorExtensions}
        basicSetup={o.basicSetup}
        themeMode={o.themeMode}
        loading={o.loading}
        activeStep={o.activeStep}
        stepDurationsMs={o.stepDurationsMs}
        handleRunQuery={o.handleRunQuery}
        handleRunStep={o.handleRunStep}
        profileMode={o.profileMode}
        setProfileMode={o.setProfileMode}
        handleFormatQuery={o.handleFormatQuery}
        handleCreatePanel={o.handleCreatePanel}
        hasPendingRunChanges={o.hasPendingRunChanges}
        collapsed={o.discoverSearchCollapsed}
        onToggleCollapsed={() => o.setDiscoverSearchCollapsed(!o.discoverSearchCollapsed)}
        queryHistory={o.queryHistory}
        historyAnchor={o.historyAnchor}
        setHistoryAnchor={o.setHistoryAnchor}
        handleSelectHistory={o.handleSelectHistory}
      />

      {o.error && <Alert severity="error">{o.error}</Alert>}
      {o.result && o.lastRunDurationMs !== null && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          <Chip size="small" label={`took ${o.lastRunDurationMs} ms`} />
        </Box>
      )}
      {o.result && o.lastRunIsPartial && o.lastRunPartialMetadata !== null && (
        <PartialResultPanel
          metadata={o.lastRunPartialMetadata}
          onRerunHealthyClusters={o.handleRerunHealthyClusters}
        />
      )}
      {o.lastRunProfile !== null && <QueryProfilePanel profile={o.lastRunProfile} />}

      {/* Content area: field picker + table */}
      <Box
        sx={{
          display: "flex",
          flex: { md: 1, xs: "initial" },
          flexDirection: { md: "row", xs: "column" },
          gap: 1,
          minHeight: { md: 0, xs: "initial" },
          overflow: { md: "hidden", xs: "visible" },
        }}
      >
        <FieldPickerSidebar
          columns={o.columns}
          selectedFields={o.selectedFields}
          onToggleField={o.toggleField}
          fieldFilter={o.fieldFilter}
          onFieldFilterChange={o.setFieldFilter}
          onSelectVisible={o.selectVisibleFields}
          onDeselectVisible={o.deselectVisibleFields}
          visibleColumns={o.visibleColumns}
          expandedInsight={o.expandedInsight}
          insightsCache={o.insightsCache}
          onToggleInsight={o.handleToggleInsight}
        />

        {/* Results table */}
        <Paper
          variant="outlined"
          sx={{
            flex: 1,
            minHeight: { md: 0, xs: 320 },
            maxHeight: { md: "none", xs: "55vh" },
            overflow: "auto",
          }}
        >
          {!o.result && !o.loading && (
            <EmptyState
              icon={<TableChartIcon sx={{ mb: 0.5, color: "text.secondary", fontSize: 48 }} />}
              heading="No results yet"
              description={
                o.isLogsExplorer
                  ? "Write or refine a logs ES|QL query above and press Ctrl/Cmd+Enter to run it."
                  : "Write an ES|QL query above and press Ctrl/Cmd+Enter to run it."
              }
              addDataHref="/add-data"
              action={
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<PlayArrowIcon />}
                  onClick={o.handleRunQuery}
                  disabled={!o.effectiveQuery.trim()}
                >
                  Run starter query
                </Button>
              }
            />
          )}
          {o.loading && !o.result && (
            <Box sx={{ p: 2 }}>
              <Skeleton variant="rectangular" height={36} sx={{ mb: 1, borderRadius: 1 }} />
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} variant="text" height={28} sx={{ mb: 0.5 }} />
              ))}
            </Box>
          )}
          {o.filteredResult && o.filteredResult.columns.length > 0 && (
            <DataTable
              key={o.tableVersion}
              data={o.filteredResult}
              onExportCsv={o.handleExportCsv}
              onRemoveColumn={o.toggleField}
              currentSort={o.currentSort}
              onSortChange={o.handleSortChange}
            />
          )}
          {o.filteredResult && o.filteredResult.columns.length === 0 && o.result && (
            <EmptyState
              icon={<TableChartIcon sx={{ mb: 0.5, color: "text.secondary", fontSize: 48 }} />}
              heading="No fields selected"
              description="Check the field picker to show columns."
            />
          )}
        </Paper>
      </Box>
    </Box>
  );
}
