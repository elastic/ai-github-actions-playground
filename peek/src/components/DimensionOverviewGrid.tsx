import { useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import Skeleton from "@mui/material/Skeleton";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTheme } from "@mui/material/styles";

import type { FieldInfo, ElasticsearchClient, MetricType } from "../services/es";
import { buildDimensionOverviewQuery } from "../services/es";
import type { EsqlResponse, TimeRange } from "../types";
import { useBatchedOverviewQueries, hasOverviewData } from "../hooks/useBatchedOverviewQueries";

import { useEChartTheme } from "./visualizations/useEChartTheme";
import EmptyState from "./EmptyState";
import EChartWrapper from "./visualizations/EChartWrapper";
import { normalizeDimensionBucketLabel } from "./DimensionOverviewGrid.utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  fields: FieldInfo[];
  metricField: string;
  metricType: MetricType;
  metricNamespace: string | null;
  indexPattern: string;
  timeRange: TimeRange;
  client: ElasticsearchClient | null;
  onSelectDimension: (dimensionField: string) => void;
  onBackToOverview: () => void;
  onViewUngrouped: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SERIES = 5;

// ---------------------------------------------------------------------------
// Multi-series sparkline option builder
// ---------------------------------------------------------------------------

function buildMultiSeriesSparkline(
  data: EsqlResponse,
  themeOpts: ReturnType<typeof useEChartTheme>,
  legendTextColor: string,
): Record<string, unknown> {
  const dateIdx = data.columns.findIndex(
    (c) => c.type === "date" || c.type === "date_nanos" || c.name === "@timestamp",
  );
  const metricIdx = data.columns.findIndex((c) => c.name === "metric");
  // Dimension column is the third column (not timestamp, not metric)
  const dimIdx = data.columns.findIndex((_, i) => i !== dateIdx && i !== metricIdx);

  if (metricIdx < 0) {
    return { title: { text: "No data", left: "center", top: "center" } };
  }

  // Group rows by dimension value
  const grouped = new Map<string, [number | null, unknown][]>();
  for (const row of data.values) {
    const dimVal = dimIdx >= 0 ? normalizeDimensionBucketLabel(row[dimIdx]) : "all";
    const ts = dateIdx >= 0 && row[dateIdx] ? new Date(row[dateIdx] as string).getTime() : null;
    if (!grouped.has(dimVal)) grouped.set(dimVal, []);
    grouped.get(dimVal)!.push([ts, row[metricIdx]]);
  }

  // Take top N series by number of data points (proxy for frequency)
  const sortedKeys = [...grouped.keys()]
    .sort((a, b) => grouped.get(b)!.length - grouped.get(a)!.length)
    .slice(0, MAX_SERIES);

  const totalKeys = grouped.size;

  const colors =
    themeOpts.color.length > 0
      ? themeOpts.color
      : ["#0077CC", "#FF6B6B", "#4ECB71", "#FFD93D", "#6C5CE7"];

  const series = sortedKeys.map((key, i) => ({
    type: "line" as const,
    name: key,
    data: grouped.get(key)!,
    smooth: true,
    showSymbol: false,
    lineStyle: { width: 1.5 },
    areaStyle: { opacity: 0.1 },
    itemStyle: { color: colors[i % colors.length] },
  }));

  return {
    ...themeOpts,
    grid: { left: 4, right: 4, top: 4, bottom: 24, containLabel: false },
    xAxis: { type: "time", show: false },
    yAxis: { type: "value", show: false },
    tooltip: {
      trigger: "axis",
      confine: true,
      textStyle: { fontSize: 11 },
    },
    legend: {
      show: true,
      bottom: 0,
      left: "center",
      type: "scroll",
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { fontSize: 10, color: legendTextColor },
      formatter: (name: string) => {
        const short = name.length > 20 ? name.slice(0, 18) + "..." : name;
        return totalKeys > MAX_SERIES && name === sortedKeys[sortedKeys.length - 1]
          ? `${short} (+${totalKeys - MAX_SERIES})`
          : short;
      },
    },
    series,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DimensionOverviewGrid({
  fields,
  metricField,
  metricType,
  metricNamespace,
  indexPattern,
  timeRange,
  client,
  onSelectDimension,
  onBackToOverview,
  onViewUngrouped,
}: Props) {
  const theme = useTheme();
  const echartsTheme = useEChartTheme();

  // Discover dimension fields — same logic as DimensionSidebar
  const dimensionFields = useMemo(() => {
    const base = fields.filter(
      (f) =>
        f.metricType === "unknown" &&
        f.type !== "date" &&
        f.type !== "date_nanos" &&
        f.name !== "@timestamp",
    );
    if (metricNamespace === null) return base;
    const scoped = base.filter(
      (f) => f.name === metricNamespace || f.name.startsWith(`${metricNamespace}.`),
    );
    return scoped.length > 0 ? scoped : base;
  }, [fields, metricNamespace]);

  const scopeKey = [
    metricField,
    metricType,
    indexPattern,
    timeRange.from,
    timeRange.to,
    dimensionFields.map((f) => f.name).join(","),
  ].join("|");

  const buildQuery = useCallback(
    (field: FieldInfo) =>
      buildDimensionOverviewQuery({
        indexPattern,
        metricField,
        metricType,
        dimensionField: field.name,
        timeRange,
      }),
    [indexPattern, metricField, metricType, timeRange],
  );

  const { results } = useBatchedOverviewQueries({
    items: dimensionFields,
    client,
    scopeKey,
    buildQuery,
    timeRange,
  });

  const dimsWithData = useMemo(() => {
    return dimensionFields.filter((f) => hasOverviewData(results[f.name]));
  }, [dimensionFields, results]);

  const isLoading = useMemo(
    () => dimensionFields.some((f) => results[f.name]?.status === "loading"),
    [dimensionFields, results],
  );

  const handleCardClick = useCallback(
    (fieldName: string) => {
      onSelectDimension(fieldName);
    },
    [onSelectDimension],
  );

  const shortMetric = metricField.includes(".")
    ? metricField.split(".").slice(-2).join(".")
    : metricField;

  if (dimensionFields.length === 0) {
    return (
      <EmptyState
        heading="No dimension fields found"
        description={`No dimension fields found for ${shortMetric}. Connect more data or adjust your filters.`}
        action={
          <Button size="small" onClick={onViewUngrouped}>
            View ungrouped metric
          </Button>
        }
      />
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto", p: 1 }}>
      {/* Header */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 1 }}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={onBackToOverview}>
          Back to overview
        </Button>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {shortMetric} — dimensions
        </Typography>
        {isLoading && <LinearProgress sx={{ flexShrink: 0, width: 80 }} />}
        {!isLoading && (
          <Chip
            label={`${dimsWithData.length} of ${dimensionFields.length} dimensions with data`}
            size="small"
            variant="outlined"
          />
        )}
        <Button size="small" variant="outlined" onClick={onViewUngrouped}>
          View ungrouped
        </Button>
      </Box>

      {/* Grid of mini charts */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 1,
        }}
      >
        {dimsWithData.map((field) => {
          const result = results[field.name];
          const displayName =
            metricNamespace && field.name.startsWith(`${metricNamespace}.`)
              ? field.name.slice(metricNamespace.length + 1)
              : field.name;

          return (
            <Paper
              key={field.name}
              variant="outlined"
              sx={{
                minHeight: 180,
                transition: "border-color 0.15s",
                "&:hover": {
                  borderColor: "border.strong",
                },
              }}
            >
              <ButtonBase
                aria-label={`Group by ${field.name}`}
                onClick={() => handleCardClick(field.name)}
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
                    label={field.type}
                    size="small"
                    variant="outlined"
                    sx={{
                      height: 16,
                      fontSize: "0.6rem",
                      "& .MuiChip-label": { px: 0.5 },
                    }}
                  />
                </Box>

                {/* Multi-series sparkline */}
                <Box sx={{ flex: 1, minHeight: 120 }}>
                  {result?.data ? (
                    <EChartWrapper
                      option={buildMultiSeriesSparkline(
                        result.data,
                        echartsTheme,
                        theme.palette.text.primary,
                      )}
                    />
                  ) : (
                    <Skeleton variant="rounded" height="100%" />
                  )}
                </Box>
              </ButtonBase>
            </Paper>
          );
        })}

        {/* Loading placeholders */}
        {isLoading &&
          dimsWithData.length === 0 &&
          dimensionFields.slice(0, 6).map((field) => (
            <Paper key={`loading-${field.name}`} variant="outlined" sx={{ minHeight: 180, p: 1 }}>
              <Skeleton variant="rounded" height="100%" />
            </Paper>
          ))}
      </Box>

      {/* Empty state after loading */}
      {!isLoading && dimsWithData.length === 0 && dimensionFields.length > 0 && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            justifyContent: "center",
            alignItems: "center",
            py: 4,
          }}
        >
          <Typography variant="body2" color="text.primary">
            No dimensions with data found in the selected time range
          </Typography>
          <Button size="small" onClick={onViewUngrouped}>
            View ungrouped metric
          </Button>
        </Box>
      )}
    </Box>
  );
}
