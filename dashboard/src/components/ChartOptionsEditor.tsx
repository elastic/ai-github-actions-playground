import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  UNIT_CONFIG,
  UNIT_GROUP_CONFIG,
  isUnitWithDecimalPlaces,
  isUnitWithShortValues,
} from "@perses-dev/core";
import type {
  BarChartOptions,
  FormatOptions,
  GaugePanelOptions,
  StatPanelOptions,
  TimeSeriesOptions,
  VisualizationOptions,
  VisualizationType,
} from "../types";

const DEFAULT_FORMAT: FormatOptions = { unit: "decimal" };

const DECIMAL_PLACES_OPTIONS = [
  { label: "Default", value: "" },
  { label: "0", value: "0" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
];

/**
 * Simplified FormatControls built on MUI + @perses-dev/core.
 * Mirrors the Perses FormatControls component without importing the full
 * @perses-dev/components bundle (which has transitive peer deps not present here).
 */
function FormatEditor({
  value,
  onChange,
}: {
  value: FormatOptions;
  onChange: (f: FormatOptions) => void;
}) {
  const unit = value?.unit ?? "decimal";
  const hasDecimalPlaces = isUnitWithDecimalPlaces(value);
  const hasShortValues = isUnitWithShortValues(value);

  const groups = Object.entries(UNIT_GROUP_CONFIG).map(([group]) => ({
    group,
    units: Object.entries(UNIT_CONFIG)
      .filter(([, cfg]) => cfg.group === group)
      .map(([id, cfg]) => ({ id, label: cfg.label })),
  }));

  const decimalPlaces = hasDecimalPlaces
    ? ((value as { decimalPlaces?: number }).decimalPlaces?.toString() ?? "")
    : "";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <FormControl size="small" fullWidth>
        <InputLabel id="format-unit-label">Unit</InputLabel>
        <Select
          labelId="format-unit-label"
          label="Unit"
          value={unit}
          onChange={(e) => onChange({ unit: e.target.value } as FormatOptions)}
        >
          {groups.flatMap(({ group, units }) =>
            units.length === 0
              ? []
              : [
                  <MenuItem key={`group-${group}`} disabled sx={{ fontWeight: 600, fontSize: 12 }}>
                    {group}
                  </MenuItem>,
                  ...units.map(({ id, label }) => (
                    <MenuItem key={id} value={id} sx={{ pl: 3 }}>
                      {label}
                    </MenuItem>
                  )),
                ],
          )}
        </Select>
      </FormControl>

      <FormControl size="small" fullWidth>
        <InputLabel id="decimal-places-label">Decimal places</InputLabel>
        <Select
          labelId="decimal-places-label"
          label="Decimal places"
          value={decimalPlaces}
          disabled={!hasDecimalPlaces}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...value,
              decimalPlaces: v === "" ? undefined : Number(v),
            } as FormatOptions);
          }}
        >
          {DECIMAL_PLACES_OPTIONS.map(({ label, value: v }) => (
            <MenuItem key={v} value={v}>
              {label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={
              hasShortValues ? (value as { shortValues?: boolean }).shortValues === true : false
            }
            disabled={!hasShortValues}
            onChange={(e) => {
              if (hasShortValues)
                onChange({ ...value, shortValues: e.target.checked } as FormatOptions);
            }}
          />
        }
        label={<Typography variant="body2">Short values</Typography>}
      />
    </Box>
  );
}

interface Props {
  vizType: VisualizationType;
  options: VisualizationOptions;
  onChange: (options: VisualizationOptions) => void;
}

export default function ChartOptionsEditor({ vizType, options, onChange }: Props) {
  const format = (options as { format?: FormatOptions }).format ?? DEFAULT_FORMAT;

  const handleFormatChange = (f: FormatOptions) => {
    onChange({ ...options, format: f });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="subtitle2" color="text.secondary">
        Chart Options
      </Typography>

      <Box>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
          Value Format
        </Typography>
        <FormatEditor value={format} onChange={handleFormatChange} />
      </Box>

      {vizType === "timeseries" && (
        <TimeSeriesOptionsEditor options={options as TimeSeriesOptions} onChange={onChange} />
      )}

      {vizType === "bar" && (
        <BarChartOptionsEditor options={options as BarChartOptions} onChange={onChange} />
      )}

      {vizType === "gauge" && (
        <GaugeOptionsEditor options={options as GaugePanelOptions} onChange={onChange} />
      )}
    </Box>
  );
}

function TimeSeriesOptionsEditor({
  options,
  onChange,
}: {
  options: TimeSeriesOptions;
  onChange: (o: VisualizationOptions) => void;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={options.smooth !== false}
            onChange={(e) => onChange({ ...options, smooth: e.target.checked })}
          />
        }
        label={<Typography variant="body2">Smooth lines</Typography>}
      />
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={options.showArea !== false}
            onChange={(e) => onChange({ ...options, showArea: e.target.checked })}
          />
        }
        label={<Typography variant="body2">Show area fill</Typography>}
      />
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={options.stacked === true}
            onChange={(e) => onChange({ ...options, stacked: e.target.checked })}
          />
        }
        label={<Typography variant="body2">Stacked</Typography>}
      />
    </Box>
  );
}

function BarChartOptionsEditor({
  options,
  onChange,
}: {
  options: BarChartOptions;
  onChange: (o: VisualizationOptions) => void;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={options.stacked === true}
            onChange={(e) => onChange({ ...options, stacked: e.target.checked })}
          />
        }
        label={<Typography variant="body2">Stacked</Typography>}
      />
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={options.horizontal === true}
            onChange={(e) => onChange({ ...options, horizontal: e.target.checked })}
          />
        }
        label={<Typography variant="body2">Horizontal</Typography>}
      />
    </Box>
  );
}

function GaugeOptionsEditor({
  options,
  onChange,
}: {
  options: GaugePanelOptions;
  onChange: (o: VisualizationOptions) => void;
}) {
  return (
    <Box sx={{ display: "flex", gap: 2 }}>
      <TextField
        label="Min"
        size="small"
        type="number"
        value={options.min ?? ""}
        onChange={(e) =>
          onChange({
            ...options,
            min: e.target.value === "" ? undefined : Number(e.target.value),
          })
        }
        sx={{ width: 100 }}
      />
      <TextField
        label="Max"
        size="small"
        type="number"
        value={options.max ?? ""}
        onChange={(e) =>
          onChange({
            ...options,
            max: e.target.value === "" ? undefined : Number(e.target.value),
          })
        }
        sx={{ width: 100 }}
      />
    </Box>
  );
}

export function defaultOptions(vizType: VisualizationType): VisualizationOptions {
  switch (vizType) {
    case "timeseries":
      return { smooth: true, showArea: true, stacked: false } satisfies TimeSeriesOptions;
    case "bar":
      return { stacked: false, horizontal: false } satisfies BarChartOptions;
    case "stat":
      return {} satisfies StatPanelOptions;
    case "gauge":
      return {} satisfies GaugePanelOptions;
    default:
      // "table" and "pie" have no customization options
      return {} satisfies StatPanelOptions;
  }
}
