import { useMemo } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import type { FieldInfo, MetricTypeClassification } from "../services/es";

function getTypeColor(type: string): "default" | "primary" | "secondary" | "success" | "warning" {
  if (type === "date" || type === "date_nanos") return "warning";
  if (
    type === "long" ||
    type === "integer" ||
    type === "double" ||
    type === "float" ||
    type === "short" ||
    type === "byte"
  )
    return "primary";
  if (type === "boolean") return "secondary";
  if (type === "keyword" || type === "text" || type === "ip" || type === "version")
    return "success";
  return "default";
}

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
  onSelect: (field: FieldInfo | null) => void;
}

export default function MetricSearch({ fields, loading, selectedMetric, onSelect }: Props) {
  // Only show numeric (gauge/counter) fields for metric search
  const metricFields = useMemo(() => fields.filter((f) => f.metricType !== "unknown"), [fields]);

  const selectedField = useMemo(
    () => metricFields.find((f) => f.name === selectedMetric) ?? null,
    [metricFields, selectedMetric],
  );

  return (
    <Autocomplete
      options={metricFields}
      value={selectedField}
      onChange={(_, value) => onSelect(value)}
      getOptionLabel={(option) => option.name}
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
        return (
          <Box component="li" {...props} key={option.name}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
              <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                {option.name}
              </Typography>
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
  );
}
