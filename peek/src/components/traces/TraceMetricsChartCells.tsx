import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import ShowChartIcon from "@mui/icons-material/ShowChart";

import type { EsqlResponse } from "../../types";
import EmptyState from "../EmptyState";
import BarChart from "../visualizations/BarChart";
import TimeSeriesChart from "../visualizations/TimeSeriesChart";

import { sliceForMetric, toErrorsBarData } from "./traceMetricsUtils";

export const CHART_HEIGHT = 170;

export interface ChartCellProps {
  title: string;
  data: EsqlResponse | null;
  metricColumn: string;
  loading: boolean;
  timeRange: { min: number; max: number } | null;
}

export interface ErrorsBarCellProps {
  data: EsqlResponse | null;
  loading: boolean;
  timeRange: { min: number; max: number } | null;
}

const emptyState = (
  <EmptyState
    icon={<ShowChartIcon sx={{ color: "text.secondary", fontSize: 32 }} />}
    heading="Run a search to see results"
    description="Write an ES|QL query above and click Search."
  />
);

const cellSx = {
  display: "flex",
  flex: 1,
  flexDirection: "column",
  minWidth: 200,
  minHeight: 0,
  p: 0.5,
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
} as const;

const emptyBoxSx = { height: CHART_HEIGHT, border: 1, borderColor: "divider", borderRadius: 1 };

export function ErrorsBarCell({ data, loading, timeRange }: ErrorsBarCellProps) {
  const barData = data ? toErrorsBarData(data) : null;

  return (
    <Box sx={cellSx}>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, mb: 0.5 }}>
        Errors
      </Typography>
      {loading ? (
        <Skeleton variant="rounded" height={CHART_HEIGHT} sx={{ borderRadius: 1 }} />
      ) : barData && barData.values.length > 0 ? (
        <Box sx={{ height: CHART_HEIGHT }}>
          <BarChart
            data={barData}
            options={{ compact: true, axisLabelInterval: timeRange ? 6 : undefined }}
          />
        </Box>
      ) : (
        <Box sx={emptyBoxSx}>{emptyState}</Box>
      )}
    </Box>
  );
}

export function ChartCell({ title, data, metricColumn, loading, timeRange }: ChartCellProps) {
  const sliced = data ? sliceForMetric(data, metricColumn) : null;

  return (
    <Box sx={cellSx}>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, mb: 0.5 }}>
        {title}
      </Typography>
      {loading ? (
        <Skeleton variant="rounded" height={CHART_HEIGHT} sx={{ borderRadius: 1 }} />
      ) : sliced && sliced.values.length > 0 ? (
        <Box sx={{ height: CHART_HEIGHT }}>
          <TimeSeriesChart
            data={sliced}
            options={{
              smooth: true,
              showArea: true,
              stacked: false,
              compact: true,
              timeRange: timeRange ?? undefined,
            }}
          />
        </Box>
      ) : (
        <Box sx={emptyBoxSx}>{emptyState}</Box>
      )}
    </Box>
  );
}
