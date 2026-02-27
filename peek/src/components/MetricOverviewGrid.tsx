import { useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import { useTheme } from "@mui/material/styles";

import type { FieldInfo, ElasticsearchClient } from "../services/es";
import { buildOverviewQuery } from "../services/es";
import type { EsqlResponse, TimeRange } from "../types";
import { useBatchedOverviewQueries, hasOverviewData } from "../hooks/useBatchedOverviewQueries";

import { useEChartTheme } from "./visualizations/useEChartTheme";
import EChartWrapper from "./visualizations/EChartWrapper";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  fields: FieldInfo[];
  namespace: string;
  indexPattern: string;
  timeRange: TimeRange;
  client: ElasticsearchClient | null;
  onSelectMetric: (field: FieldInfo) => void;
}

// ---------------------------------------------------------------------------
// Sparkline option builder — pure function
// ---------------------------------------------------------------------------

function buildSparklineOption(
  data: EsqlResponse,
  themeOpts: ReturnType<typeof useEChartTheme>,
): Record<string, unknown> {
  const dateIdx = data.columns.findIndex(
    (c) => c.type === "date" || c.type === "date_nanos" || c.name === "@timestamp",
  );
  const metricIdx = data.columns.findIndex((c) => c.name === "metric");

  if (metricIdx < 0) {
    return { title: { text: "No data", left: "center", top: "center" } };
  }

  const xData =
    dateIdx >= 0
      ? data.values.map((row) => (row[dateIdx] ? new Date(row[dateIdx] as string).getTime() : null))
      : data.values.map((_, i) => i);

  const yData = data.values.map((row) => row[metricIdx]);

  return {
    ...themeOpts,
    grid: { left: 4, right: 4, top: 8, bottom: 4, containLabel: false },
    xAxis: {
      type: dateIdx >= 0 ? "time" : "category",
      show: false,
      data: dateIdx < 0 ? xData : undefined,
    },
    yAxis: { type: "value", show: false },
    tooltip: { show: false },
    series: [
      {
        type: "line",
        data: xData.map((x, i) => [x, yData[i]]),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5 },
        areaStyle: { opacity: 0.15 },
        itemStyle: {
          color: themeOpts.color.length ? themeOpts.color[0] : "#0077CC",
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MetricOverviewGrid({
  fields,
  namespace,
  indexPattern,
  timeRange,
  client,
  onSelectMetric,
}: Props) {
  const theme = useTheme();
  const echartsTheme = useEChartTheme();

  // Filter to only metric fields in the selected namespace
  const namespaceMetrics = useMemo(() => {
    return fields.filter(
      (f) =>
        f.metricType !== "unknown" &&
        (f.name.startsWith(`${namespace}.`) || f.name.startsWith(`${namespace}_`)),
    );
  }, [fields, namespace]);

  const scopeFieldKey = useMemo(
    () =>
      namespaceMetrics
        .map((field) => field.name)
        .sort((a, b) => a.localeCompare(b))
        .join(","),
    [namespaceMetrics],
  );
  const scopeKey = `${namespace}|${indexPattern}|${timeRange.from}|${timeRange.to}|${scopeFieldKey}`;

  const buildQuery = useCallback(
    (field: FieldInfo) => {
      const metricType = field.metricType === "counter" ? "counter" : "gauge";
      return buildOverviewQuery({ indexPattern, metricField: field.name, metricType, timeRange });
    },
    [indexPattern, timeRange],
  );

  const results = useBatchedOverviewQueries({
    items: namespaceMetrics,
    client,
    scopeKey,
    buildQuery,
    timeRange,
  });

  // Filter to only metrics with non-null data points (include loading cards with stale data)
  const metricsWithData = useMemo(() => {
    return namespaceMetrics.filter((m) => hasOverviewData(results[m.name]));
  }, [namespaceMetrics, results]);

  const isLoading = useMemo(
    () => namespaceMetrics.some((m) => results[m.name]?.status === "loading"),
    [namespaceMetrics, results],
  );

  const handleCardClick = useCallback(
    (field: FieldInfo) => {
      onSelectMetric(field);
    },
    [onSelectMetric],
  );

  if (namespaceMetrics.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 1,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No metrics found in the <strong>{namespace}</strong> namespace
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Try selecting a different namespace or adjusting the index pattern
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto", p: 1 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">{namespace} namespace</Typography>
        {isLoading && <CircularProgress size={16} />}
        {!isLoading && (
          <Chip
            label={`${metricsWithData.length} of ${namespaceMetrics.length} metrics with data`}
            size="small"
            variant="outlined"
          />
        )}
      </Box>

      {/* Grid of mini charts */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 1,
        }}
      >
        {metricsWithData.map((field) => {
          const result = results[field.name];
          const metricBadgeColor = field.metricType === "counter" ? "warning" : "info";
          const displayName = field.name.startsWith(`${namespace}.`)
            ? field.name.slice(namespace.length + 1)
            : field.name;

          return (
            <Paper
              key={field.name}
              variant="outlined"
              role="button"
              tabIndex={0}
              aria-label={`View details for ${field.name}`}
              onClick={() => handleCardClick(field)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCardClick(field);
                }
              }}
              sx={{
                p: 1,
                cursor: "pointer",
                transition: "box-shadow 0.15s, border-color 0.15s",
                "&:hover": {
                  borderColor: theme.palette.primary.main,
                  boxShadow: 1,
                },
                "&:focus-visible": {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 2,
                },
                display: "flex",
                flexDirection: "column",
                minHeight: 140,
              }}
            >
              {/* Card header */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                <Typography
                  variant="caption"
                  noWrap
                  sx={{ flex: 1, fontWeight: 600 }}
                  title={field.name}
                >
                  {displayName}
                </Typography>
                <Chip
                  label={field.metricType}
                  size="small"
                  color={metricBadgeColor}
                  variant="outlined"
                  sx={{
                    height: 16,
                    fontSize: "0.6rem",
                    "& .MuiChip-label": { px: 0.5 },
                  }}
                />
              </Box>

              {/* Sparkline chart */}
              <Box sx={{ flex: 1, minHeight: 80 }}>
                {result?.data ? (
                  <EChartWrapper option={buildSparklineOption(result.data, echartsTheme)} />
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                    }}
                  >
                    <CircularProgress size={16} />
                  </Box>
                )}
              </Box>
            </Paper>
          );
        })}

        {/* Show loading placeholders while still fetching */}
        {isLoading &&
          metricsWithData.length === 0 &&
          namespaceMetrics.slice(0, 6).map((field) => (
            <Paper
              key={`loading-${field.name}`}
              variant="outlined"
              sx={{
                p: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 140,
              }}
            >
              <CircularProgress size={24} />
            </Paper>
          ))}
      </Box>

      {/* Empty state after loading */}
      {!isLoading && metricsWithData.length === 0 && namespaceMetrics.length > 0 && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 4,
            gap: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            No metrics with data found in the selected time range
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Try expanding the time range or verifying that data is being ingested
          </Typography>
        </Box>
      )}
    </Box>
  );
}
