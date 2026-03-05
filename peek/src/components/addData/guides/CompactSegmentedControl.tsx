import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

export interface CompactSegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface CompactSegmentedControlProps<T extends string> {
  value: T;
  options: readonly CompactSegmentedOption<T>[];
  onChange: (value: T) => void;
  /** Optional size. Default "small". */
  size?: "small" | "medium";
}

/**
 * Compact toggle for switching between two or more options (e.g. Quick command | Step by step).
 * Visually lighter than full Tabs to avoid "double tier" tab hierarchy.
 */
export default function CompactSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = "small",
}: CompactSegmentedControlProps<T>) {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={(_, v) => v != null && onChange(v)}
      size={size}
      sx={{
        "& .MuiToggleButton-root": {
          py: 0.5,
          px: 1,
          textTransform: "none",
          fontSize: "0.75rem",
        },
      }}
    >
      {options.map((opt) => (
        <ToggleButton key={opt.value} value={opt.value} aria-label={opt.label}>
          {opt.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
