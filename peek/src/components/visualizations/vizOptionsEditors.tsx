/**
 * Type-specific options editor sub-components used by the visualization registry.
 * Exported so that the registry can reference them without mixing component and
 * non-component exports in the same module.
 */

import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import type {
  BarChartOptions,
  GaugePanelOptions,
  HistogramChartOptions,
  TimeSeriesOptions,
} from "../../types";

import type { VizOptionsEditorProps } from "./vizRegistry";

export function TimeSeriesOptionsEditor({ options, onChange }: VizOptionsEditorProps) {
  const o = options as TimeSeriesOptions;
  return (
    <>
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={o.smooth !== false}
            onChange={(e) => onChange({ ...o, smooth: e.target.checked })}
          />
        }
        label={<Typography variant="body2">Smooth</Typography>}
        sx={{ ml: 0 }}
      />
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={o.showArea !== false}
            onChange={(e) => onChange({ ...o, showArea: e.target.checked })}
          />
        }
        label={<Typography variant="body2">Area fill</Typography>}
        sx={{ ml: 0 }}
      />
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={o.stacked === true}
            onChange={(e) => onChange({ ...o, stacked: e.target.checked })}
          />
        }
        label={<Typography variant="body2">Stacked</Typography>}
        sx={{ ml: 0 }}
      />
    </>
  );
}

export function BarChartOptionsEditor({ options, onChange }: VizOptionsEditorProps) {
  const o = options as BarChartOptions;
  return (
    <>
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={o.stacked === true}
            onChange={(e) => onChange({ ...o, stacked: e.target.checked })}
          />
        }
        label={<Typography variant="body2">Stacked</Typography>}
        sx={{ ml: 0 }}
      />
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={o.horizontal === true}
            onChange={(e) => onChange({ ...o, horizontal: e.target.checked })}
          />
        }
        label={<Typography variant="body2">Horizontal</Typography>}
        sx={{ ml: 0 }}
      />
    </>
  );
}

export function GaugeOptionsEditor({ options, onChange }: VizOptionsEditorProps) {
  const o = options as GaugePanelOptions;
  return (
    <>
      <TextField
        label="Min"
        size="small"
        type="number"
        value={o.min ?? ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange({
            ...o,
            min: e.target.value === "" || !Number.isFinite(n) ? undefined : n,
          });
        }}
        sx={{ width: 90 }}
      />
      <TextField
        label="Max"
        size="small"
        type="number"
        value={o.max ?? ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange({
            ...o,
            max: e.target.value === "" || !Number.isFinite(n) ? undefined : n,
          });
        }}
        sx={{ width: 90 }}
      />
    </>
  );
}

export function HistogramOptionsEditor({ options, onChange }: VizOptionsEditorProps) {
  const o = options as HistogramChartOptions;
  return (
    <TextField
      label="Bins"
      size="small"
      type="number"
      value={o.bins ?? 10}
      onChange={(e) => {
        const n = Number(e.target.value);
        onChange({
          ...o,
          bins: !Number.isFinite(n) || n < 1 ? 10 : Math.min(Math.round(n), 100),
        });
      }}
      sx={{ width: 90 }}
      inputProps={{ min: 1, max: 100 }}
    />
  );
}
