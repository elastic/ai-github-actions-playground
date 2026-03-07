import LoadingButton from "./LoadingButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { formatTime } from "../utils/formatDate";

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
  const refreshLabel = loading ? "Refreshing..." : "Refresh";

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="caption" color="text.secondary">
        Last updated: {lastUpdatedAt ? formatTime(lastUpdatedAt, { short: true }) : "—"}
      </Typography>
      <RefreshIntervalPicker
        value={refreshIntervalSeconds}
        options={refreshOptions}
        onChange={onIntervalChange}
      />
      <LoadingButton
        size="small"
        variant="outlined"
        onClick={onRefresh}
        loading={loading}
        aria-label={refreshLabel}
      >
        {refreshLabel}
      </LoadingButton>
    </Stack>
  );
}
