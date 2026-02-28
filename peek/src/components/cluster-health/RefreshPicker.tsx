import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

const INTERVALS = [
  { label: "Off", ms: 0 },
  { label: "10s", ms: 10_000 },
  { label: "30s", ms: 30_000 },
  { label: "1m", ms: 60_000 },
  { label: "5m", ms: 300_000 },
];

interface RefreshPickerProps {
  intervalMs: number;
  onIntervalChange: (ms: number) => void;
  onRefresh: () => void;
  loading: boolean;
  lastUpdatedAt: string | null;
}

export default function RefreshPicker({
  intervalMs,
  onIntervalChange,
  onRefresh,
  loading,
  lastUpdatedAt,
}: RefreshPickerProps) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {lastUpdatedAt ? (
        <Typography variant="caption" color="text.secondary">
          Last update: {new Date(lastUpdatedAt).toLocaleTimeString()}
        </Typography>
      ) : null}
      <Select
        size="small"
        value={intervalMs}
        onChange={(e) => onIntervalChange(Number(e.target.value))}
        inputProps={{ "aria-label": "Auto-refresh interval" }}
        sx={{ minWidth: 80, "& .MuiSelect-select": { py: 0.5 } }}
      >
        {INTERVALS.map((opt) => (
          <MenuItem key={opt.ms} value={opt.ms}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
      <Button
        size="small"
        variant="outlined"
        onClick={onRefresh}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={14} aria-hidden="true" /> : undefined}
      >
        Refresh
      </Button>
    </Stack>
  );
}
