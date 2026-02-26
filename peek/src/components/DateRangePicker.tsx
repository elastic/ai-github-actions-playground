import { useState } from "react";
import Button from "@mui/material/Button";
import Popover from "@mui/material/Popover";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

import { resolveDateTime } from "../services/datemath";
import type { TimeRange } from "../types";

import { DASHBOARD_TIME_PRESETS } from "./timePresets";

/** Format a datetime-local string (YYYY-MM-DDTHH:mm) from a date-math or ISO value. */
function toDatetimeLocal(value: string): string {
  const resolved = resolveDateTime(value) ?? new Date(value);
  const d = Number.isNaN(resolved.getTime()) ? new Date() : resolved;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Return a human-readable label for the current time range. */
function formatRangeLabel(range: TimeRange, timeZone?: string): string {
  const preset = DASHBOARD_TIME_PRESETS.find(
    (p) => p.range.from === range.from && p.range.to === range.to,
  );
  if (preset) return preset.label;

  const fmt = (v: string) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleString(undefined, {
      timeZone: timeZone || undefined,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  return `${fmt(range.from)} – ${fmt(range.to)}`;
}

interface Props {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  timeZone?: string;
}

export default function DateRangePicker({ value, onChange, timeZone }: Props) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const open = Boolean(anchor);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setCustomFrom(toDatetimeLocal(value.from));
    setCustomTo(toDatetimeLocal(value.to));
    setAnchor(e.currentTarget);
  };

  const handleClose = () => setAnchor(null);

  const handlePreset = (range: TimeRange) => {
    onChange(range);
    handleClose();
  };

  const handleApplyCustom = () => {
    const fromDate = new Date(customFrom);
    const toDate = new Date(customTo);
    if (
      !customFrom ||
      !customTo ||
      Number.isNaN(fromDate.getTime()) ||
      Number.isNaN(toDate.getTime()) ||
      fromDate.getTime() >= toDate.getTime()
    )
      return;
    onChange({ from: fromDate.toISOString(), to: toDate.toISOString() });
    handleClose();
  };

  const fromMs = new Date(customFrom).getTime();
  const toMs = new Date(customTo).getTime();
  const customRangeInvalid =
    !customFrom || !customTo || Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs >= toMs;

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<AccessTimeIcon fontSize="small" />}
        onClick={handleOpen}
        aria-label={`Time range: ${formatRangeLabel(value, timeZone)}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {formatRangeLabel(value, timeZone)}
      </Button>

      <Popover
        open={open}
        anchorEl={anchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { display: "flex" } } }}
      >
        {/* Quick-select presets */}
        <Box sx={{ borderRight: 1, borderColor: "divider", minWidth: 140 }}>
          <Typography
            variant="caption"
            sx={{
              px: 2,
              pt: 1.5,
              pb: 0.5,
              display: "block",
              color: "text.secondary",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Quick select
          </Typography>
          <List dense disablePadding>
            {DASHBOARD_TIME_PRESETS.map((preset) => (
              <ListItemButton
                key={preset.label}
                selected={preset.range.from === value.from && preset.range.to === value.to}
                onClick={() => handlePreset(preset.range)}
              >
                <ListItemText primary={preset.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Absolute custom range */}
        <Box sx={{ p: 2, minWidth: 220 }}>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: "text.secondary",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              mb: 1.5,
            }}
          >
            Custom range
          </Typography>
          <Stack spacing={1.5}>
            <TextField
              label="From"
              type="datetime-local"
              size="small"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label="To"
              type="datetime-local"
              size="small"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleApplyCustom}
              disabled={customRangeInvalid}
              fullWidth
            >
              Apply
            </Button>
          </Stack>
        </Box>
      </Popover>
    </>
  );
}
