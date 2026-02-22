import { useState, useCallback, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FilterListIcon from "@mui/icons-material/FilterList";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import type { FieldInfo, FieldValueEntry, ExplorerFilter } from "../services/es";
import type { ElasticsearchClient } from "../services/es";
import { getFieldValues } from "../services/es";

interface Props {
  fields: FieldInfo[];
  client: ElasticsearchClient | null;
  indexPattern: string;
  metricNamespace: string | null;
  groupBy: string | null;
  onAddFilter: (filter: ExplorerFilter) => void;
  onSetGroupBy: (field: string | null) => void;
}

interface DimensionState {
  expanded: boolean;
  loading: boolean;
  values: FieldValueEntry[];
}

export default function DimensionSidebar({
  fields,
  client,
  indexPattern,
  metricNamespace,
  groupBy,
  onAddFilter,
  onSetGroupBy,
}: Props) {
  const [dimensionStates, setDimensionStates] = useState<Record<string, DimensionState>>({});
  const [filter, setFilter] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Filter to only non-metric, non-timestamp dimension fields
  const baseDimensionFields = fields.filter(
    (f) =>
      f.metricType === "unknown" &&
      f.type !== "date" &&
      f.type !== "date_nanos" &&
      f.name !== "@timestamp",
  );
  const scopedDimensionFields =
    metricNamespace === null
      ? baseDimensionFields
      : baseDimensionFields.filter(
          (f) => f.name === metricNamespace || f.name.startsWith(`${metricNamespace}.`),
        );
  const dimensionFields =
    metricNamespace !== null && scopedDimensionFields.length > 0
      ? scopedDimensionFields
      : baseDimensionFields;

  const filteredDimensions = filter
    ? dimensionFields.filter((f) => f.name.toLowerCase().includes(filter.toLowerCase()))
    : dimensionFields;

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleToggleExpand = useCallback(
    async (fieldName: string) => {
      let shouldLoadValues = false;
      setDimensionStates((prev) => {
        const current = prev[fieldName];
        if (current?.expanded) {
          return {
            ...prev,
            [fieldName]: {
              ...current,
              expanded: false,
              loading: false,
            },
          };
        }
        if (current?.values.length) {
          return {
            ...prev,
            [fieldName]: {
              ...current,
              expanded: true,
              loading: false,
            },
          };
        }
        shouldLoadValues = true;
        if (!client) {
          return prev;
        }
        return {
          ...prev,
          [fieldName]: { expanded: true, loading: true, values: [] },
        };
      });

      if (!shouldLoadValues) return;
      if (!client) return;

      try {
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        const values = await getFieldValues(
          client,
          indexPattern,
          fieldName,
          20,
          abortRef.current.signal,
        );
        setDimensionStates((prev) => ({
          ...prev,
          [fieldName]: { expanded: true, loading: false, values },
        }));
      } catch {
        setDimensionStates((prev) => ({
          ...prev,
          [fieldName]: { expanded: true, loading: false, values: [] },
        }));
      }
    },
    [client, indexPattern],
  );

  if (dimensionFields.length === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{
          width: 240,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="subtitle2">Dimensions</Typography>
        </Box>
        <Box sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            Select a metric to see available dimensions
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        width: 240,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle2">Dimensions</Typography>
        {metricNamespace && (
          <Typography variant="caption" color="text.secondary" display="block">
            Scoped to {metricNamespace}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" display="block">
          {dimensionFields.length} fields — select to expand, use{" "}
          <GroupWorkIcon aria-label="group by" sx={{ fontSize: 10, verticalAlign: "middle" }} /> to
          group by
        </Typography>
        <TextField
          size="small"
          placeholder="Filter dimensions"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          fullWidth
          sx={{ mt: 0.5 }}
        />
      </Box>
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {filteredDimensions.map((field) => {
          const state = dimensionStates[field.name];
          const isGroupBy = groupBy === field.name;
          return (
            <Box key={field.name}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  px: 1,
                  py: 0.5,
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                  bgcolor: isGroupBy ? "action.selected" : undefined,
                }}
                onClick={() => handleToggleExpand(field.name)}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" noWrap display="block" title={field.name}>
                    {field.name}
                  </Typography>
                  <Chip
                    label={field.type}
                    size="small"
                    color="default"
                    sx={{
                      height: 14,
                      fontSize: "0.6rem",
                      "& .MuiChip-label": { px: 0.5 },
                    }}
                  />
                </Box>
                <Tooltip title="Group by this field">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetGroupBy(isGroupBy ? null : field.name);
                    }}
                    color={isGroupBy ? "primary" : "default"}
                    sx={{ p: 0.25 }}
                  >
                    <GroupWorkIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
                {state?.expanded ? (
                  <ExpandLessIcon sx={{ fontSize: 16 }} />
                ) : (
                  <ExpandMoreIcon sx={{ fontSize: 16 }} />
                )}
              </Box>
              <Collapse in={state?.expanded ?? false}>
                {state?.loading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                    <CircularProgress size={16} />
                  </Box>
                ) : state?.values.length ? (
                  <List dense disablePadding>
                    {state.values.map((v) => (
                      <ListItemButton
                        key={v.value}
                        sx={{ pl: 3, py: 0 }}
                        onClick={() => onAddFilter({ field: field.name, op: "==", value: v.value })}
                      >
                        <ListItemText
                          primary={
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <Typography variant="caption" noWrap sx={{ flex: 1 }} title={v.value}>
                                {v.value}
                              </Typography>
                              <Tooltip title="Add as filter">
                                <FilterListIcon sx={{ fontSize: 12, ml: 0.5, opacity: 0.5 }} />
                              </Tooltip>
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              {v.count.toLocaleString()} docs
                            </Typography>
                          }
                        />
                      </ListItemButton>
                    ))}
                  </List>
                ) : (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ pl: 3, py: 0.5, display: "block" }}
                  >
                    No values found
                  </Typography>
                )}
              </Collapse>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
