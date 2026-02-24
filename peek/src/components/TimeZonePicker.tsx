import { useState } from "react";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import PublicIcon from "@mui/icons-material/Public";

import { DASHBOARD_TIMEZONE_OPTIONS } from "../schemas";

interface Props {
  value: string | undefined;
  onChange: (tz: string | undefined) => void;
}

export default function TimeZonePicker({ value, onChange }: Props) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const open = Boolean(anchor);

  const currentLabel =
    DASHBOARD_TIMEZONE_OPTIONS.find((o) => o.value === (value ?? ""))?.label ??
    (value || "Browser local");

  const handleSelect = (tz: string) => {
    onChange(tz || undefined);
    setAnchor(null);
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<PublicIcon fontSize="small" />}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={`Timezone: ${currentLabel}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {currentLabel}
      </Button>
      <Menu
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        {DASHBOARD_TIMEZONE_OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            selected={(value ?? "") === option.value}
            onClick={() => handleSelect(option.value)}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
