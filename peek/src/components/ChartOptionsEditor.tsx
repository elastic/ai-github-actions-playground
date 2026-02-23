import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import {
  UNIT_CONFIG,
  UNIT_GROUP_CONFIG,
  isUnitWithDecimalPlaces,
  isUnitWithShortValues,
} from "@perses-dev/core";

import type { FormatOptions, VisualizationOptions, VisualizationType } from "../types";

import { getVizEntry } from "./visualizations/vizRegistry";

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
  const OptionsEditor = getVizEntry(vizType)?.OptionsEditor;
  // Table uses threshold-only options; format controls don't apply
  const showFormat = vizType !== "table";

  const handleFormatChange = (f: FormatOptions) => {
    onChange({ ...options, format: f });
  };

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 2, p: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, mt: 1 }}>
        Options
      </Typography>

      {showFormat && <FormatEditor value={format} onChange={handleFormatChange} />}

      {OptionsEditor && showFormat && <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />}

      {OptionsEditor && <OptionsEditor options={options} onChange={onChange} />}
    </Box>
  );
}
