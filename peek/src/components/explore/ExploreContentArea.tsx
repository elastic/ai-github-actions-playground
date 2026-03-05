import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchOffIcon from "@mui/icons-material/SearchOff";

import type {
  AggregationType,
  FieldInfo,
  ExplorerFilter,
  ElasticsearchClient,
} from "../../services/es";
import type { EsqlResponse } from "../../types";
import DimensionSidebar from "../DimensionSidebar";
import MetricOverviewGrid from "../MetricOverviewGrid";
import DimensionOverviewGrid from "../DimensionOverviewGrid";
import EmptyState from "../EmptyState";
import TimeSeriesChart from "../visualizations/TimeSeriesChart";

interface ExploreContentAreaProps {
  fields: FieldInfo[];
  client: ElasticsearchClient | null;
  indexPattern: string;
  selectedMetric: string | null;
  selectedMetricNamespace: string | null;
  metricType: "counter" | "gauge";
  aggregation: AggregationType;
  selectedNamespace: string | null;
  groupBy: string | null;
  showOverview: boolean;
  showDimensionOverview: boolean;
  metricNotFound: boolean;
  chartData: EsqlResponse | null;
  queryStatus: string;
  timeRange: { from: string; to: string };
  onMetricSelect: (field: FieldInfo | null) => void;
  onDimensionSelect: (dimensionField: string) => void;
  onBackToOverview: () => void;
  onBackToDimensionOverview: () => void;
  onViewUngrouped: () => void;
  onAddFilter: (filter: ExplorerFilter) => void;
  onSetGroupBy: (groupBy: string | null) => void;
}

export default function ExploreContentArea({
  fields,
  client,
  indexPattern,
  selectedMetric,
  selectedMetricNamespace,
  metricType,
  aggregation,
  selectedNamespace,
  groupBy,
  showOverview,
  showDimensionOverview,
  metricNotFound,
  chartData,
  queryStatus,
  timeRange,
  onMetricSelect,
  onDimensionSelect,
  onBackToOverview,
  onBackToDimensionOverview,
  onViewUngrouped,
  onAddFilter,
  onSetGroupBy,
}: ExploreContentAreaProps) {
  return (
    <Box sx={{ display: "flex", flex: 1, gap: 1, minHeight: 0, overflow: "hidden" }}>
      {/* Dimension sidebar — only show in full detail mode */}
      {selectedMetric && !showOverview && !showDimensionOverview && !metricNotFound && (
        <DimensionSidebar
          fields={fields}
          client={client}
          indexPattern={indexPattern}
          metricNamespace={selectedMetricNamespace}
          groupBy={groupBy}
          onAddFilter={onAddFilter}
          onSetGroupBy={onSetGroupBy}
        />
      )}

      {/* Metric not found — selected via URL but does not exist in loaded fields */}
      {metricNotFound && (
        <Paper
          variant="outlined"
          sx={{ display: "flex", flex: 1, flexDirection: "column", overflow: "auto" }}
        >
          <EmptyState
            icon={<SearchOffIcon sx={{ mb: 0.5, color: "text.secondary", fontSize: 48 }} />}
            heading="Metric not found"
            description={`The metric "${selectedMetric}" does not exist in the current index. Choose a valid metric from the search above or check your URL parameters.`}
          />
        </Paper>
      )}

      {/* Namespace overview grid */}
      {showOverview && selectedNamespace && (
        <Paper
          variant="outlined"
          sx={{ display: "flex", flex: 1, flexDirection: "column", overflow: "auto" }}
        >
          <MetricOverviewGrid
            fields={fields}
            namespace={selectedNamespace}
            indexPattern={indexPattern}
            timeRange={timeRange}
            client={client}
            onSelectMetric={onMetricSelect}
          />
        </Paper>
      )}

      {/* Dimension overview grid — metric selected, no groupBy yet */}
      {showDimensionOverview && selectedMetric && (
        <Paper
          variant="outlined"
          sx={{ display: "flex", flex: 1, flexDirection: "column", overflow: "auto" }}
        >
          <DimensionOverviewGrid
            fields={fields}
            metricField={selectedMetric}
            metricType={metricType}
            aggregation={aggregation}
            metricNamespace={selectedMetricNamespace}
            indexPattern={indexPattern}
            timeRange={timeRange}
            client={client}
            onSelectDimension={onDimensionSelect}
            onBackToOverview={onBackToOverview}
            onViewUngrouped={onViewUngrouped}
          />
        </Paper>
      )}

      {/* Full detail chart area */}
      {!showOverview && !showDimensionOverview && !metricNotFound && (
        <Paper
          variant="outlined"
          sx={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            alignSelf: { md: "flex-start", xs: "stretch" },
            minHeight: { md: 380, xs: 320 },
            overflow: "auto",
          }}
        >
          {/* Back button — goes to dimension overview */}
          {selectedMetric && selectedNamespace && (
            <Box sx={{ pt: 1, px: 1.5 }}>
              <Button
                size="small"
                startIcon={<ArrowBackIcon />}
                onClick={onBackToDimensionOverview}
              >
                Back to dimensions
              </Button>
            </Box>
          )}

          {!selectedMetric && queryStatus === "idle" && (
            <EmptyState
              icon={<ShowChartIcon sx={{ mb: 0.5, color: "text.secondary", fontSize: 48 }} />}
              heading="Explore your metrics"
              description="Pick a namespace to see an overview of all its metrics, or search for a specific metric field."
              addDataHref="/add-data"
            />
          )}

          {queryStatus === "loading" && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
              }}
            >
              <LinearProgress />
            </Box>
          )}

          {chartData && (
            <Box sx={{ height: { md: 380, xs: 320 } }}>
              <TimeSeriesChart data={chartData} options={{ smooth: true, showArea: true }} />
            </Box>
          )}

          {/* Fallback when metric is selected but no chart data yet */}
          {selectedMetric && !chartData && queryStatus !== "loading" && (
            <EmptyState
              icon={<ShowChartIcon sx={{ mb: 0.5, color: "text.secondary", fontSize: 48 }} />}
              heading="No chart data"
              description="Run a search to visualize this metric, or adjust the time range and filters."
              size="small"
            />
          )}
        </Paper>
      )}
    </Box>
  );
}
