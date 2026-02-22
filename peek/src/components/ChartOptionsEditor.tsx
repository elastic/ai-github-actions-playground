import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
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
  StatPanelOptions,
  TablePanelOptions,
  ThresholdColor,
  Thresholds,
  TimeSeriesOptions,
  VisualizationOptions,
  VisualizationType,
} from "../types";

import { THRESHOLD_PALETTE } from "./visualizations/thresholdUtils";

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

const THRESHOLD_COLOR_OPTIONS: { label: string; value: ThresholdColor }[] = [
  { label: "Success", value: "success" },
  { label: "Warning", value: "warning" },
  { label: "Error", value: "error" },
];

/**
 * Editor for configuring threshold rules.
 * Renders a base color picker and a list of threshold steps (value + color).
 */
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
    const newStep = { value: 0, color: "error" as ThresholdColor };
    onChange({ steps: [...steps, newStep], baseColor });
  };

  const handleRemoveStep = (idx: number) => {
    const next = steps.filter((_, i) => i !== idx);
    onChange(next.length > 0 || value?.baseColor ? { steps: next, baseColor } : undefined);
  };

  const handleStepValueChange = (idx: number, newValue: string) => {
    const n = Number(newValue);
    if (!Number.isFinite(n)) return;
    const next = steps.map((s, i) => (i === idx ? { ...s, value: n } : s));
    onChange({ steps: next, baseColor });
  };

  const handleStepColorChange = (idx: number, color: ThresholdColor) => {
    const next = steps.map((s, i) => (i === idx ? { ...s, color } : s));
    onChange({ steps: next, baseColor });
  };

  const handleBaseColorChange = (color: ThresholdColor) => {
    onChange({ steps, baseColor: color });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>
          Base color
        </Typography>
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <Select
            value={baseColor}
            onChange={(e) => handleBaseColorChange(e.target.value as ThresholdColor)}
            renderValue={(v) => (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: THRESHOLD_PALETTE[v as ThresholdColor],
                    flexShrink: 0,
                  }}
                />
                {THRESHOLD_COLOR_OPTIONS.find((o) => o.value === v)?.label}
              </Box>
            )}
          >
            {THRESHOLD_COLOR_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: THRESHOLD_PALETTE[opt.value],
                      flexShrink: 0,
                    }}
                  />
                  {opt.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {steps.map((step, idx) => (
        <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <TextField
            size="small"
            type="number"
            label="Value ≥"
            value={step.value}
            onChange={(e) => handleStepValueChange(idx, e.target.value)}
            sx={{ width: 90 }}
          />
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <Select
              value={step.color}
              onChange={(e) => handleStepColorChange(idx, e.target.value as ThresholdColor)}
              renderValue={(v) => (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: THRESHOLD_PALETTE[v as ThresholdColor],
                      flexShrink: 0,
                    }}
                  />
                  {THRESHOLD_COLOR_OPTIONS.find((o) => o.value === v)?.label}
                </Box>
              )}
            >
              {THRESHOLD_COLOR_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: THRESHOLD_PALETTE[opt.value],
                        flexShrink: 0,
                      }}
                    />
                    {opt.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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

  const showFormat = vizType !== "table";
  const showThresholds = vizType === "stat" || vizType === "gauge" || vizType === "table";

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, mt: 1 }}>
        Options
      </Typography>

      {showFormat && <FormatEditor value={format} onChange={handleFormatChange} />}

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

      {showThresholds && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Thresholds
            </Typography>
            <ThresholdEditor
              value={
                (options as StatPanelOptions | GaugePanelOptions | TablePanelOptions | undefined)
                  ?.thresholds
              }
              onChange={(t) => onChange({ ...options, thresholds: t })}
            />
          </Box>
        </>
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
