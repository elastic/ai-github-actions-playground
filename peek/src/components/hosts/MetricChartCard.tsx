import { useMemo } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { EChart } from "@perses-dev/components";

import { useSimpleEsqlQuery } from "../../hooks/useSimpleEsqlQuery";
import { useEChartTheme } from "../visualizations/useEChartTheme";

import {
  buildHostTimeSeriesQuery,
  type HostQueryFilters,
  type HostTimeSeriesMetric,
} from "./hostQueryBuilder";
import { parseSimpleTimeSeries } from "./hostTimeSeriesParsers";

interface MetricChartCardProps {
  title: string;
  metricField: HostTimeSeriesMetric;
  filters: HostQueryFilters;
  /** Format values as percentage (multiply by 100). */
  asPercent?: boolean;
  color?: string;
}

export default function MetricChartCard({
  title,
  metricField,
  filters,
  asPercent,
  color,
}: MetricChartCardProps) {
  const theme = useEChartTheme();
  const query = useMemo(
    () => buildHostTimeSeriesQuery(metricField, filters),
    [metricField, filters],
  );
  const { data, loading } = useSimpleEsqlQuery({ query });

  const points = useMemo(() => parseSimpleTimeSeries(data), [data]);

  const option = useMemo(() => {
    const seriesData = points.map((p) => [
      new Date(p.bucket).getTime(),
      asPercent ? p.value * 100 : p.value,
    ]);
    const seriesColor = color ?? (theme.color[0] as string | undefined) ?? "#4fc3f7";

    return {
      grid: { left: 48, right: 16, top: 12, bottom: 28 },
      tooltip: {
        ...theme.tooltip,
        trigger: "axis",
        valueFormatter: (v: number) => (asPercent ? `${v.toFixed(1)}%` : v.toFixed(2)),
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
          formatter: (v: number) => (asPercent ? `${v.toFixed(0)}%` : String(v)),
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
  }, [points, theme, asPercent, color]);

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
