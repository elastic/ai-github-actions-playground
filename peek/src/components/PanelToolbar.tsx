import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import ImageIcon from "@mui/icons-material/Image";
import RefreshIcon from "@mui/icons-material/Refresh";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import TableChartIcon from "@mui/icons-material/TableChart";

import type { EsqlResponse } from "../types";
import { COMPONENT_HEIGHTS } from "../types/tokens";

import { formatMs, formatRowCount, formatTimeAgo } from "./panelBadgeUtils";

interface Props {
  title: string;
  loading: boolean;
  error: string | null;
  data: EsqlResponse | null;
  executionTimeMs: number | null;
  lastRefreshAt: Date | null;
  exportImage: (() => string) | null;
  supportsQuery: boolean;
  supportsImageExport: boolean;
  supportsCSVExport: boolean;
  onRefresh: () => void;
  onExportImage: () => void;
  onExportCsv: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
}

export default function PanelToolbar({
  title,
  loading,
  error,
  data,
  executionTimeMs,
  lastRefreshAt,
  exportImage,
  supportsQuery,
  supportsImageExport,
  supportsCSVExport,
  onRefresh,
  onExportImage,
  onExportCsv,
  onDuplicate,
  onEdit,
}: Props) {
  return (
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
        aria-label="Drag to reorder panel"
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
        {title}
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
              onClick={onExportImage}
              disabled={loading || !exportImage}
              aria-label="Download PNG"
            >
              <ImageIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>
      )}
      {supportsCSVExport && (
        <Tooltip title="Export CSV">
          <span>
            <IconButton
              size="small"
              onClick={onExportCsv}
              disabled={loading || !data}
              aria-label="Export CSV"
            >
              <TableChartIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>
      )}
      {supportsQuery && (
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={onRefresh} disabled={loading} aria-label="Refresh">
            <RefreshIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Duplicate panel">
        <IconButton size="small" aria-label="Duplicate panel" onClick={onDuplicate}>
          <ContentCopyIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Edit panel">
        <IconButton size="small" aria-label="Edit panel" onClick={onEdit}>
          <EditIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
