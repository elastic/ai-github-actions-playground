import { useMemo } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";

import type { FieldInfo, MetricTypeClassification } from "../services/es";

import { getTypeColor } from "./fieldTypeColor";

function getMetricBadge(metricType: MetricTypeClassification): {
  label: string;
  color: "info" | "warning" | "default";
} {
  switch (metricType) {
    case "gauge":
      return { label: "gauge", color: "info" };
    case "counter":
      return { label: "counter", color: "warning" };
    default:
      return { label: "field", color: "default" };
  }
}

interface Props {
  fields: FieldInfo[];
  loading: boolean;
  selectedMetric: string | null;
  selectedNamespace: string | null;
  onNamespaceChange: (namespace: string | null) => void;
  onSelect: (field: FieldInfo | null) => void;
}

function namespaceOf(fieldName: string): string {
  const dot = fieldName.indexOf(".");
  if (dot > 0) return fieldName.slice(0, dot);
  const underscore = fieldName.indexOf("_");
  return underscore > 0 ? fieldName.slice(0, underscore) : fieldName;
}

export default function MetricSearch({
  fields,
  loading,
  selectedMetric,
  selectedNamespace,
  onNamespaceChange,
  onSelect,
}: Props) {
  // Only show numeric (gauge/counter) fields for metric search
  const metricFields = useMemo(() => fields.filter((f) => f.metricType !== "unknown"), [fields]);
  const namespaces = useMemo(
    () => Array.from(new Set(metricFields.map((f) => namespaceOf(f.name)))).sort(),
    [metricFields],
  );
  const scopedMetricFields = useMemo(() => {
    if (!selectedNamespace) return metricFields;
    return metricFields.filter((f) => namespaceOf(f.name) === selectedNamespace);
  }, [metricFields, selectedNamespace]);

  const selectedField = useMemo(
    () => scopedMetricFields.find((f) => f.name === selectedMetric) ?? null,
    [scopedMetricFields, selectedMetric],
  );

  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel id="metric-namespace-label">Namespace</InputLabel>
        <Select
          labelId="metric-namespace-label"
          value={
            selectedNamespace && namespaces.includes(selectedNamespace) ? selectedNamespace : ""
          }
          label="Namespace"
          onChange={(e) => onNamespaceChange((e.target.value as string) || null)}
        >
          <MenuItem value="">All namespaces</MenuItem>
          {namespaces.map((namespace) => (
            <MenuItem key={namespace} value={namespace}>
              {namespace}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Autocomplete
        size="small"
        options={scopedMetricFields}
        value={selectedField}
        onChange={(_, value) => onSelect(value)}
        getOptionLabel={(option) => {
          if (!selectedNamespace) return option.name;
          return option.name.startsWith(`${selectedNamespace}.`)
            ? option.name.slice(selectedNamespace.length + 1)
            : option.name;
        }}
        isOptionEqualToValue={(opt, val) => opt.name === val.name}
        loading={loading}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Search metrics"
            placeholder="Type to search for a metric field..."
            slotProps={{
              input: {
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
        renderOption={(props, option) => {
          const badge = getMetricBadge(option.metricType);
          const displayName =
            selectedNamespace && option.name.startsWith(`${selectedNamespace}.`)
              ? option.name.slice(selectedNamespace.length + 1)
              : option.name;
          return (
            <Box component="li" {...props} key={option.name}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", width: "100%" }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    {displayName}
                  </Typography>
                  {selectedNamespace && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {option.name}
                    </Typography>
                  )}
                </Box>
                <Chip
                  label={option.type}
                  size="small"
                  color={getTypeColor(option.type)}
                  sx={{
                    height: 18,
                    fontSize: "0.65rem",
                    "& .MuiChip-label": { px: 0.5 },
                  }}
                />
                <Chip
                  label={badge.label}
                  size="small"
                  color={badge.color}
                  variant="outlined"
                  sx={{
                    height: 18,
                    fontSize: "0.65rem",
                    "& .MuiChip-label": { px: 0.5 },
                  }}
                />
              </Box>
            </Box>
          );
        }}
        filterOptions={(options, { inputValue }) => {
          const lower = inputValue.toLowerCase();
          return options.filter((o) => o.name.toLowerCase().includes(lower));
        }}
        fullWidth
      />
    </Box>
  );
}
