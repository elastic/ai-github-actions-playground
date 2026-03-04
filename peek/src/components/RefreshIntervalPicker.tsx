import { useState } from "react";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import AutorenewIcon from "@mui/icons-material/Autorenew";

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
      <Button
        size={size}
        variant={variant}
        startIcon={<AutorenewIcon sx={{ fontSize: "0.95rem" }} />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorEl)}
      >
        {selected?.label ?? `${value}s`}
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {options.map((option) => (
          <MenuItem
            key={option.seconds}
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
