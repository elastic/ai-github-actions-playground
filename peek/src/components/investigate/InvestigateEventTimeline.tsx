import { useMemo } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import type { TimelineEvent, TimelineMarker } from "./investigateUtils";
import TimelineMarkersLayer from "./TimelineMarkersLayer";

interface InvestigateEventTimelineProps {
  events: TimelineEvent[];
  markers: TimelineMarker[];
  markersLoading: boolean;
}

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

  const eventTicks = useMemo(() => {
    if (!Number.isFinite(minMs)) return [];
    return events.flatMap((e) => {
      const ms = Date.parse(e.timestamp);
      return Number.isFinite(ms) ? [toPercent(e.timestamp, minMs, range)] : [];
    });
  }, [events, minMs, range]);

  const positionedMarkers = useMemo(() => {
    if (!Number.isFinite(minMs)) return [];
    return markers.flatMap((m) => {
      const ms = Date.parse(m.timestamp);
      return Number.isFinite(ms) ? [{ ...m, pct: toPercent(m.timestamp, minMs, range) }] : [];
    });
  }, [markers, minMs, range]);
  const isSingleTimestampRange =
    Number.isFinite(minMs) && Number.isFinite(maxMs) && minMs === maxMs;

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
        {[...eventTicks.entries()].map(([tickIdx, pct]) => (
          <Box
            key={`${pct}-${tickIdx}`}
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

        <TimelineMarkersLayer markers={positionedMarkers} fmtTime={fmtTime} />
      </Box>

      {/* axis labels */}
      {isSingleTimestampRange ? (
        <Box sx={{ display: "flex", justifyContent: "center", mx: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {fmtTime(new Date(minMs).toISOString())}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", justifyContent: "space-between", mx: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {Number.isFinite(minMs) ? fmtTime(new Date(minMs).toISOString()) : "—"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {Number.isFinite(maxMs) ? fmtTime(new Date(maxMs).toISOString()) : "—"}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
