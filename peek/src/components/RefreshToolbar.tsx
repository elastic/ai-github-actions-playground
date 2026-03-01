import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import RefreshIntervalPicker, { type RefreshIntervalOption } from "./RefreshIntervalPicker";

interface RefreshToolbarProps {
  lastUpdatedAt: string | number | null;
  refreshIntervalSeconds: number;
  refreshOptions: RefreshIntervalOption[];
  onIntervalChange: (seconds: number) => void;
  onRefresh: () => void;
  loading: boolean;
}

export default function RefreshToolbar({
  lastUpdatedAt,
  refreshIntervalSeconds,
  refreshOptions,
  onIntervalChange,
  onRefresh,
  loading,
}: RefreshToolbarProps) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="caption" color="text.secondary">
        Last updated:{" "}
        {lastUpdatedAt
          ? new Date(lastUpdatedAt).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : "—"}
      </Typography>
      <RefreshIntervalPicker
        value={refreshIntervalSeconds}
        options={refreshOptions}
        onChange={onIntervalChange}
      />
      <Button size="small" variant="outlined" onClick={onRefresh} disabled={loading}>
        {loading ? <CircularProgress size={16} /> : "Refresh"}
      </Button>
    </Stack>
  );
}
