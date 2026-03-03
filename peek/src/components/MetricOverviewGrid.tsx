import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import Skeleton from "@mui/material/Skeleton";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useTheme } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { EChart } from "@perses-dev/components";

import type { FieldInfo, ElasticsearchClient } from "../services/es";
import { buildOverviewQuery } from "../services/es";
import { CHART_COLORS } from "../theme";
import type { EsqlResponse, TimeRange } from "../types";
import { useBatchedOverviewQueries, hasOverviewData } from "../hooks/useBatchedOverviewQueries";
import { useQueryStore } from "../store/useQueryStore";
import { PAGE_MANIFEST } from "../routes/manifest";

import { useEChartTheme } from "./visualizations/useEChartTheme";
import EmptyState from "./EmptyState";
import OverviewFailedItemsSection from "./OverviewFailedItemsSection";
import type { FailedItem } from "./OverviewFailedItemsSection";

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
          color: themeOpts.color.length ? themeOpts.color[0] : CHART_COLORS[0],
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
  const navigate = useNavigate();
  const setDiscoverQueryDraft = useQueryStore((s) => s.setDiscoverQueryDraft);

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

  const { results, retryFailed } = useBatchedOverviewQueries({
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

  const failedMetrics = useMemo(() => {
    return namespaceMetrics.filter((m) => results[m.name]?.status === "error");
  }, [namespaceMetrics, results]);

  const failedMetricItems: FailedItem[] = useMemo(
    () =>
      failedMetrics.map((m) => ({
        name: m.name,
        reason: results[m.name]?.errorReason ?? "Unknown error",
      })),
    [failedMetrics, results],
  );

  const noDataCount = useMemo(() => {
    return namespaceMetrics.filter((m) => {
      const r = results[m.name];
      return r && r.status !== "loading" && r.status !== "error" && !hasOverviewData(r);
    }).length;
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
      <EmptyState
        heading={`No metrics found in the ${namespace} namespace`}
        description="Try selecting a different namespace or adjusting the index pattern"
      />
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto", p: 1 }}>
      {/* Header */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 1 }}>
        <Typography variant="body2" component="div">
          {namespace} namespace
        </Typography>
        {isLoading && <LinearProgress sx={{ flexShrink: 0, width: 80 }} />}
        {!isLoading && (
          <>
            <Chip
              label={`${metricsWithData.length} with data`}
              size="small"
              variant="outlined"
              color="success"
            />
            {noDataCount > 0 && (
              <Chip label={`${noDataCount} no data`} size="small" variant="outlined" />
            )}
            {failedMetrics.length > 0 && (
              <Chip
                label={`${failedMetrics.length} failed`}
                size="small"
                variant="outlined"
                color="error"
                icon={<ErrorOutlineIcon />}
              />
            )}
          </>
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
              sx={{
                minHeight: 140,
                transition: "border-color 0.15s",
                "&:hover": {
                  borderColor: "border.strong",
                },
              }}
            >
              <ButtonBase
                aria-label={`View details for ${field.name}`}
                onClick={() => handleCardClick(field)}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  width: "100%",
                  height: "100%",
                  p: 1,
                  transition: "background-color 0.15s",
                  "&.Mui-focusVisible": {
                    boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
                  },
                }}
              >
                {/* Card header */}
                <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mb: 0.5 }}>
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
                    }}
                  />
                </Box>

                {/* Sparkline chart */}
                <Box sx={{ flex: 1, minHeight: 120 }}>
                  {result?.data ? (
                    <EChart
                      option={buildSparklineOption(result.data, echartsTheme)}
                      theme={echartsTheme}
                      sx={{ width: "100%", height: "100%", minHeight: 120 }}
                    />
                  ) : (
                    <Skeleton variant="rounded" height="100%" />
                  )}
                </Box>
              </ButtonBase>
            </Paper>
          );
        })}

        {/* Show loading placeholders while still fetching */}
        {isLoading &&
          metricsWithData.length === 0 &&
          namespaceMetrics.slice(0, 6).map((field) => (
            <Paper key={`loading-${field.name}`} variant="outlined" sx={{ minHeight: 140, p: 1 }}>
              <Skeleton variant="rounded" height="100%" />
            </Paper>
          ))}
      </Box>

      {/* Failed metrics expandable section */}
      {!isLoading && (
        <OverviewFailedItemsSection
          items={failedMetricItems}
          itemLabel="metric"
          listAriaLabel="Failed metrics"
          retryTooltip="Retry all failed metric queries"
          retryLabel="Retry failed"
          onRetry={retryFailed}
          renderItemAction={(item) => {
            const field = failedMetrics.find((m) => m.name === item.name);
            if (!field) return null;
            return (
              <Tooltip title="Open this metric's query in Query Lab">
                <IconButton
                  size="small"
                  aria-label={`Open ${field.name} in Query Lab`}
                  onClick={() => {
                    const metricType = field.metricType === "counter" ? "counter" : "gauge";
                    const { esql } = buildOverviewQuery({
                      indexPattern,
                      metricField: field.name,
                      metricType,
                      timeRange,
                    });
                    setDiscoverQueryDraft(esql);
                    navigate(PAGE_MANIFEST.discover.path);
                  }}
                >
                  <SearchIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            );
          }}
        />
      )}

      {/* Empty state after loading */}
      {!isLoading &&
        metricsWithData.length === 0 &&
        failedMetrics.length === 0 &&
        namespaceMetrics.length > 0 && (
          <EmptyState
            heading="No metrics with data found in the selected time range"
            description="Try expanding the time range or verifying that data is being ingested"
          />
        )}
    </Box>
  );
}
