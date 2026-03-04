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
import MenuItem from "@mui/material/MenuItem";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PublicIcon from "@mui/icons-material/Public";

import { resolveDateTime } from "../services/datemath";
import type { TimeRange } from "../types";
import { DASHBOARD_TIMEZONE_OPTIONS } from "../schemas";

import { DASHBOARD_TIME_PRESETS } from "./timePresets";
import { getCustomRangeValidationError } from "./dateRangeValidation";

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
  onTimeZoneChange?: (timeZone: string | undefined) => void;
}

export default function DateRangePicker({ value, onChange, timeZone, onTimeZoneChange }: Props) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("sm"));
  const open = Boolean(anchor);
  const currentTimeZoneLabel =
    DASHBOARD_TIMEZONE_OPTIONS.find((o) => o.value === (timeZone ?? ""))?.label ??
    (timeZone || "Browser local");

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

  const customRangeError = getCustomRangeValidationError(customFrom, customTo);
  const customRangeInvalid = customRangeError !== null;

  const handleApplyCustom = () => {
    if (customRangeInvalid) return;
    const fromDate = new Date(customFrom);
    const toDate = new Date(customTo);
    onChange({ from: fromDate.toISOString(), to: toDate.toISOString() });
    handleClose();
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<AccessTimeIcon fontSize="small" sx={{ color: "inherit" }} />}
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
        slotProps={{
          paper: {
            sx: {
              display: "flex",
              flexDirection: { sm: "row", xs: "column" },
              width: { sm: "auto", xs: "min(92vw, 360px)" },
            },
          },
        }}
      >
        {/* Quick-select presets */}
        <Box
          sx={{
            minWidth: { sm: 140, xs: "100%" },
            borderRight: { sm: 1, xs: 0 },
            borderBottom: { sm: 0, xs: 1 },
            borderColor: "divider",
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: "block",
              pt: 1.5,
              pb: 0.5,
              px: 2,
              color: "text.secondary",
              letterSpacing: 0.5,
              textTransform: "uppercase",
              fontWeight: 600,
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

        {!isNarrow && <Divider orientation="vertical" flexItem />}

        {/* Absolute custom range */}
        <Box sx={{ minWidth: { sm: 220, xs: "100%" }, p: 2 }}>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mb: 1.5,
              color: "text.secondary",
              letterSpacing: 0.5,
              textTransform: "uppercase",
              fontWeight: 600,
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
              error={customRangeInvalid}
              helperText={customRangeError}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label="To"
              type="datetime-local"
              size="small"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              error={customRangeInvalid}
              helperText={customRangeError}
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
            {onTimeZoneChange && (
              <>
                <Divider />
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      display: "flex",
                      gap: 0.5,
                      alignItems: "center",
                      mb: 1,
                      color: "text.secondary",
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    <PublicIcon sx={{ fontSize: 14 }} />
                    Timezone
                  </Typography>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    value={timeZone ?? ""}
                    onChange={(e) => onTimeZoneChange(e.target.value || undefined)}
                    aria-label={`Timezone: ${currentTimeZoneLabel}`}
                    slotProps={{
                      select: {
                        displayEmpty: true,
                        renderValue: (selected) =>
                          DASHBOARD_TIMEZONE_OPTIONS.find(
                            (option) => option.value === String(selected),
                          )?.label ?? "Browser local",
                      },
                    }}
                  >
                    {DASHBOARD_TIMEZONE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
              </>
            )}
          </Stack>
        </Box>
      </Popover>
    </>
  );
}
