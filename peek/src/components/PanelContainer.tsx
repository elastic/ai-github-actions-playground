import { memo, useState, useEffect, useCallback, useRef } from "react";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { useShallow } from "zustand/react/shallow";

import { useDashboardEditorStore } from "../store/useDashboardEditorStore";
import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { isElasticsearchError } from "../services/es";
import {
  buildPersesEsqlRequest,
  createPersesEsqlDatasource,
} from "../services/perses/esqlDatasource";
import type { PanelDefinition, EsqlResponse } from "../types";
import { COMPONENT_HEIGHTS } from "../types/tokens";

import { toCsv } from "./discoverUtils";
import ContentSkeleton from "./ContentSkeleton";
import ErrorBoundary from "./ErrorBoundary";
import PersesPanelRenderer from "./perses/PersesPanelRenderer";
import { getPersesPanelEntry } from "./perses/panelRegistry";
import { formatMs, formatRowCount, formatTimeAgo } from "./panelBadgeUtils";

interface Props {
  panel: PanelDefinition;
}

export default memo(function PanelContainer({ panel }: Props) {
  const connection = useConnectionStore((s) => s.connection);
  const { timeRange, timeZone, parameters, duplicatePanel } = useDashboardEditorStore(
    useShallow((s) => ({
      timeRange: s.dashboard.timeRange,
      timeZone: s.dashboard.timeZone,
      parameters: s.dashboard.parameters,
      duplicatePanel: s.duplicatePanel,
    })),
  );
  const setEditingPanelId = useUIStore((s) => s.setEditingPanelId);

  const vizEntry = getPersesPanelEntry(panel.visualization);
  const supportsQuery = vizEntry?.supportsQuery ?? true;

  const [data, setData] = useState<EsqlResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [exportImage, setExportImage] = useState<(() => string) | null>(null);
  const [, setTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const supportsImageExport = vizEntry?.supportsImageExport ?? false;

  const supportsCSVExport = panel.visualization === "table";

  useEffect(() => {
    if (!supportsImageExport) {
      setExportImage(null);
    }
  }, [supportsImageExport]);

  const handleExportImage = useCallback(() => {
    if (!exportImage) return;
    const dataUrl = exportImage();
    if (!dataUrl) return;
    const safeTitle =
      panel.title
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "panel";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${safeTitle}-${timestamp}.png`;
    a.click();
  }, [exportImage, panel.title]);

  const handleExportReady = useCallback((exportFn: (() => string) | null) => {
    setExportImage(() => exportFn);
  }, []);

  const handleExportCsv = useCallback(() => {
    if (!data || data.columns.length === 0) return;
    const csv = toCsv(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const safeTitle =
      panel.title
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "panel";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}-${timestamp}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [data, panel.title]);

  const fetchData = useCallback(async () => {
    if (!supportsQuery) {
      abortRef.current?.abort();
      setLoading(false);
      setError(null);
      return;
    }
    if (!connection || !panel.query.trim()) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    try {
      const datasource = createPersesEsqlDatasource(connection);
      const body = buildPersesEsqlRequest(panel.query, { timeRange, parameters });
      const result = await datasource.execute(body, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setData(result);
        setExecutionTimeMs(result.executionTimeMs);
        setLastRefreshAt(new Date());
      }
    } catch (err) {
      if (!ctrl.signal.aborted) {
        setError(isElasticsearchError(err) ? err.message : String(err));
      }
    } finally {
      if (!ctrl.signal.aborted) {
        setLoading(false);
      }
    }
  }, [supportsQuery, connection, panel.query, timeRange, parameters]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  // Periodically re-render so the "X ago" label stays current.
  useEffect(() => {
    if (!lastRefreshAt) return;
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, [lastRefreshAt]);

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
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          minHeight: COMPONENT_HEIGHTS.button,
          py: 1,
          px: 1.5,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <DragIndicatorIcon
          className="panel-drag-handle"
          sx={{
            mr: 0.5,
            color: "text.secondary",
            opacity: 0.5,
            cursor: "grab",
            fontSize: 16,
            "&:hover": { opacity: 1 },
          }}
        />
        <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: 500 }}>
          {panel.title}
        </Typography>
        {loading && <CircularProgress size={14} sx={{ mr: 0.5 }} />}
        {supportsQuery && !loading && executionTimeMs !== null && data && lastRefreshAt && (
          <Tooltip title={`Refreshed at ${lastRefreshAt.toLocaleTimeString()}`}>
            <Typography
              component="span"
              variant="caption"
              sx={{
                mr: 0.5,
                py: 0,
                px: 1,
                borderRadius: 1,
                bgcolor: "action.hover",
                color: "text.secondary",
                cursor: "default",
                whiteSpace: "nowrap",
                fontSize: "0.65rem",
                fontFamily: "monospace",
              }}
            >
              {formatMs(executionTimeMs)} • {formatRowCount(data.values.length)} rows •{" "}
              {formatTimeAgo(lastRefreshAt)}
            </Typography>
          </Tooltip>
        )}
        {supportsQuery && !loading && error && (
          <Tooltip title={error}>
            <ErrorOutlineIcon sx={{ mr: 0.5, color: "error.main", fontSize: 14 }} />
          </Tooltip>
        )}
        {supportsImageExport && (
          <Tooltip title="Download PNG">
            <span>
              <IconButton
                size="small"
                onClick={handleExportImage}
                disabled={loading || !exportImage}
                aria-label="Download PNG"
              >
                <DownloadIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {supportsCSVExport && (
          <Tooltip title="Export CSV">
            <span>
              <IconButton
                size="small"
                onClick={handleExportCsv}
                disabled={loading || !data}
                aria-label="Export CSV"
              >
                <DownloadIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {supportsQuery && (
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={fetchData} disabled={loading} aria-label="Refresh">
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Duplicate panel">
          <IconButton
            size="small"
            aria-label="Duplicate panel"
            onClick={() => {
              const newId = duplicatePanel(panel.id);
              if (newId) setEditingPanelId(newId);
            }}
          >
            <ContentCopyIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit panel">
          <IconButton
            size="small"
            aria-label="Edit panel"
            onClick={() => setEditingPanelId(panel.id)}
          >
            <EditIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

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
