/**
 * Type-specific options editor sub-components used by the visualization registry.
 * Exported so that the registry can reference them without mixing component and
 * non-component exports in the same module.
 */

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

import type {
  BarChartOptions,
  GaugePanelOptions,
  HistogramChartOptions,
  StatPanelOptions,
  TablePanelOptions,
  ThresholdColor,
  Thresholds,
  TimeSeriesOptions,
} from "../../types";

import { THRESHOLD_PALETTE } from "./thresholdUtils";
import type { VizOptionsEditorProps } from "./vizRegistry";

// ---------------------------------------------------------------------------
// Threshold editor (shared between stat, gauge, table)
// ---------------------------------------------------------------------------

const THRESHOLD_COLOR_OPTIONS: { label: string; value: ThresholdColor }[] = [
  { label: "Success", value: "success" },
  { label: "Warning", value: "warning" },
  { label: "Error", value: "error" },
];

function ThresholdColorSwatch({ color }: { color: ThresholdColor }) {
  return (
    <Box
      sx={{
        flexShrink: 0,
        width: 10,
        height: 10,
        borderRadius: "50%",
        bgcolor: THRESHOLD_PALETTE[color],
      }}
    />
  );
}

function ThresholdColorSelect({
  value,
  onChange,
}: {
  value: ThresholdColor;
  onChange: (c: ThresholdColor) => void;
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 110 }}>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as ThresholdColor)}
        renderValue={(v) => (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <ThresholdColorSwatch color={v as ThresholdColor} />
            {THRESHOLD_COLOR_OPTIONS.find((o) => o.value === v)?.label}
          </Box>
        )}
      >
        {THRESHOLD_COLOR_OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <ThresholdColorSwatch color={opt.value} />
              {opt.label}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function ThresholdEditor({
  value,
  onChange,
}: {
  value?: Thresholds;
  onChange: (t: Thresholds | undefined) => void;
}) {
  const steps = value?.steps ?? [];
  const baseColor: ThresholdColor = value?.baseColor ?? "success";

  const handleAddStep = () => {
    onChange({ steps: [...steps, { value: 0, color: "error" as ThresholdColor }], baseColor });
  };

  const handleRemoveStep = (idx: number) => {
    const next = steps.filter((_, i) => i !== idx);
    onChange(next.length > 0 || value?.baseColor ? { steps: next, baseColor } : undefined);
  };

  const handleStepValueChange = (idx: number, raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange({ steps: steps.map((s, i) => (i === idx ? { ...s, value: n } : s)), baseColor });
  };

  const handleStepColorChange = (idx: number, color: ThresholdColor) => {
    onChange({ steps: steps.map((s, i) => (i === idx ? { ...s, color } : s)), baseColor });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 0.5 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>
          Base color
        </Typography>
        <ThresholdColorSelect
          value={baseColor}
          onChange={(c) => onChange({ steps, baseColor: c })}
        />
      </Box>

      {steps.map((step, idx) => (
        <Box key={idx} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            size="small"
            type="number"
            label="Value ≥"
            value={step.value}
            onChange={(e) => handleStepValueChange(idx, e.target.value)}
            sx={{ width: 90 }}
          />
          <ThresholdColorSelect
            value={step.color}
            onChange={(c) => handleStepColorChange(idx, c)}
          />
          <IconButton
            size="small"
            aria-label={`remove threshold step ${idx + 1}`}
            onClick={() => handleRemoveStep(idx)}
          >
            <DeleteIcon fontSize="inherit" />
          </IconButton>
        </Box>
      ))}

      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={handleAddStep}
        sx={{ alignSelf: "flex-start" }}
      >
        Add threshold
      </Button>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Viz-type editors
// ---------------------------------------------------------------------------

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
      <ThresholdEditor value={o.thresholds} onChange={(t) => onChange({ ...o, thresholds: t })} />
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

export function StatOptionsEditor({ options, onChange }: VizOptionsEditorProps) {
  const o = options as StatPanelOptions;
  return (
    <ThresholdEditor value={o.thresholds} onChange={(t) => onChange({ ...o, thresholds: t })} />
  );
}

export function TableOptionsEditor({ options, onChange }: VizOptionsEditorProps) {
  const o = options as TablePanelOptions;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>
          Columns
        </Typography>
        <TextField
          size="small"
          placeholder="All numeric columns"
          value={o.thresholdColumns?.join(", ") ?? ""}
          onChange={(e) => {
            const raw = e.target.value.trim();
            const cols = raw
              ? raw
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : undefined;
            onChange({ ...o, thresholdColumns: cols });
          }}
          sx={{ width: 220 }}
          inputProps={{ "aria-label": "threshold columns" }}
        />
      </Box>
      <ThresholdEditor value={o.thresholds} onChange={(t) => onChange({ ...o, thresholds: t })} />
    </Box>
  );
}
