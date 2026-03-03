import { useMemo } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import type { TimelineEvent, TimelineMarker } from "./investigateUtils";

interface InvestigateEventTimelineProps {
  events: TimelineEvent[];
  markers: TimelineMarker[];
  markersLoading: boolean;
}

const SEVERITY_COLOR: Record<TimelineMarker["severity"], string> = {
  info: "#0065FF",
  warning: "#FFAB00",
  critical: "#DE350B",
};

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

function toPercent(iso: string, minMs: number, range: number) {
  const pct = ((new Date(iso).getTime() - minMs) / range) * 100;
  return Math.max(0, Math.min(100, pct));
}

/**
 * Horizontal left-to-right timeline that plots raw events as small ticks and
 * overlays LLM-identified markers with coloured dots and labels.
 */
export default function InvestigateEventTimeline({
  events,
  markers,
  markersLoading,
}: InvestigateEventTimelineProps) {
  const { minMs, maxMs, range } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const e of events) {
      const t = new Date(e.timestamp).getTime();
      if (Number.isFinite(t)) {
        if (t < min) min = t;
        if (t > max) max = t;
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { minMs: NaN, maxMs: NaN, range: 1 };
    }
    return { minMs: min, maxMs: max, range: Math.max(1, max - min) };
  }, [events]);

  const eventTicks = useMemo(
    () => events.map((e) => toPercent(e.timestamp, minMs, range)),
    [events, minMs, range],
  );

  const positionedMarkers = useMemo(
    () => markers.map((m) => ({ ...m, pct: toPercent(m.timestamp, minMs, range) })),
    [markers, minMs, range],
  );

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }} aria-label="Event timeline">
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Event timeline
        </Typography>
        {markersLoading && <CircularProgress size={14} />}
      </Box>

      {/* timeline track */}
      <Box sx={{ position: "relative", height: 56, mx: 1 }}>
        {/* horizontal line */}
        <Box
          sx={{
            position: "absolute",
            top: 28,
            right: 0,
            left: 0,
            height: 2,
            borderRadius: 1,
            bgcolor: "divider",
          }}
        />

        {/* event tick marks */}
        {eventTicks.map((pct, i) => (
          <Box
            key={i}
            sx={{
              position: "absolute",
              top: 24,
              left: `${pct}%`,
              width: 4,
              height: 10,
              borderRadius: "2px",
              bgcolor: "action.disabled",
              transform: "translateX(-2px)",
            }}
          />
        ))}

        {/* LLM markers */}
        {positionedMarkers.map((m, i) => (
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
        ))}
      </Box>

      {/* axis labels */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mx: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {Number.isFinite(minMs) ? fmtTime(new Date(minMs).toISOString()) : "—"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {Number.isFinite(maxMs) ? fmtTime(new Date(maxMs).toISOString()) : "—"}
        </Typography>
      </Box>
    </Paper>
  );
}
