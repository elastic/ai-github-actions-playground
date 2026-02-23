import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import { useTheme } from "@mui/material/styles";

import type { FieldInfo, ElasticsearchClient } from "../services/es";
import { buildOverviewQuery } from "../services/es";
import { buildTimeParams } from "../services/datemath";
import type { EsqlResponse, TimeRange } from "../types";

import { useEChartTheme } from "./visualizations/useEChartTheme";
import EChartWrapper from "./visualizations/EChartWrapper";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MetricCardResult {
  status: "idle" | "loading" | "success" | "error";
  data?: EsqlResponse;
}

interface Props {
  fields: FieldInfo[];
  namespace: string;
  indexPattern: string;
  timeRange: TimeRange;
  client: ElasticsearchClient | null;
  onSelectMetric: (field: FieldInfo) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max metrics to query in one batch to avoid overwhelming ES. */
const BATCH_SIZE = 6;

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

  const [results, setResults] = useState<Record<string, MetricCardResult>>({});
  const abortRef = useRef<AbortController | null>(null);
  // Track which metrics have had data so refreshes only re-query those
  const knownWithDataRef = useRef<Set<string> | null>(null);

  const prevScopeRef = useRef<string | null>(null);

  // Fetch sparkline data for all namespace metrics in batches
  useEffect(() => {
    if (!client || namespaceMetrics.length === 0) return;

    // When the data scope changes, clear the cache so we do full discovery
    const scopeKey = `${namespace}|${indexPattern}|${timeRange.from}|${timeRange.to}`;
    if (scopeKey !== prevScopeRef.current) {
      prevScopeRef.current = scopeKey;
      knownWithDataRef.current = null;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    // On first load (or after namespace change) query everything;
    // on subsequent refreshes only re-query metrics that previously had data.
    const isRefresh = knownWithDataRef.current !== null;
    const metricsToQuery = isRefresh
      ? namespaceMetrics.filter((m) => knownWithDataRef.current!.has(m.name))
      : namespaceMetrics;

    const runBatches = async () => {
      // Mark queried metrics as loading but keep previous data for display continuity
      setResults((prev) => {
        const next = { ...prev };
        for (const m of metricsToQuery) {
          next[m.name] = { status: "loading", data: prev[m.name]?.data };
        }
        return next;
      });

      for (let i = 0; i < metricsToQuery.length; i += BATCH_SIZE) {
        if (signal.aborted) return;
        const batch = metricsToQuery.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (field) => {
          const metricType = field.metricType === "counter" ? "counter" : "gauge";
          const queryDef = buildOverviewQuery({
            indexPattern,
            metricField: field.name,
            metricType,
            timeRange,
          });
          try {
            const params = buildTimeParams(queryDef.esql, timeRange);
            const result = await client.query(
              params.length > 0 ? { query: queryDef.esql, params } : { query: queryDef.esql },
              signal,
            );
            return { name: field.name, status: "success" as const, data: result as EsqlResponse };
          } catch {
            if (signal.aborted) return null;
            return { name: field.name, status: "error" as const };
          }
        });

        const batchResults = await Promise.all(promises);
        if (signal.aborted) return;

        setResults((prev) => {
          const next = { ...prev };
          for (const r of batchResults) {
            if (r) {
              next[r.name] = { status: r.status, data: r.data };
            }
          }
          return next;
        });
      }

      // After a full discovery pass, record which metrics had data
      if (!isRefresh) {
        setResults((current) => {
          const withData = new Set<string>();
          for (const [name, r] of Object.entries(current)) {
            if (r.status === "success" && r.data && r.data.values.length > 0) {
              const metricIdx = r.data.columns.findIndex((c) => c.name === "metric");
              if (metricIdx >= 0 && r.data.values.some((row) => row[metricIdx] != null)) {
                withData.add(name);
              }
            }
          }
          knownWithDataRef.current = withData;
          return current;
        });
      }
    };

    void runBatches();

    return () => {
      abortRef.current?.abort();
    };
  }, [client, namespace, namespaceMetrics, indexPattern, timeRange]);

  // Filter to only metrics with non-null data points (include loading cards with stale data)
  const metricsWithData = useMemo(() => {
    return namespaceMetrics.filter((m) => {
      const r = results[m.name];
      if (!r?.data || r.data.values.length === 0) return false;
      if (r.status !== "success" && r.status !== "loading") return false;
      const metricIdx = r.data.columns.findIndex((c) => c.name === "metric");
      if (metricIdx < 0) return false;
      return r.data.values.some((row) => row[metricIdx] != null);
    });
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
