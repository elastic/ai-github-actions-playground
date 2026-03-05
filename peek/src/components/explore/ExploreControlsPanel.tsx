import { useId } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CodeIcon from "@mui/icons-material/Code";
import SearchIcon from "@mui/icons-material/Search";
import SaveIcon from "@mui/icons-material/Save";

import type { AggregationType, FieldInfo, ExplorerFilter } from "../../services/es";
import { getAggregationOptions } from "../../services/es";
import MetricSearch from "../MetricSearch";
import PageHeader from "../PageHeader";
import AskAiButton from "../AskAiButton";

interface ExploreControlsPanelProps {
  indexPattern: string;
  fields: FieldInfo[];
  fieldsLoading: boolean;
  selectedMetric: string | null;
  selectedNamespace: string | null;
  metricType: "counter" | "gauge";
  aggregation: AggregationType;
  filters: ExplorerFilter[];
  groupBy: string | null;
  showEsql: boolean;
  showDimensionOverview: boolean;
  esql: string | null;
  queryStatus: "idle" | "loading" | "success" | "error";
  executionTimeMs?: number;
  onIndexPatternChange: (value: string) => void;
  onNamespaceChange: (namespace: string | null) => void;
  onMetricSelect: (field: FieldInfo | null) => void;
  onAggregationChange: (agg: AggregationType) => void;
  onRemoveFilter: (index: number) => void;
  onClearFilters: () => void;
  onGroupByDelete: () => void;
  onToggleEsql: () => void;
  onEditInDiscover: () => void;
  onSaveToDashboard: () => void;
}

export default function ExploreControlsPanel({
  indexPattern,
  fields,
  fieldsLoading,
  selectedMetric,
  selectedNamespace,
  metricType,
  aggregation,
  filters,
  groupBy,
  showEsql,
  showDimensionOverview,
  esql,
  queryStatus,
  executionTimeMs,
  onIndexPatternChange,
  onNamespaceChange,
  onMetricSelect,
  onAggregationChange,
  onRemoveFilter,
  onClearFilters,
  onGroupByDelete,
  onToggleEsql,
  onEditInDiscover,
  onSaveToDashboard,
}: ExploreControlsPanelProps) {
  const aggOptions = getAggregationOptions(metricType);
  const aggLabelId = useId();
  const selectedMetricWithNamespace = selectedNamespace
    ? `${selectedNamespace}.${selectedMetric ?? ""}`
    : selectedMetric;

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Box sx={{ mb: 1 }}>
        <PageHeader
          title="Metrics"
          actions={
            selectedMetric ? (
              <>
                <AskAiButton
                  label="Explain metric"
                  prompt={`Explain metric "${selectedMetricWithNamespace}" in Elasticsearch terms: what it measures, expected normal behavior, and how to interpret high or low values.`}
                />
                <AskAiButton
                  label="Suggest group by"
                  prompt={`For metric "${selectedMetricWithNamespace}" on index pattern "${indexPattern}", suggest the most useful group-by dimension field and why.`}
                />
              </>
            ) : undefined
          }
        />
      </Box>
      <Box
        sx={{
          display: "flex",
          gap: 1,
          alignItems: "flex-start",
        }}
      >
        {/* Index pattern */}
        <TextField
          size="small"
          label="Index pattern"
          value={indexPattern}
          onChange={(e) => onIndexPatternChange(e.target.value)}
          sx={{ width: 200 }}
        />

        {/* Metric search */}
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

        {/* Aggregation selector — only in full detail mode */}
        {selectedMetric && !showDimensionOverview && (
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id={aggLabelId}>Aggregation</InputLabel>
            <Select
              labelId={aggLabelId}
              value={aggregation}
              label="Aggregation"
              onChange={(e) => onAggregationChange(e.target.value as AggregationType)}
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

      {/* Active filters — full detail mode only */}
      {selectedMetric && !showDimensionOverview && filters.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center", mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
            Filters:
          </Typography>
          {(() => {
            const seen = new Map<string, number>();
            return filters.map((f, i) => {
              const baseKey = `${f.field}-${f.op}-${f.value}`;
              const occurrence = seen.get(baseKey) ?? 0;
              seen.set(baseKey, occurrence + 1);
              return (
                <Chip
                  key={`${baseKey}-${occurrence}`}
                  label={`${f.field} ${f.op} "${f.value}"`}
                  size="small"
                  onDelete={() => onRemoveFilter(i)}
                  color="primary"
                  variant="outlined"
                />
              );
            });
          })()}
          <Button size="small" onClick={onClearFilters} sx={{ ml: 0.5 }}>
            Clear all
          </Button>
        </Box>
      )}

      {/* Group by indicator — full detail mode only */}
      {selectedMetric && !showDimensionOverview && groupBy && (
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Split by:
          </Typography>
          <Chip label={groupBy} size="small" color="secondary" onDelete={onGroupByDelete} />
        </Box>
      )}

      {/* Action buttons — full detail mode only */}
      {selectedMetric && !showDimensionOverview && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}>
          <Tooltip title="View generated ES|QL query">
            <IconButton
              size="small"
              aria-label="View generated ES|QL query"
              onClick={onToggleEsql}
              color={showEsql ? "primary" : "default"}
            >
              <CodeIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {esql && (
            <>
              <Tooltip title="Edit this query in Query Lab">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SearchIcon />}
                  onClick={onEditInDiscover}
                >
                  Edit in Query Lab
                </Button>
              </Tooltip>
              <Tooltip title="Save as dashboard panel">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SaveIcon />}
                  onClick={onSaveToDashboard}
                >
                  Save to Dashboard
                </Button>
              </Tooltip>
            </>
          )}

          <Box sx={{ flex: 1 }} />

          {queryStatus === "success" && executionTimeMs !== undefined && (
            <Typography variant="caption" color="text.secondary">
              Query took {executionTimeMs}ms
            </Typography>
          )}
        </Box>
      )}

      {/* ES|QL display — full detail mode only */}
      <Collapse in={selectedMetric !== null && !showDimensionOverview && showEsql && !!esql}>
        <Paper
          variant="outlined"
          sx={{
            mt: 1,
            p: 1.5,
            bgcolor: "action.hover",
            wordBreak: "break-all",
            whiteSpace: "pre-wrap",
            fontSize: "0.8rem",
            fontFamily: "monospace",
          }}
        >
          {esql}
        </Paper>
      </Collapse>
    </Paper>
  );
}
