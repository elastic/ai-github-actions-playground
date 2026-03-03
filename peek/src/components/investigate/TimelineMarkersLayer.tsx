import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import type { TimelineMarker } from "./investigateUtils";

const SEVERITY_COLOR: Record<TimelineMarker["severity"], string> = {
  info: "#0065FF",
  warning: "#FFAB00",
  critical: "#DE350B",
};

interface PositionedTimelineMarker extends TimelineMarker {
  pct: number;
}

interface TimelineMarkersLayerProps {
  markers: PositionedTimelineMarker[];
  fmtTime: (iso: string) => string;
}

export default function TimelineMarkersLayer({ markers, fmtTime }: TimelineMarkersLayerProps) {
  return markers.map((m, i) => (
    <Tooltip
      key={i}
      describeChild
      title={
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {m.label}
          </Typography>
          <Typography variant="caption" display="block">
            {fmtTime(m.timestamp)}
          </Typography>
          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
            {m.description}
          </Typography>
        </Box>
      }
      arrow
      placement="top"
    >
      <Box
        component="button"
        type="button"
        aria-label={`${m.label}. ${fmtTime(m.timestamp)}. ${m.description}`}
        sx={{
          all: "unset",
          position: "absolute",
          top: 4,
          left: `${m.pct}%`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          cursor: "default",
          transform: "translateX(-50%)",
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: "primary.main",
            borderRadius: 0.5,
          },
        }}
      >
        <Box
          sx={{
            zIndex: 1,
            width: 12,
            height: 12,
            boxShadow: 1,
            border: "2px solid",
            borderColor: "background.paper",
            borderRadius: "50%",
            bgcolor: SEVERITY_COLOR[m.severity],
          }}
        />
        <Box sx={{ width: 2, height: 12, bgcolor: SEVERITY_COLOR[m.severity] }} />
        <Typography
          variant="caption"
          sx={{
            maxWidth: 80,
            overflow: "hidden",
            color: "text.secondary",
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            fontSize: "0.625rem",
          }}
        >
          {m.label}
        </Typography>
      </Box>
    </Tooltip>
  ));
}
