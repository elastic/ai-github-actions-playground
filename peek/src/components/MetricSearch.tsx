import { useId, useMemo } from "react";
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
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

import type { FieldInfo, MetricTypeClassification } from "../services/es";

import { getTypeColor } from "./fieldTypeColor";
import { classifyFieldVisual, getFieldVisualIcon } from "./explore/fieldVisuals";
import { metricNamespaceOf } from "./explore/exploreUtils";

function getMetricBadge(metricType: MetricTypeClassification): {
  label: string;
  color: "info" | "warning" | "default";
  icon: ReturnType<typeof getFieldVisualIcon>;
} {
  switch (metricType) {
    case "gauge":
      return { label: "gauge", color: "info", icon: getFieldVisualIcon("metric-gauge") };
    case "counter":
      return { label: "counter", color: "warning", icon: getFieldVisualIcon("metric-counter") };
    default:
      return { label: "field", color: "default", icon: undefined };
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
  const namespaceLabelId = useId();
  const namespaces = useMemo(
    () => Array.from(new Set(metricFields.map((f) => metricNamespaceOf(f.name)))).sort(),
    [metricFields],
  );
  const scopedMetricFields = useMemo(() => {
    if (!selectedNamespace) return metricFields;
    return metricFields.filter((f) => metricNamespaceOf(f.name) === selectedNamespace);
  }, [metricFields, selectedNamespace]);

  const selectedField = useMemo(
    () => scopedMetricFields.find((f) => f.name === selectedMetric) ?? null,
    [scopedMetricFields, selectedMetric],
  );

  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel id={namespaceLabelId}>Namespace</InputLabel>
        <Select
          labelId={namespaceLabelId}
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
        openText="Browse metrics"
        popupIcon={
          <Box component="span" sx={{ display: "inline-flex", gap: 0.5, alignItems: "center" }}>
            <Typography
              variant="caption"
              component="span"
              sx={{ whiteSpace: "nowrap", fontSize: "0.7rem" }}
            >
              Browse
            </Typography>
            <ArrowDropDownIcon fontSize="small" />
          </Box>
        }
        noOptionsText="No matching metrics found"
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
                    {loading ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
        renderOption={(props, option) => {
          const badge = getMetricBadge(option.metricType);
          const fieldVisual = classifyFieldVisual(option.name, option.metricType);
          const displayName =
            selectedNamespace && option.name.startsWith(`${selectedNamespace}.`)
              ? option.name.slice(selectedNamespace.length + 1)
              : option.name;
          return (
            <Box component="li" {...props} key={option.name}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", width: "100%" }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    <Box
                      component="span"
                      sx={{ display: "inline-flex", gap: 0.5, alignItems: "center" }}
                    >
                      {getFieldVisualIcon(fieldVisual, 12)}
                      {displayName}
                    </Box>
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
                  }}
                />
                <Chip
                  label={badge.label}
                  icon={badge.icon}
                  size="small"
                  color={badge.color}
                  variant="outlined"
                  sx={{
                    height: 18,
                    fontSize: "0.65rem",
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
