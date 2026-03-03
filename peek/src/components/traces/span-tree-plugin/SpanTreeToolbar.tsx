/**
 * Toolbar above the span tree — mode-specific controls.
 */
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { copyToClipboard } from "../../../utils/copyToClipboard";
import { COMPONENT_HEIGHTS } from "../../../types/tokens";

interface SpanTreeToolbarProps {
  searchMode: boolean;
  spanCount: number;
  traceId?: string | null;
  onBack?: () => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  onOpenInQueryLab?: () => void;
}

export default function SpanTreeToolbar({
  searchMode,
  spanCount,
  traceId,
  onBack,
  onExpandAll,
  onCollapseAll,
  onOpenInQueryLab,
}: SpanTreeToolbarProps) {
  if (searchMode) {
    return (
      <Box
        sx={{
          display: "flex",
          gap: 1,
          alignItems: "center",
          minHeight: COMPONENT_HEIGHTS.tableRow,
          py: 0.5,
          px: 1.5,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Chip label={`${spanCount} traces`} size="small" variant="outlined" />
      </Box>
    );
  }

  const truncatedTraceId = traceId ? `${traceId.slice(0, 8)}...${traceId.slice(-4)}` : "";

  return (
    <Box
      sx={{
        display: "flex",
        gap: 0.5,
        alignItems: "center",
        minHeight: COMPONENT_HEIGHTS.tableRow,
        py: 0.5,
        px: 1,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      {onBack && (
        <Tooltip title="Back to search results">
          <IconButton size="small" aria-label="Back to search results" onClick={onBack}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {traceId && (
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          <Tooltip title={traceId}>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", fontSize: "0.7rem", fontFamily: "monospace" }}
            >
              {truncatedTraceId}
            </Typography>
          </Tooltip>
          <Tooltip title="Copy trace ID">
            <IconButton
              size="small"
              aria-label="Copy trace ID"
              onClick={() => void copyToClipboard(traceId)}
            >
              <ContentCopyIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Chip label={`${spanCount} spans`} size="small" variant="outlined" />

      <Box sx={{ flex: 1 }} />

      {onExpandAll && (
        <Tooltip title="Expand all">
          <IconButton size="small" aria-label="Expand all" onClick={onExpandAll}>
            <UnfoldMoreIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {onCollapseAll && (
        <Tooltip title="Collapse all">
          <IconButton size="small" aria-label="Collapse all" onClick={onCollapseAll}>
            <UnfoldLessIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {onOpenInQueryLab && (
        <Button size="small" variant="text" onClick={onOpenInQueryLab}>
          Open in Query Lab
        </Button>
      )}
    </Box>
  );
}
