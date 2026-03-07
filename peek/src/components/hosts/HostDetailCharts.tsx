import { useMemo } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { EChart } from "@perses-dev/components";

import { useSimpleEsqlQuery } from "../../hooks/useSimpleEsqlQuery";
import { useEChartTheme } from "../visualizations/useEChartTheme";

import {
  buildHostDetailTimeSeriesQuery,
  buildHostDetailLoadAverageQuery,
  type HostQueryFilters,
  type HostTimeSeriesMetric,
} from "./hostQueryBuilder";
import { fmtBytesRate } from "./hostFormatters";
import { parseSimpleTimeSeries, parseLoadAverageSeries } from "./hostTimeSeriesParsers";

// ---------------------------------------------------------------------------
// Single metric chart for a specific host
// ---------------------------------------------------------------------------

interface HostDetailMetricChartProps {
  title: string;
  hostId: string;
  metricField: HostTimeSeriesMetric;
  filters: HostQueryFilters;
  asPercent?: boolean;
  asBytes?: boolean;
  color?: string;
}

export function HostDetailMetricChart({
  title,
  hostId,
  metricField,
  filters,
  asPercent,
  asBytes,
  color,
}: HostDetailMetricChartProps) {
  const theme = useEChartTheme();
  const query = useMemo(
    () => buildHostDetailTimeSeriesQuery(hostId, metricField, filters),
    [hostId, metricField, filters],
  );
  const { data, loading } = useSimpleEsqlQuery({ query });
  const points = useMemo(() => parseSimpleTimeSeries(data), [data]);

  const fmtValue = useMemo(() => {
    if (asPercent) return (v: number) => `${v.toFixed(1)}%`;
    if (asBytes) return (v: number) => fmtBytesRate(v);
    return (v: number) => v.toFixed(2);
  }, [asPercent, asBytes]);

  const fmtAxis = useMemo(() => {
    if (asPercent) return (v: number) => `${v.toFixed(0)}%`;
    if (asBytes) return (v: number) => fmtBytesRate(v);
    return (v: number) => String(v);
  }, [asPercent, asBytes]);

  const option = useMemo(() => {
    const seriesData = points.map((p) => [
      new Date(p.bucket).getTime(),
      asPercent ? p.value * 100 : p.value,
    ]);
    const seriesColor = color ?? (theme.color[0] as string | undefined) ?? "#4fc3f7";
    return {
      grid: { left: 72, right: 16, top: 12, bottom: 28 },
      tooltip: {
        ...theme.tooltip,
        trigger: "axis",
        valueFormatter: fmtValue,
      },
      xAxis: {
        ...theme.xAxis,
        type: "time",
        axisLabel: { ...theme.xAxis?.axisLabel, fontSize: 10 },
      },
      yAxis: {
        ...theme.yAxis,
        type: "value",
        axisLabel: {
          ...theme.yAxis?.axisLabel,
          fontSize: 10,
          formatter: fmtAxis,
        },
        ...(asPercent ? { max: 100, min: 0 } : {}),
      },
      series: [
        {
          type: "line",
          data: seriesData,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color: seriesColor },
          areaStyle: { opacity: 0.12, color: seriesColor },
          itemStyle: { color: seriesColor },
        },
      ],
    };
  }, [points, theme, asPercent, fmtValue, fmtAxis, color]);

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Box
        sx={{
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {loading && <CircularProgress size={12} />}
      </Box>
      <Box sx={{ height: 200 }}>
        {points.length > 0 ? (
          <EChart option={option} theme={theme} sx={{ width: "100%", height: "100%" }} />
        ) : (
          <Box
            sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Typography variant="body2" color="text.secondary">
              {loading ? "Loading..." : "No data"}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Load average chart for a specific host
// ---------------------------------------------------------------------------

interface HostDetailLoadChartProps {
  hostId: string;
  filters: HostQueryFilters;
}

export function HostDetailLoadChart({ hostId, filters }: HostDetailLoadChartProps) {
  const theme = useEChartTheme();
  const query = useMemo(() => buildHostDetailLoadAverageQuery(hostId, filters), [hostId, filters]);
  const { data, loading } = useSimpleEsqlQuery({ query });
  const points = useMemo(() => parseLoadAverageSeries(data), [data]);

  const option = useMemo(() => {
    const colors = ["#4fc3f7", "#ffb74d", "#ef5350"];
    const names = ["1m", "5m", "15m"];
    const keys = ["load1m", "load5m", "load15m"] as const;
    return {
      grid: { left: 48, right: 16, top: 12, bottom: 28 },
      tooltip: { ...theme.tooltip, trigger: "axis" },
      legend: {
        show: true,
        bottom: 0,
        textStyle: {
          ...(Array.isArray(theme.legend) ? {} : theme.legend?.textStyle),
          fontSize: 10,
        },
      },
      xAxis: {
        ...theme.xAxis,
        type: "time",
        axisLabel: { ...theme.xAxis?.axisLabel, fontSize: 10 },
      },
      yAxis: {
        ...theme.yAxis,
        type: "value",
        axisLabel: { ...theme.yAxis?.axisLabel, fontSize: 10 },
      },
      series: keys.map((key, i) => ({
        name: names[i],
        type: "line",
        data: points.map((p) => [new Date(p.bucket).getTime(), p[key]]),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: colors[i] },
        itemStyle: { color: colors[i] },
      })),
    };
  }, [points, theme]);

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Box
        sx={{
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Load Average
        </Typography>
        {loading && <CircularProgress size={12} />}
      </Box>
      <Box sx={{ height: 200 }}>
        {points.length > 0 ? (
          <EChart option={option} theme={theme} sx={{ width: "100%", height: "100%" }} />
        ) : (
          <Box
            sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Typography variant="body2" color="text.secondary">
              {loading ? "Loading..." : "No data"}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
