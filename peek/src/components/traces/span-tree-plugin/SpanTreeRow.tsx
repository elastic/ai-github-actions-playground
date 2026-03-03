/**
 * Single span row in the span tree viewer.
 * 32px fixed height, memoized for virtualization performance.
 */
import React from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { alpha } from "@mui/material/styles";

import type { SpanTreeNode } from "../traceUtils";
import { formatSpanDuration, isErrorStatus } from "../traceUtils";
import { getServiceColor } from "../traceColors";

interface SpanTreeRowProps {
  node: SpanTreeNode;
  expanded: boolean;
  hasChildren: boolean;
  selected: boolean;
  onToggle: (spanId: string) => void;
  onClick: (spanId: string) => void;
  timelineOffset?: number | null;
  timelineFraction: number;
  showTimestamp?: boolean;
}

const ROW_HEIGHT = 32;
const INDENT_PX = 20;

export const SpanTreeRow = React.memo(function SpanTreeRow({
  node,
  expanded,
  hasChildren,
  selected,
  onToggle,
  onClick,
  timelineOffset,
  timelineFraction,
  showTimestamp,
}: SpanTreeRowProps) {
  const { span } = node;
  const serviceColor = getServiceColor(span.serviceName);
  const isError = isErrorStatus(span.status);

  return (
    <ButtonBase
      role="row"
      data-spanid={span.spanId}
      onClick={() => onClick(span.spanId)}
      sx={{
        display: "flex",
        justifyContent: "flex-start",
        alignItems: "center",
        width: "100%",
        height: ROW_HEIGHT,
        pl: `${node.depth * INDENT_PX}px`,
        borderLeft: isError ? "3px solid" : "3px solid transparent",
        borderLeftColor: isError ? "error.main" : "transparent",
        bgcolor: selected ? (theme) => alpha(theme.palette.primary.main, 0.1) : "transparent",
        "&:hover": {
          bgcolor: (theme) =>
            selected
              ? alpha(theme.palette.primary.main, 0.15)
              : alpha(theme.palette.action.hover, 0.04),
        },
      }}
    >
      {/* Chevron */}
      {hasChildren ? (
        <IconButton
          size="small"
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(span.spanId);
          }}
          sx={{ flexShrink: 0, width: 20, height: 20, p: 0 }}
        >
          <ChevronRightIcon
            sx={{
              color: "text.secondary",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
              fontSize: 16,
            }}
          />
        </IconButton>
      ) : (
        <Box sx={{ flexShrink: 0, width: 20, height: 20 }} />
      )}

      {/* Status dot */}
      <Box
        sx={{
          flexShrink: 0,
          width: 8,
          height: 8,
          mr: 1,
          borderRadius: "50%",
          bgcolor: isError
            ? "error.main"
            : span.status === "Unset"
              ? "text.disabled"
              : "success.main",
        }}
      />

      {/* Service pill */}
      <Tooltip title={span.serviceName} enterDelay={500}>
        <Box
          component="span"
          sx={{
            display: "inline-block",
            flexShrink: 0,
            maxWidth: 120,
            overflow: "hidden",
            mr: 1,
            px: 1,
            borderRadius: 0.5,
            bgcolor: alpha(serviceColor, 0.15),
            color: serviceColor,
            lineHeight: 1.4,
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            fontWeight: 600,
            fontSize: "0.7rem",
          }}
        >
          {span.serviceName}
        </Box>
      </Tooltip>

      {/* Operation name */}
      <Typography
        variant="caption"
        noWrap
        sx={{ flex: "1 1 0", minWidth: 60, mr: 1, fontWeight: selected ? 600 : 400 }}
      >
        {span.name}
      </Typography>

      {/* Duration bar */}
      <Box sx={{ display: "flex", flexShrink: 0, alignItems: "center", width: 120, mr: 1 }}>
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: 6,
            borderRadius: 0.5,
            bgcolor: "action.hover",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: timelineOffset != null ? `${timelineOffset * 100}%` : 0,
              width: `${Math.max(timelineFraction * 100, 0.5)}%`,
              height: "100%",
              borderRadius: 0.5,
              bgcolor: isError ? "error.main" : serviceColor,
              opacity: 0.7,
            }}
          />
        </Box>
      </Box>

      {/* Duration text */}
      <Typography
        variant="caption"
        sx={{ flexShrink: 0, width: 64, mr: 1, textAlign: "right", fontFamily: "monospace" }}
      >
        {formatSpanDuration(span.durationUs)}
      </Typography>

      {/* Timestamp */}
      {showTimestamp && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            flexShrink: 0,
            width: 80,
            textAlign: "right",
            fontSize: "0.65rem",
            fontFamily: "monospace",
          }}
        >
          {span.timestamp ? new Date(span.timestamp).toLocaleTimeString() : "—"}
        </Typography>
      )}
    </ButtonBase>
  );
});
