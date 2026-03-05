import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ShowChartIcon from "@mui/icons-material/ShowChart";

import type { EsqlResponse } from "../../types";
import { TRACE_TIME_RANGE_OPTIONS, resolveTraceTimeRangeToMs } from "../timePresets";
import EmptyState from "../EmptyState";
import TimeSeriesChart from "../visualizations/TimeSeriesChart";
import BarChart from "../visualizations/BarChart";
import TraceScatterChart from "../visualizations/TraceScatterChart";

import {
  sliceForMetric,
  extractTimeRangeFromTimeseries,
  toErrorsBarData,
} from "./traceMetricsUtils";

interface ChartCellProps {
  title: string;
  data: EsqlResponse | null;
  metricColumn: string;
  loading: boolean;
  timeRange: { min: number; max: number } | null;
}

interface ErrorsBarCellProps {
  data: EsqlResponse | null;
  loading: boolean;
  timeRange: { min: number; max: number } | null;
}

const CHART_HEIGHT = 200;

function ErrorsBarCell({ data, loading, timeRange }: ErrorsBarCellProps) {
  const barData = data ? toErrorsBarData(data) : null;

  return (
    <Box
      sx={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minWidth: 200,
        minHeight: 0,
        p: 0.5,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
      }}
    >
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
        <Box sx={{ height: CHART_HEIGHT, border: 1, borderColor: "divider", borderRadius: 1 }}>
          <EmptyState
            icon={<ShowChartIcon sx={{ color: "text.secondary", fontSize: 32 }} />}
            heading="Run a search to see results"
            description="Write an ES|QL query above and click Search."
          />
        </Box>
      )}
    </Box>
  );
}

function ChartCell({ title, data, metricColumn, loading, timeRange }: ChartCellProps) {
  const sliced = data ? sliceForMetric(data, metricColumn) : null;

  return (
    <Box
      sx={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minWidth: 200,
        minHeight: 0,
        p: 0.5,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
      }}
    >
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
        <Box sx={{ height: CHART_HEIGHT, border: 1, borderColor: "divider", borderRadius: 1 }}>
          <EmptyState
            icon={<ShowChartIcon sx={{ color: "text.secondary", fontSize: 32 }} />}
            heading="Run a search to see results"
            description="Write an ES|QL query above and click Search."
          />
        </Box>
      )}
    </Box>
  );
}

interface TraceRow {
  traceId: string;
  spanId: string;
  serviceName: string;
  name: string;
  durationUs: number;
  status: string;
  timestamp: string;
}

/** Get a human-readable label for the current time range from filters */
function getTimeRangeLabel(timeFrom: string | null, timeTo: string | null): string {
  if (!timeFrom || !timeTo) return "";
  const preset = TRACE_TIME_RANGE_OPTIONS.find((opt) => opt.from === timeFrom && opt.to === timeTo);
  return preset?.label ?? "";
}

export interface TraceMetricsChartsProps {
  timeseriesResult: EsqlResponse | null;
  timeseriesLoading: boolean;
  traceRows: TraceRow[];
  searchLoading: boolean;
  onSelectTrace?: (traceId: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  timeFrom: string | null;
  timeTo: string | null;
}

export default function TraceMetricsCharts({
  timeseriesResult,
  timeseriesLoading,
  traceRows,
  searchLoading,
  onSelectTrace,
  collapsed,
  onToggleCollapsed,
  timeFrom,
  timeTo,
}: TraceMetricsChartsProps) {
  const timeRangeLabel = getTimeRangeLabel(timeFrom, timeTo);
  const timeRange =
    resolveTraceTimeRangeToMs(timeFrom, timeTo) ??
    (timeseriesResult ? extractTimeRangeFromTimeseries(timeseriesResult) : null);
  const scatterData = traceRows.map((r) => ({
    timestamp: r.timestamp,
    durationUs: r.durationUs,
    serviceName: r.serviceName,
    traceId: r.traceId,
  }));

  return (
    <Paper variant="outlined" sx={{ p: 0.5 }}>
      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mb: collapsed ? 0 : 0.5 }}>
        <IconButton
          size="small"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand metrics charts" : "Collapse metrics charts"}
        >
          <ExpandMoreIcon
            sx={{
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              fontSize: 20,
            }}
          />
        </IconButton>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Metrics
        </Typography>
        {timeRangeLabel && (
          <Typography variant="caption" color="text.secondary">
            {timeRangeLabel}
          </Typography>
        )}
      </Box>
      <Collapse in={!collapsed} unmountOnExit>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { md: "repeat(3, 1fr)", sm: "repeat(2, 1fr)", xs: "1fr" },
            gap: 0.5,
          }}
        >
          <ChartCell
            title="Requests"
            data={timeseriesResult}
            metricColumn="request_count"
            loading={timeseriesLoading}
            timeRange={timeRange}
          />
          <ErrorsBarCell
            data={timeseriesResult}
            loading={timeseriesLoading}
            timeRange={timeRange}
          />
          <Box
            sx={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              minWidth: 0,
              minHeight: 0,
              p: 0.5,
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, mb: 0.5 }}>
              Latency
            </Typography>
            {searchLoading ? (
              <Skeleton variant="rounded" height={CHART_HEIGHT} sx={{ borderRadius: 1 }} />
            ) : scatterData.length > 0 ? (
              <Box sx={{ height: CHART_HEIGHT }}>
                <TraceScatterChart
                  data={scatterData}
                  onPointClick={onSelectTrace}
                  compact
                  timeRange={timeRange}
                />
              </Box>
            ) : (
              <Box
                sx={{ height: CHART_HEIGHT, border: 1, borderColor: "divider", borderRadius: 1 }}
              >
                <EmptyState
                  icon={<ShowChartIcon sx={{ color: "text.secondary", fontSize: 32 }} />}
                  heading="Run a search to see results"
                  description="Write an ES|QL query above and click Search."
                />
              </Box>
            )}
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
}
