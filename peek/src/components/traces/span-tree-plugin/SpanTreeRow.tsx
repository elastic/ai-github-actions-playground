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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { alpha } from "@mui/material/styles";

import type { SpanTreeNode } from "../traceUtils";
import { formatSpanDuration, formatStatusLabel, isErrorStatus } from "../traceUtils";
import { getServiceColor } from "../traceColors";

interface SpanTreeRowProps {
  node: SpanTreeNode;
  isTraceRoot: boolean;
  expanded: boolean;
  hasChildren: boolean;
  selected: boolean;
  onToggle: (spanId: string) => void;
  onClick: (spanId: string) => void;
  timelineOffset?: number | null;
  timelineFraction: number;
  showTimeline?: boolean;
  showTimestamp?: boolean;
}

const ROW_HEIGHT = 32;
const INDENT_PX = 24;
const CONTROL_SLOT_WIDTH = 44;

export const SpanTreeRow = React.memo(function SpanTreeRow({
  node,
  isTraceRoot,
  expanded,
  hasChildren,
  selected,
  onToggle,
  onClick,
  timelineOffset,
  timelineFraction,
  showTimeline = true,
  showTimestamp,
}: SpanTreeRowProps) {
  const { span } = node;
  const serviceColor = getServiceColor(span.serviceName);
  const isError = isErrorStatus(span.status);
  const showDurationBar = showTimeline && !isTraceRoot;
  const clampedOffset = Math.min(Math.max(timelineOffset ?? 0, 0), 1);
  const availableFraction = Math.max(0, 1 - clampedOffset);
  const clampedFraction = Math.min(Math.max(timelineFraction, 0), availableFraction);
  const rawWidthPct = clampedFraction * 100;
  const maxWidthPct = availableFraction * 100;
  const widthPct =
    maxWidthPct === 0 ? 0 : Math.min(Math.max(rawWidthPct, rawWidthPct > 0 ? 0.5 : 0), maxWidthPct);

  return (
    <ButtonBase
      component="div"
      role="listitem"
      data-spanid={span.spanId}
      onClick={() => onClick(span.spanId)}
      sx={{
        position: "relative",
        display: "flex",
        justifyContent: "flex-start",
        alignItems: "center",
        width: "100%",
        height: ROW_HEIGHT,
        pl: `${Math.max(node.depth * INDENT_PX, 0)}px`,
        borderLeft: isError ? "3px solid" : "3px solid transparent",
        borderLeftColor: isError ? "error.main" : "transparent",
        bgcolor: selected ? (theme) => alpha(theme.palette.primary.main, 0.1) : "transparent",
        "&::before":
          node.depth > 0
            ? {
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: `${node.depth * INDENT_PX}px`,
                backgroundImage: (theme) =>
                  `repeating-linear-gradient(to right, transparent, transparent 23px, ${alpha(theme.palette.divider, 0.8)} 23px, ${alpha(theme.palette.divider, 0.8)} 24px)`,
                pointerEvents: "none",
                content: '""',
              }
            : undefined,
        "&:hover": {
          bgcolor: (theme) =>
            selected
              ? alpha(theme.palette.primary.main, 0.15)
              : alpha(theme.palette.action.hover, 0.04),
        },
      }}
    >
      {/* Chevron */}
      <Box
        sx={{
          display: "flex",
          flexShrink: 0,
          justifyContent: "center",
          alignItems: "center",
          width: CONTROL_SLOT_WIDTH,
          height: 20,
        }}
      >
        {hasChildren ? (
          <IconButton
            size="small"
            aria-label={expanded ? `Collapse span ${span.name}` : `Expand span ${span.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(span.spanId);
            }}
            sx={{ flexShrink: 0, width: 20, height: 20, p: 0 }}
          >
            <ExpandMoreIcon
              sx={{
                color: "text.secondary",
                transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 0.15s",
                fontSize: 16,
              }}
            />
          </IconButton>
        ) : null}
      </Box>

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
            : formatStatusLabel(span.status) === "Unset"
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

      {/* Child spans keep timeline context; top-level trace rows stay clean */}
      {showDurationBar && (
        <Box sx={{ display: "flex", flexShrink: 0, alignItems: "center", width: 120, mr: 1 }}>
          <Box
            sx={{
              position: "relative",
              width: "100%",
              height: 6,
              overflow: "hidden",
              borderRadius: 0.5,
              bgcolor: "action.hover",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: `${clampedOffset * 100}%`,
                width: `${widthPct}%`,
                height: "100%",
                borderRadius: 0.5,
                bgcolor: isError ? "error.main" : serviceColor,
                opacity: 0.7,
              }}
            />
          </Box>
        </Box>
      )}

      {/* Duration text */}
      <Typography
        variant="caption"
        sx={{ flexShrink: 0, width: 72, mr: 1, textAlign: "right", fontFamily: "monospace" }}
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
