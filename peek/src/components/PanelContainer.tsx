import { memo, useCallback } from "react";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

import { useDashboardEditorStore } from "../store/useDashboardEditorStore";
import { useUIStore } from "../store/useUIStore";
import { usePanelData } from "../hooks/usePanelData";
import type { PanelDefinition, EsqlResponse } from "../types";

import ContentSkeleton from "./ContentSkeleton";
import ErrorBoundary from "./ErrorBoundary";
import PersesPanelRenderer from "./perses/PersesPanelRenderer";
import { getPersesPanelCapabilities } from "./perses/panelRegistry";
import PanelToolbar from "./PanelToolbar";

interface Props {
  panel: PanelDefinition;
}

export default memo(function PanelContainer({ panel }: Props) {
  const duplicatePanel = useDashboardEditorStore((s) => s.duplicatePanel);
  const setEditingPanelId = useUIStore((s) => s.setEditingPanelId);

  const { supportsQuery, supportsImageExport } = getPersesPanelCapabilities(panel.visualization);

  const {
    connection,
    timeRange,
    timeZone,
    parameters,
    data,
    loading,
    error,
    executionTimeMs,
    lastRefreshAt,
    exportImage,
    supportsCSVExport,
    fetchData,
    handleExportImage,
    handleExportCsv,
    handleExportReady,
  } = usePanelData(panel, supportsQuery, supportsImageExport);

  const handleDuplicate = useCallback(() => {
    const newId = duplicatePanel(panel.id);
    if (newId) setEditingPanelId(newId);
  }, [duplicatePanel, panel.id, setEditingPanelId]);

  const handleEdit = useCallback(() => {
    setEditingPanelId(panel.id);
  }, [setEditingPanelId, panel.id]);

  return (
    <Paper
      elevation={0}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        transition: "border-color 0.2s",
        "&:hover": { borderColor: "border.strong" },
      }}
    >
      <PanelToolbar
        title={panel.title}
        loading={loading}
        error={error}
        data={data}
        executionTimeMs={executionTimeMs}
        lastRefreshAt={lastRefreshAt}
        exportImage={exportImage}
        supportsQuery={supportsQuery}
        supportsImageExport={supportsImageExport}
        supportsCSVExport={supportsCSVExport}
        onRefresh={fetchData}
        onExportImage={handleExportImage}
        onExportCsv={handleExportCsv}
        onDuplicate={handleDuplicate}
        onEdit={handleEdit}
      />

      <Box sx={{ position: "relative", flex: 1, overflow: "auto", p: 1 }}>
        {!supportsQuery ? (
          <ErrorBoundary>
            <PersesPanelRenderer
              type={panel.visualization}
              query={panel.query}
              data={{ columns: [], values: [] } as EsqlResponse}
              options={panel.options}
              connection={connection}
              timeRange={timeRange}
              parameters={parameters}
              timeZone={timeZone}
            />
          </ErrorBoundary>
        ) : error ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              color: "error.main",
            }}
          >
            <ErrorOutlineIcon />
            <Typography variant="caption" color="error" textAlign="center">
              {error}
            </Typography>
          </Box>
        ) : loading && !data ? (
          <ContentSkeleton variant="chart" />
        ) : data ? (
          <ErrorBoundary>
            <PersesPanelRenderer
              type={panel.visualization}
              data={data}
              options={panel.options}
              onExportReady={handleExportReady}
              onExportCsv={supportsCSVExport ? handleExportCsv : undefined}
              timeZone={timeZone}
            />
          </ErrorBoundary>
        ) : (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              No data
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
});
