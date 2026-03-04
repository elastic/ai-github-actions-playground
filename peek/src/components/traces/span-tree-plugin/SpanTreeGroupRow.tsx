/**
 * Collapsed group summary row in the span tree viewer.
 * Shows count badge and aggregate stats for a run of identical siblings.
 */
import React from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import { alpha } from "@mui/material/styles";

import { formatSpanDuration } from "../traceUtils";
import { getServiceColor } from "../traceColors";

import type { GroupStats } from "./spanTreeTypes";

interface SpanTreeGroupRowProps {
  groupKey: string;
  representativeSpanId: string;
  isTraceRootGroup: boolean;
  depth: number;
  stats: GroupStats;
  expanded: boolean;
  onToggle: (groupKey: string) => void;
  onClick: (spanId: string) => void;
  timelineOffset?: number | null;
  timelineFraction: number;
  showTimeline?: boolean;
}

const ROW_HEIGHT = 32;
const INDENT_PX = 24;
const CONTROL_SLOT_WIDTH = 44;

export const SpanTreeGroupRow = React.memo(function SpanTreeGroupRow({
  groupKey,
  representativeSpanId,
  isTraceRootGroup,
  depth,
  stats,
  expanded,
  onToggle,
  onClick,
  timelineOffset,
  timelineFraction,
  showTimeline = true,
}: SpanTreeGroupRowProps) {
  const serviceColor = getServiceColor(stats.serviceName);
  const showDurationBar = showTimeline && !isTraceRootGroup;

  return (
    <ButtonBase
      component="div"
      role="button"
      aria-label="Open grouped span details"
      tabIndex={0}
      onClick={() => {
        if (representativeSpanId) onClick(representativeSpanId);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (representativeSpanId) onClick(representativeSpanId);
        }
      }}
      sx={{
        position: "relative",
        display: "flex",
        justifyContent: "flex-start",
        alignItems: "center",
        width: "100%",
        height: ROW_HEIGHT,
        pl: `${depth * INDENT_PX}px`,
        borderLeft: stats.errorCount > 0 ? "3px solid" : "3px solid transparent",
        borderLeftColor: stats.errorCount > 0 ? "error.main" : "transparent",
        bgcolor: (theme) => alpha(theme.palette.action.hover, 0.02),
        "&::before":
          depth > 0
            ? {
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: `${depth * INDENT_PX}px`,
                backgroundImage: (theme) =>
                  `repeating-linear-gradient(to right, transparent, transparent 23px, ${alpha(theme.palette.divider, 0.8)} 23px, ${alpha(theme.palette.divider, 0.8)} 24px)`,
                pointerEvents: "none",
                content: '""',
              }
            : undefined,
        "&:hover": { bgcolor: (theme) => alpha(theme.palette.action.hover, 0.06) },
      }}
    >
      {/* Count badge doubles as expand affordance */}
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
        <Chip
          label={`x${stats.count}`}
          aria-label={expanded ? "Collapse grouped spans" : "Expand grouped spans"}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(groupKey);
          }}
          size="small"
          variant="outlined"
          sx={{
            minWidth: 34,
            height: 18,
            fontWeight: 700,
            fontSize: "0.65rem",
            "& .MuiChip-label": {
              px: 1,
            },
          }}
        />
      </Box>

      {/* Status dot */}
      <Box
        sx={{
          flexShrink: 0,
          width: 8,
          height: 8,
          mr: 1,
          borderRadius: "50%",
          bgcolor: stats.errorCount > 0 ? "error.main" : "success.main",
        }}
      />

      {/* Service pill */}
      <Tooltip title={stats.serviceName} enterDelay={500}>
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
          {stats.serviceName}
        </Box>
      </Tooltip>

      {/* Operation name with count */}
      <Typography variant="caption" noWrap sx={{ flex: "1 1 0", minWidth: 60, mr: 0.5 }}>
        {stats.operationName}
      </Typography>

      {/* Error count badge */}
      {stats.errorCount > 0 && (
        <Chip
          label={`${stats.errorCount} err`}
          size="small"
          color="error"
          variant="outlined"
          sx={{
            height: 18,
            mr: 0.5,
            fontWeight: 700,
            fontSize: "0.65rem",
            "& .MuiChip-label": { px: 0.5 },
          }}
        />
      )}

      {/* Child groups keep timeline context; root traces stay clean */}
      {showDurationBar && (
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
                left:
                  timelineOffset != null ? `${Math.min(Math.max(timelineOffset, 0), 1) * 100}%` : 0,
                width: `${Math.min(Math.max(timelineFraction * 100, 0.5), 100)}%`,
                height: "100%",
                borderRadius: 0.5,
                bgcolor: alpha(serviceColor, 0.5),
              }}
            />
          </Box>
        </Box>
      )}

      {/* Total duration text */}
      <Typography
        variant="caption"
        sx={{ flexShrink: 0, width: 72, mr: 1, textAlign: "right", fontFamily: "monospace" }}
      >
        {formatSpanDuration(stats.totalDurationUs)}
      </Typography>
    </ButtonBase>
  );
});
