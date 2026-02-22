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
  HistogramChartOptions,
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
    <>
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel id="format-unit-label">Unit</InputLabel>
        <Select
          labelId="format-unit-label"
          label="Unit"
          value={unit}
          onChange={(e) => onChange({ ...value, unit: e.target.value } as FormatOptions)}
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

      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel id="decimal-places-label">Decimals</InputLabel>
        <Select
          labelId="decimal-places-label"
          label="Decimals"
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
        sx={{ ml: 0 }}
      />
    </>
  );
}

interface Props {
  vizType: VisualizationType;
  options: VisualizationOptions;
  onChange: (options: VisualizationOptions) => void;
}

/** Horizontal row of chart customization controls rendered below the preview. */
export default function ChartOptionsEditor({ vizType, options, onChange }: Props) {
  const format = (options as { format?: FormatOptions }).format ?? DEFAULT_FORMAT;

  const handleFormatChange = (f: FormatOptions) => {
    onChange({ ...options, format: f });
  };

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
        Options
      </Typography>

      <FormatEditor value={format} onChange={handleFormatChange} />

      {vizType === "timeseries" && (
        <TimeSeriesOptionsEditor options={options as TimeSeriesOptions} onChange={onChange} />
      )}

      {vizType === "bar" && (
        <BarChartOptionsEditor options={options as BarChartOptions} onChange={onChange} />
      )}

      {vizType === "gauge" && (
        <GaugeOptionsEditor options={options as GaugePanelOptions} onChange={onChange} />
      )}

      {vizType === "histogram" && (
        <HistogramOptionsEditor options={options as HistogramChartOptions} onChange={onChange} />
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
    <>
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={options.smooth !== false}
            onChange={(e) => onChange({ ...options, smooth: e.target.checked })}
          />
        }
        label={<Typography variant="body2">Smooth</Typography>}
        sx={{ ml: 0 }}
      />
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={options.showArea !== false}
            onChange={(e) => onChange({ ...options, showArea: e.target.checked })}
          />
        }
        label={<Typography variant="body2">Area fill</Typography>}
        sx={{ ml: 0 }}
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
        sx={{ ml: 0 }}
      />
    </>
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
    <>
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={options.stacked === true}
            onChange={(e) => onChange({ ...options, stacked: e.target.checked })}
          />
        }
        label={<Typography variant="body2">Stacked</Typography>}
        sx={{ ml: 0 }}
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
        sx={{ ml: 0 }}
      />
    </>
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
    <>
      <TextField
        label="Min"
        size="small"
        type="number"
        value={options.min ?? ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange({
            ...options,
            min: e.target.value === "" || !Number.isFinite(n) ? undefined : n,
          });
        }}
        sx={{ width: 90 }}
      />
      <TextField
        label="Max"
        size="small"
        type="number"
        value={options.max ?? ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange({
            ...options,
            max: e.target.value === "" || !Number.isFinite(n) ? undefined : n,
          });
        }}
        sx={{ width: 90 }}
      />
    </>
  );
}

function HistogramOptionsEditor({
  options,
  onChange,
}: {
  options: HistogramChartOptions;
  onChange: (o: VisualizationOptions) => void;
}) {
  return (
    <TextField
      label="Bins"
      size="small"
      type="number"
      value={options.bins ?? 10}
      onChange={(e) => {
        const n = Number(e.target.value);
        onChange({
          ...options,
          bins: !Number.isFinite(n) || n < 1 ? 10 : Math.min(Math.round(n), 100),
        });
      }}
      sx={{ width: 90 }}
      inputProps={{ min: 1, max: 100 }}
    />
  );
}
