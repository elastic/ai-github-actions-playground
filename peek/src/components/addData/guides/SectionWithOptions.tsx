import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";

export interface SectionOption<T extends string> {
  value: T;
  label: string;
}

interface SectionWithOptionsProps<T extends string> {
  /** Optional label above the options (e.g. "Install method"). */
  label?: string;
  /** Options to display as a single row of toggles. */
  options: readonly SectionOption<T>[];
  /** Currently selected value. */
  value: T;
  /** Called when selection changes. */
  onChange: (value: T) => void;
  /** Content to show below the options. */
  children: ReactNode;
}

/**
 * Reusable section: a row of option toggles + content below.
 * Use for "Run once | Install on Debian/Ubuntu | Install on Red Hat/CentOS" style choices.
 */
export default function SectionWithOptions<T extends string>({
  label,
  options,
  value,
  onChange,
  children,
}: SectionWithOptionsProps<T>) {
  return (
    <Stack spacing={1}>
      {label && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {label}
        </Typography>
      )}
      <ToggleButtonGroup
        value={value}
        exclusive
        onChange={(_, v) => v != null && onChange(v)}
        size="small"
        aria-label={label ?? "Options"}
        sx={{
          flexWrap: "wrap",
          "& .MuiToggleButton-root": {
            py: 0.5,
            px: 1.5,
            textTransform: "none",
            fontSize: "0.8125rem",
          },
        }}
      >
        {options.map((opt) => (
          <ToggleButton key={opt.value} value={opt.value} aria-label={opt.label}>
            {opt.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Box>{children}</Box>
    </Stack>
  );
}
