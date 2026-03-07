import { useMemo } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { EChart } from "@perses-dev/components";

import { useSimpleEsqlQuery } from "../../hooks/useSimpleEsqlQuery";
import { useEChartTheme } from "../visualizations/useEChartTheme";

import { buildHostLoadAverageTimeSeriesQuery, type HostQueryFilters } from "./hostQueryBuilder";
import { parseLoadAverageSeries } from "./hostTimeSeriesParsers";

interface LoadAverageChartCardProps {
  filters: HostQueryFilters;
}

export default function LoadAverageChartCard({ filters }: LoadAverageChartCardProps) {
  const theme = useEChartTheme();
  const query = useMemo(() => buildHostLoadAverageTimeSeriesQuery(filters), [filters]);
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
