import { useState } from "react";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

export type RefreshIntervalOption = { label: string; seconds: number };

interface RefreshIntervalPickerProps {
  value: number;
  options: RefreshIntervalOption[];
  onChange: (seconds: number) => void;
  size?: "small" | "medium" | "large";
  variant?: "text" | "outlined" | "contained";
}

export default function RefreshIntervalPicker({
  value,
  options,
  onChange,
  size = "small",
  variant = "outlined",
}: RefreshIntervalPickerProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const selected = options.find((option) => option.seconds === value);

  return (
    <>
      <Button size={size} variant={variant} onClick={(event) => setAnchorEl(event.currentTarget)}>
        {selected?.label ?? `${value}s`}
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {options.map((option) => (
          <MenuItem
            key={option.label}
            selected={option.seconds === value}
            onClick={() => {
              onChange(option.seconds);
              setAnchorEl(null);
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
