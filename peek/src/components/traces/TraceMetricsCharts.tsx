import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ShowChartIcon from "@mui/icons-material/ShowChart";

import type { EsqlResponse } from "../../types";
import { TRACE_TIME_RANGE_OPTIONS, resolveTraceTimeRangeToMs } from "../timePresets";
import EmptyState from "../EmptyState";
import TraceScatterChart from "../visualizations/TraceScatterChart";

import {
  extractTimeRangeFromTimeseries,
  sliceForMetric,
  toErrorsBarData,
} from "./traceMetricsUtils";
import { CHART_HEIGHT, ChartCell, ErrorsBarCell } from "./TraceMetricsChartCells";

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
  onSelectTracePoint?: (point: { traceId: string; spanId?: string; timestamp: string }) => void;
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
  onSelectTracePoint,
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
    spanId: r.spanId,
  }));
  const requestData = timeseriesResult ? sliceForMetric(timeseriesResult, "request_count") : null;
  const errorData = timeseriesResult ? toErrorsBarData(timeseriesResult) : null;
  const hasPanelData = Boolean(
    (requestData && requestData.values.length > 0) ||
    (errorData && errorData.values.length > 0) ||
    scatterData.length > 0,
  );
  const showPanelEmpty = !timeseriesLoading && !searchLoading && !hasPanelData;

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
        {showPanelEmpty ? (
          <Box sx={{ height: CHART_HEIGHT, border: 1, borderColor: "divider", borderRadius: 1 }}>
            <EmptyState
              icon={<ShowChartIcon sx={{ color: "text.secondary", fontSize: 32 }} />}
              heading="Run a search to see metrics"
              description="Write an ES|QL query above to populate requests, errors, and latency."
            />
          </Box>
        ) : (
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
                    onPointClick={onSelectTracePoint}
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
        )}
      </Collapse>
    </Paper>
  );
}
