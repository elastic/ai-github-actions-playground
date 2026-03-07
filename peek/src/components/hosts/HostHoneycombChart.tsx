import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import MuiTooltip from "@mui/material/Tooltip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import type { HostRow } from "./hostTypes";

interface HostHoneycombChartProps {
  hostRows: HostRow[];
}

// Flat-top hexagon geometry
const CELL_W = 52; // px
const CELL_H = Math.round(CELL_W * Math.sqrt(3) / 2); // ≈ 45px
const GAP = 4; // px gap between cells
const COLS = 8; // cells per row

/** Returns a hex color interpolated from green -> yellow -> red based on value 0-1. */
function cpuColor(value: number | null): string {
  if (value == null) return "#6b7280";
  const clamped = Math.max(0, Math.min(1, value));
  if (clamped <= 0.5) {
    const t = clamped * 2;
    const r = Math.round(76 + (234 - 76) * t);
    const g = Math.round(175 + (179 - 175) * t);
    const b = Math.round(80 + (8 - 80) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const t = (clamped - 0.5) * 2;
  const r = Math.round(234 + (239 - 234) * t);
  const g = Math.round(179 + (68 - 179) * t);
  const b = Math.round(8 + (68 - 8) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function HexCell({ row }: { row: HostRow }) {
  const navigate = useNavigate();
  const cpu =
    row.cpuUtilization != null ? `${(row.cpuUtilization * 100).toFixed(1)}%` : "N/A";
  const mem =
    row.memoryUtilization != null ? `${(row.memoryUtilization * 100).toFixed(1)}%` : "N/A";

  return (
    <MuiTooltip
      title={
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 600, display: "block" }}>
            {row.hostName || row.hostId}
          </Typography>
          <Typography variant="caption" display="block">
            CPU: {cpu}
          </Typography>
          <Typography variant="caption" display="block">
            Memory: {mem}
          </Typography>
        </Box>
      }
      arrow
    >
      <Box
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/hosts/${encodeURIComponent(row.hostId)}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            navigate(`/hosts/${encodeURIComponent(row.hostId)}`);
          }
        }}
        sx={{
          width: CELL_W,
          height: CELL_H,
          flexShrink: 0,
          clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
          backgroundColor: cpuColor(row.cpuUtilization),
          cursor: "pointer",
          transition: "opacity 0.15s",
          "&:hover": { opacity: 0.75 },
          "&:focus-visible": { outline: "2px solid white", outlineOffset: 2 },
        }}
        aria-label={`${row.hostName || row.hostId}: CPU ${cpu}, Memory ${mem}`}
      />
    </MuiTooltip>
  );
}

export default function HostHoneycombChart({ hostRows }: HostHoneycombChartProps) {
  const rows = useMemo(() => {
    const result: HostRow[][] = [];
    for (let i = 0; i < hostRows.length; i += COLS) {
      result.push(hostRows.slice(i, i + COLS));
    }
    return result;
  }, [hostRows]);

  if (hostRows.length === 0) return null;

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Host Map
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Each cell is a host, colored by CPU utilization. Hover for details.
        </Typography>
        <Box sx={{ display: "flex", gap: 1, mt: 1, alignItems: "center" }}>
          <Typography variant="caption" color="text.secondary">
            CPU:
          </Typography>
          <Box
            sx={{
              width: 120,
              height: 10,
              borderRadius: 1,
              background: (t) =>
                `linear-gradient(to right, ${t.palette.success.main}, ${t.palette.warning.main}, ${t.palette.error.main})`,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            0%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            100%
          </Typography>
        </Box>
      </Box>
      <Box sx={{ p: 2 }}>
        {rows.map((rowHosts, rowIdx) => (
          <Box
            key={rowIdx}
            sx={{
              display: "flex",
              gap: `${GAP}px`,
              mb: `${GAP}px`,
              ml: rowIdx % 2 === 1 ? `${(CELL_W + GAP) / 2}px` : 0,
            }}
          >
            {rowHosts.map((host) => (
              <HexCell key={host.hostId} row={host} />
            ))}
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

