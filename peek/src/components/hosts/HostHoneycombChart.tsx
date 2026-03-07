import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { EChart } from "../perses/PersesEChartWrapper";

import { useEChartTheme } from "../visualizations/useEChartTheme";

import type { HostRow } from "./hostTypes";
import { osLabel } from "./hostTypes";

interface HostHoneycombChartProps {
  hostRows: HostRow[];
}

/** Returns a hex color interpolated from green -> yellow -> red based on value 0-1. */
function cpuColor(value: number | null): string {
  if (value == null) return "#6b7280"; // gray for unknown
  const clamped = Math.max(0, Math.min(1, value));
  // Green (0%) -> Yellow (50%) -> Red (100%)
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

export default function HostHoneycombChart({ hostRows }: HostHoneycombChartProps) {
  const theme = useEChartTheme();
  const navigate = useNavigate();

  const option = useMemo(() => {
    // Group hosts by OS family
    const groups = new Map<string, HostRow[]>();
    for (const row of hostRows) {
      const key = osLabel(row.osType);
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }

    const treemapData = Array.from(groups.entries()).map(([osName, rows]) => ({
      name: osName,
      children: rows.map((row) => ({
        name: row.hostName || row.hostId,
        value: 1,
        hostId: row.hostId,
        cpuUtilization: row.cpuUtilization,
        memoryUtilization: row.memoryUtilization,
        itemStyle: {
          color: cpuColor(row.cpuUtilization),
          borderColor: "rgba(255,255,255,0.3)",
          borderWidth: 2,
          borderRadius: 4,
        },
      })),
    }));

    return {
      tooltip: {
        ...theme.tooltip,
        formatter: (params: {
          data?: {
            hostId?: string;
            cpuUtilization?: number | null;
            memoryUtilization?: number | null;
          };
          name?: string;
          treePathInfo?: Array<{ name: string }>;
        }) => {
          const data = params.data;
          if (!data?.hostId) {
            return `<strong>${params.name ?? ""}</strong>`;
          }
          const cpu =
            data.cpuUtilization != null ? `${(data.cpuUtilization * 100).toFixed(1)}%` : "N/A";
          const mem =
            data.memoryUtilization != null
              ? `${(data.memoryUtilization * 100).toFixed(1)}%`
              : "N/A";
          return [`<strong>${params.name ?? ""}</strong>`, `CPU: ${cpu}`, `Memory: ${mem}`].join(
            "<br/>",
          );
        },
      },
      series: [
        {
          type: "treemap",
          data: treemapData,
          width: "100%",
          height: "100%",
          roam: false,
          nodeClick: false as const,
          breadcrumb: { show: false },
          squareRatio: 1,
          leafDepth: 1,
          levels: [
            {
              // OS group level
              itemStyle: {
                borderColor:
                  (Array.isArray(theme.tooltip) ? undefined : theme.tooltip?.borderColor) ?? "#444",
                borderWidth: 3,
                gapWidth: 3,
              },
              upperLabel: {
                show: true,
                height: 24,
                color: theme.textStyle?.color ?? "#ccc",
                fontSize: 12,
                fontWeight: 600 as const,
                backgroundColor: "transparent",
              },
            },
            {
              // Host leaf level
              itemStyle: {
                borderColor: "rgba(255,255,255,0.15)",
                borderWidth: 2,
                gapWidth: 1,
              },
              label: {
                show: true,
                formatter: (params: { name?: string }) => params.name ?? "",
                fontSize: 10,
                color: "#fff",
                textShadowColor: "rgba(0,0,0,0.6)",
                textShadowBlur: 3,
              },
            },
          ],
        },
      ],
    };
  }, [hostRows, theme]);

  const handleChartClick = useMemo(
    () => (params: { data?: { hostId?: string } }) => {
      const hostId = params.data?.hostId;
      if (hostId) {
        navigate(`/hosts/${encodeURIComponent(hostId)}`);
      }
    },
    [navigate],
  );

  if (hostRows.length === 0) return null;

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Host Map
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Each cell is a host, colored by CPU utilization. Grouped by OS family.
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
      <Box sx={{ height: Math.max(280, Math.min(hostRows.length * 40, 500)) }}>
        <EChart
          option={option}
          theme={theme}
          onEvents={{ click: handleChartClick }}
          sx={{ width: "100%", height: "100%" }}
        />
      </Box>
    </Paper>
  );
}
