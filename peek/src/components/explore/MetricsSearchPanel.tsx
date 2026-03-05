import { useCallback, useId, useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import type { AggregationType, ExplorerFilter, FieldInfo } from "../../services/es";
import { getAggregationOptions, buildExplorerQuery } from "../../services/es";
import type { TimeRange } from "../../types/dashboard";
import { COMPONENT_HEIGHTS } from "../../types/tokens";
import MetricSearch from "../MetricSearch";
import AskAiButton from "../AskAiButton";
import SignalSearchPanel from "../SignalSearchPanel";

interface MetricsSearchPanelProps {
  indexPattern: string;
  fields: FieldInfo[];
  fieldsLoading: boolean;
  selectedMetric: string | null;
  selectedNamespace: string | null;
  metricType: "counter" | "gauge";
  aggregation: AggregationType;
  filters: ExplorerFilter[];
  groupBy: string | null;
  rawQuery: string | null;
  timeRange: TimeRange;

  onIndexPatternChange: (value: string) => void;
  onNamespaceChange: (namespace: string | null) => void;
  onMetricSelect: (field: FieldInfo | null) => void;
  onAggregationChange: (agg: AggregationType) => void;
  onRemoveFilter: (index: number) => void;
  onClearFilters: () => void;
  onGroupByDelete: () => void;
  onRawQueryChange: (value: string) => void;
  onCreateEditor: (view: EditorView) => void;
  queryEditorExtensions: Extension[];
  themeMode: "light" | "dark";
  searchLoading: boolean;
  onSearch: () => void;
  searchResultCount: number | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function MetricsSearchPanel({
  indexPattern,
  fields,
  fieldsLoading,
  selectedMetric,
  selectedNamespace,
  metricType,
  aggregation,
  filters,
  groupBy,
  rawQuery,
  timeRange,
  onIndexPatternChange,
  onNamespaceChange,
  onMetricSelect,
  onAggregationChange,
  onRemoveFilter,
  onClearFilters,
  onGroupByDelete,
  onRawQueryChange,
  onCreateEditor,
  queryEditorExtensions,
  themeMode,
  searchLoading,
  onSearch,
  searchResultCount,
  collapsed,
  onToggleCollapsed,
}: MetricsSearchPanelProps) {
  const aggLabelId = useId();
  const aggOptions = getAggregationOptions(metricType);

  const selectedMetricWithNamespace = selectedNamespace
    ? `${selectedNamespace}.${selectedMetric ?? ""}`
    : selectedMetric;

  const generatedQuery = useMemo(() => {
    if (!selectedMetric) return null;
    const result = buildExplorerQuery({
      indexPattern,
      metricField: selectedMetric,
      metricType,
      aggregation,
      filters,
      groupBy: groupBy ?? undefined,
      timeRange,
    });
    return result.esql;
  }, [indexPattern, selectedMetric, metricType, aggregation, filters, groupBy, timeRange]);

  const effectiveQuery = rawQuery ?? generatedQuery ?? "";

  const activeFilterCount = useMemo(
    () => filters.length + (groupBy ? 1 : 0),
    [filters.length, groupBy],
  );

  const handleResetFilters = useCallback(() => {
    onClearFilters();
    onGroupByDelete();
  }, [onClearFilters, onGroupByDelete]);

  const renderFilterControls = useCallback(
    () => (
      <>
        <Box
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "flex-start",
            mt: 0.5,
            mb: 1,
          }}
        >
          <TextField
            size="small"
            label="Index pattern"
            value={indexPattern}
            onChange={(e) => onIndexPatternChange(e.target.value)}
            sx={{ width: 200, "& .MuiOutlinedInput-root": { height: COMPONENT_HEIGHTS.input } }}
          />

          <Box sx={{ flex: 1 }}>
            <MetricSearch
              fields={fields}
              loading={fieldsLoading}
              selectedMetric={selectedMetric}
              selectedNamespace={selectedNamespace}
              onNamespaceChange={onNamespaceChange}
              onSelect={onMetricSelect}
            />
          </Box>

          {selectedMetric && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id={aggLabelId}>Aggregation</InputLabel>
              <Select
                labelId={aggLabelId}
                value={aggregation}
                label="Aggregation"
                onChange={(e) => onAggregationChange(e.target.value as AggregationType)}
                sx={{ height: COMPONENT_HEIGHTS.input }}
              >
                {aggOptions.map((agg) => (
                  <MenuItem key={agg} value={agg}>
                    {agg.toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>

        {/* Active filters */}
        {selectedMetric && filters.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center", mb: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
              Filters:
            </Typography>
            {[...filters.entries()].map(([filterIdx, f]) => (
              <Chip
                key={`${f.field}-${f.op}-${f.value}-${filterIdx}`}
                label={`${f.field} ${f.op} "${f.value}"`}
                size="small"
                onDelete={() => onRemoveFilter(filterIdx)}
                color="primary"
                variant="outlined"
              />
            ))}
            <Button size="small" onClick={onClearFilters} sx={{ ml: 0.5 }}>
              Clear all
            </Button>
          </Box>
        )}

        {/* Group by indicator */}
        {selectedMetric && groupBy && (
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Split by:
            </Typography>
            <Chip label={groupBy} size="small" color="secondary" onDelete={onGroupByDelete} />
          </Box>
        )}

        {/* Ask AI buttons */}
        {selectedMetric && (
          <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
            <AskAiButton
              label="Explain metric"
              prompt={`Explain metric "${selectedMetricWithNamespace}" in Elasticsearch terms: what it measures, expected normal behavior, and how to interpret high or low values.`}
            />
            <AskAiButton
              label="Suggest group by"
              prompt={`For metric "${selectedMetricWithNamespace}" on index pattern "${indexPattern}", suggest the most useful group-by dimension field and why.`}
            />
          </Box>
        )}
      </>
    ),
    [
      indexPattern,
      fields,
      fieldsLoading,
      selectedMetric,
      selectedNamespace,
      aggregation,
      filters,
      groupBy,
      aggLabelId,
      aggOptions,
      selectedMetricWithNamespace,
      onIndexPatternChange,
      onNamespaceChange,
      onMetricSelect,
      onAggregationChange,
      onRemoveFilter,
      onClearFilters,
      onGroupByDelete,
    ],
  );

  return (
    <SignalSearchPanel
      title="Metrics"
      resultNoun="metrics"
      effectiveQuery={effectiveQuery}
      onRawQueryChange={onRawQueryChange}
      onCreateEditor={onCreateEditor}
      queryEditorExtensions={queryEditorExtensions}
      themeMode={themeMode}
      searchLoading={searchLoading}
      onSearch={onSearch}
      searchResultCount={searchResultCount}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      activeFilterCount={activeFilterCount}
      onResetFilters={handleResetFilters}
      renderFilterControls={renderFilterControls}
      filterControlsLabel="Metrics picker"
      showCollapsedQuerySummary={false}
      showSearchButtons={false}
      showQueryEditor={false}
    />
  );
}
