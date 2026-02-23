import { useState, useEffect, useCallback, useRef } from "react";
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

import { useDashboardStore } from "../store/useDashboardStore";
import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import type { EsqlQueryParams } from "../services/es";
import { buildQueryParams } from "../services/datemath";
import type { PanelDefinition, EsqlResponse } from "../types";

import Visualization from "./visualizations/Visualization";
import { getVizEntry } from "./visualizations/vizRegistry";
import { formatMs, formatRowCount, formatTimeAgo } from "./panelBadgeUtils";

interface Props {
  panel: PanelDefinition;
}

export default function PanelContainer({ panel }: Props) {
  const connection = useConnectionStore((s) => s.connection);
  const { timeRange, parameters, duplicatePanel } = useDashboardStore(
    useShallow((s) => ({
      timeRange: s.dashboard.timeRange,
      parameters: s.dashboard.parameters,
      duplicatePanel: s.duplicatePanel,
    })),
  );
  const setEditingPanelId = useUIStore((s) => s.setEditingPanelId);

  const vizEntry = getVizEntry(panel.visualization);
  const supportsQuery = vizEntry?.supportsQuery ?? true;

  const [data, setData] = useState<EsqlResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [exportImage, setExportImage] = useState<(() => string) | null>(null);
  const [, setTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const supportsImageExport =
    panel.visualization === "timeseries" ||
    panel.visualization === "bar" ||
    panel.visualization === "gauge" ||
    panel.visualization === "pie";

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
      const client = new ElasticsearchClient(connection);
      const query = panel.query.trim();
      const body: EsqlQueryParams = { query };
      if (timeRange) {
        body.filter = {
          range: {
            "@timestamp": {
              gte: timeRange.from,
              lte: timeRange.to,
            },
          },
        };
        const queryParams = buildQueryParams(query, timeRange, parameters);
        if (queryParams.length > 0) {
          body.params = queryParams;
        }
      }
      const result = await client.query(body, ctrl.signal);
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
      elevation={1}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 2,
        transition: "box-shadow 0.2s",
        "&:hover": { boxShadow: 4 },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 1.5,
          py: 0.75,
          borderBottom: 1,
          borderColor: "divider",
          minHeight: 36,
        }}
      >
        <DragIndicatorIcon
          className="panel-drag-handle"
          sx={{
            fontSize: 16,
            color: "text.secondary",
            cursor: "grab",
            mr: 0.5,
            opacity: 0.5,
            "&:hover": { opacity: 1 },
          }}
        />
        <Typography variant="subtitle2" noWrap sx={{ flex: 1, fontWeight: 500 }}>
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
                px: 0.75,
                py: 0.125,
                borderRadius: 1,
                bgcolor: "action.hover",
                fontFamily: "monospace",
                fontSize: "0.65rem",
                whiteSpace: "nowrap",
                color: "text.secondary",
                cursor: "default",
              }}
            >
              {formatMs(executionTimeMs)} • {formatRowCount(data.values.length)} rows •{" "}
              {formatTimeAgo(lastRefreshAt)}
            </Typography>
          </Tooltip>
        )}
        {supportsQuery && !loading && error && (
          <Tooltip title={error}>
            <ErrorOutlineIcon sx={{ fontSize: 14, color: "error.main", mr: 0.5 }} />
          </Tooltip>
        )}
        {supportsImageExport && (
          <Tooltip title="Download PNG">
            <span>
              <IconButton
                size="small"
                onClick={handleExportImage}
                disabled={loading || !exportImage}
              >
                <DownloadIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {supportsQuery && (
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={fetchData} disabled={loading}>
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Duplicate panel">
          <IconButton
            size="small"
            onClick={() => {
              const newId = duplicatePanel(panel.id);
              if (newId) setEditingPanelId(newId);
            }}
          >
            <ContentCopyIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit panel">
          <IconButton size="small" onClick={() => setEditingPanelId(panel.id)}>
            <EditIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ flex: 1, overflow: "auto", position: "relative", p: 1 }}>
        {!supportsQuery ? (
          <Visualization
            type={panel.visualization}
            query={panel.query}
            data={{ columns: [], values: [] } as EsqlResponse}
            options={panel.options}
            connection={connection}
            timeRange={timeRange}
            parameters={parameters}
          />
        ) : error ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 1,
              color: "error.main",
            }}
          >
            <ErrorOutlineIcon />
            <Typography variant="caption" color="error" textAlign="center">
              {error}
            </Typography>
          </Box>
        ) : loading && !data ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <CircularProgress size={32} />
          </Box>
        ) : data ? (
          <Visualization
            type={panel.visualization}
            data={data}
            options={panel.options}
            onExportReady={handleExportReady}
          />
        ) : (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
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
}
