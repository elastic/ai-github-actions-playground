import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import ListItemButton from "@mui/material/ListItemButton";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CodeIcon from "@mui/icons-material/Code";

import type { EsqlColumn, EsqlResponse } from "../types";

import EmptyState from "./EmptyState";
import { isNumericType } from "./visualizations/chartUtils";
import { getTypeColor } from "./fieldTypeColor";

export interface FieldPickerSidebarProps {
  columns: EsqlColumn[];
  selectedFields: Set<string>;
  onToggleField: (name: string) => void;
  fieldFilter: string;
  onFieldFilterChange: (value: string) => void;
  onSelectVisible: () => void;
  onDeselectVisible: () => void;
  visibleColumns: EsqlColumn[];
  expandedInsight: string | null;
  insightsCache: Record<
    string,
    { loading: boolean; error: string | null; data: EsqlResponse | null }
  >;
  onToggleInsight: (columnName: string, columnType: string) => void;
}

export default function FieldPickerSidebar({
  columns,
  selectedFields,
  onToggleField,
  fieldFilter,
  onFieldFilterChange,
  onSelectVisible,
  onDeselectVisible,
  visibleColumns,
  expandedInsight,
  insightsCache,
  onToggleInsight,
}: FieldPickerSidebarProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        flexShrink: 0,
        flexDirection: "column",
        width: 220,
        overflow: "hidden",
      }}
    >
      <Box sx={{ py: 1, px: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle1">Fields</Typography>
        {columns.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            {selectedFields.size} / {columns.length} selected
          </Typography>
        )}
        {columns.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 1 }}>
            <TextField
              size="small"
              placeholder="Filter fields"
              value={fieldFilter}
              onChange={(e) => onFieldFilterChange(e.target.value)}
            />
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <Button size="small" onClick={onSelectVisible}>
                Select all
              </Button>
              <Button size="small" onClick={onDeselectVisible}>
                Deselect all
              </Button>
            </Box>
          </Box>
        )}
      </Box>
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {columns.length === 0 ? (
          <EmptyState
            icon={<CodeIcon sx={{ mb: 0.5, color: "text.secondary", fontSize: 48 }} />}
            heading="Run a query to see fields"
            description="Execute an ES|QL query to inspect the returned field names and types."
          />
        ) : (
          visibleColumns.map((col) => {
            const insight = insightsCache[col.name];
            const isExpanded = expandedInsight === col.name;
            return (
              <Box key={col.name}>
                <ListItemButton
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    py: 0.5,
                    px: 0.5,
                  }}
                  onClick={() => onToggleField(col.name)}
                >
                  <Checkbox
                    size="small"
                    checked={selectedFields.has(col.name)}
                    onChange={() => onToggleField(col.name)}
                    onClick={(e) => e.stopPropagation()}
                    sx={{ p: 0.5 }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" noWrap display="block" title={col.name}>
                      {col.name}
                    </Typography>
                    <Chip
                      label={col.type}
                      size="small"
                      color={getTypeColor(col.type)}
                      sx={{
                        height: 14,
                        fontSize: "0.6rem",
                        "& .MuiChip-label": { px: 0.5 },
                      }}
                    />
                  </Box>
                  <IconButton
                    size="small"
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} insights for ${col.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleInsight(col.name, col.type);
                    }}
                    sx={{ p: 0.5 }}
                  >
                    {isExpanded ? (
                      <ExpandLessIcon sx={{ fontSize: 16 }} />
                    ) : (
                      <ExpandMoreIcon sx={{ fontSize: 16 }} />
                    )}
                  </IconButton>
                </ListItemButton>
                <Collapse in={isExpanded}>
                  <Box sx={{ py: 1, px: 1.5, bgcolor: "action.hover" }}>
                    {insight?.loading && (
                      <Box sx={{ display: "flex", justifyContent: "center", py: 0.5 }}>
                        <CircularProgress size={16} />
                      </Box>
                    )}
                    {!insight?.loading && insight?.error && (
                      <Alert severity="error" sx={{ py: 0, fontSize: "0.7rem" }}>
                        {insight.error}
                      </Alert>
                    )}
                    {!insight?.loading &&
                      !insight?.error &&
                      insight?.data &&
                      isNumericType(col.type) &&
                      (() => {
                        const row = insight.data!.values[0];
                        const getVal = (name: string) => {
                          const idx = insight.data!.columns.findIndex((c) => c.name === name);
                          return idx >= 0 && row ? (row[idx] ?? null) : null;
                        };
                        const min = getVal("min_value");
                        const max = getVal("max_value");
                        const avg = getVal("avg_value");
                        const total = getVal("total_count");
                        const nulls = getVal("null_count");
                        return (
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 0.5,
                              fontSize: "0.7rem",
                            }}
                          >
                            {[
                              { label: "Min", value: min },
                              { label: "Max", value: max },
                              { label: "Avg", value: avg },
                              { label: "Count", value: total },
                              { label: "Nulls", value: nulls },
                            ].map(({ label, value }) => (
                              <Box
                                key={label}
                                sx={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                }}
                              >
                                <Typography variant="caption" color="text.secondary">
                                  {label}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  fontFamily="monospace"
                                  fontWeight={600}
                                >
                                  {value == null ? "—" : String(value)}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        );
                      })()}
                    {!insight?.loading &&
                      !insight?.error &&
                      insight?.data &&
                      !isNumericType(col.type) &&
                      (() => {
                        const vals = insight.data!.values;
                        if (vals.length === 0) {
                          return (
                            <EmptyState
                              size="small"
                              heading="No values"
                              description="No data found for this field."
                            />
                          );
                        }
                        const valIdx = insight.data!.columns.findIndex((c) => c.name === col.name);
                        const cntIdx = insight.data!.columns.findIndex(
                          (c) => c.name === "value_count",
                        );
                        return (
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 0.5,
                              fontSize: "0.7rem",
                            }}
                          >
                            {vals.map((row, i) => {
                              const value = valIdx >= 0 ? (row[valIdx] ?? null) : null;
                              const count = cntIdx >= 0 ? (row[cntIdx] ?? null) : null;
                              return (
                                <Box
                                  key={i}
                                  sx={{
                                    display: "flex",
                                    gap: 0.5,
                                    justifyContent: "space-between",
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    noWrap
                                    sx={{ flex: 1, minWidth: 0, fontFamily: "monospace" }}
                                    title={value == null ? "null" : String(value)}
                                  >
                                    {value == null ? (
                                      <span style={{ opacity: 0.4, fontStyle: "italic" }}>
                                        null
                                      </span>
                                    ) : (
                                      String(value)
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    fontFamily="monospace"
                                    color="text.secondary"
                                    sx={{ flexShrink: 0 }}
                                  >
                                    {count == null ? "—" : String(count)}
                                  </Typography>
                                </Box>
                              );
                            })}
                            {vals.length >= 10 && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ opacity: 0.6 }}
                              >
                                Top 10 only
                              </Typography>
                            )}
                          </Box>
                        );
                      })()}
                    {!insight?.loading && !insight?.error && !insight?.data && (
                      <Typography variant="caption" color="text.secondary">
                        No data
                      </Typography>
                    )}
                  </Box>
                </Collapse>
                <Divider />
              </Box>
            );
          })
        )}
      </Box>
    </Paper>
  );
}
