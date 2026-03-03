import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";

import type { PerSignalDelta } from "../../services/addData/ingestionQueries";

const SIGNAL_LABELS: Record<string, string> = {
  logs: "Logs",
  metrics: "Metrics",
  traces: "Traces",
};

const SIGNAL_COLORS: Record<string, "info" | "success" | "warning"> = {
  logs: "info",
  metrics: "success",
  traces: "warning",
};

interface SignalVerificationCardProps {
  delta: PerSignalDelta;
  isPolling: boolean;
}

export default function SignalVerificationCard({ delta, isPolling }: SignalVerificationCardProps) {
  const detected =
    delta.dataStreamAppeared ||
    delta.isDataFlowing ||
    delta.newHostsDetected > 0 ||
    delta.newAgentsDetected > 0;
  const label = SIGNAL_LABELS[delta.signal] ?? delta.signal;
  const color = SIGNAL_COLORS[delta.signal] ?? "info";

  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        flex: "1 1 0",
        flexDirection: "column",
        gap: 0.5,
        minWidth: 140,
        p: 1.5,
      }}
    >
      {/* Header: signal label + status icon */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="body2" color={`${color}.main`} sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <StatusIcon detected={detected} isPolling={isPolling} />
      </Box>

      {/* Doc count */}
      <Box sx={{ display: "flex", gap: 0.5, alignItems: "baseline" }}>
        <Typography variant="h6" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {formatNumber(delta.currentDocCount)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          docs
        </Typography>
        {delta.docCountDelta > 0 && (
          <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
            +{formatNumber(delta.docCountDelta)}
          </Typography>
        )}
      </Box>

      {/* Host count */}
      <Box sx={{ display: "flex", gap: 0.5, alignItems: "baseline" }}>
        <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
          {delta.currentHostCount > 0
            ? `${delta.currentHostCount} host${delta.currentHostCount !== 1 ? "s" : ""}`
            : "--"}
        </Typography>
        {delta.newHostsDetected > 0 && (
          <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
            +{delta.newHostsDetected} new!
          </Typography>
        )}
      </Box>

      {/* Last seen */}
      <Typography variant="caption" color="text.secondary">
        {delta.latestTimestamp
          ? `Last: ${formatRelativeTime(delta.latestTimestamp)}`
          : "Last: never"}
      </Typography>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Sub-components & helpers
// ---------------------------------------------------------------------------

function StatusIcon({ detected, isPolling }: { detected: boolean; isPolling: boolean }) {
  if (detected) {
    return <CheckCircleIcon color="success" fontSize="small" />;
  }
  if (isPolling) {
    return (
      <RadioButtonCheckedIcon
        color="info"
        sx={{
          animation: "pulse 1.5s ease-in-out infinite",
          fontSize: 18,
          "@keyframes pulse": {
            "0%, 100%": { opacity: 1 },
            "50%": { opacity: 0.3 },
          },
        }}
      />
    );
  }
  return <RadioButtonUncheckedIcon color="disabled" fontSize="small" />;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatRelativeTime(isoTimestamp: string): string {
  const deltaMs = Date.now() - Date.parse(isoTimestamp);
  if (deltaMs < 0) return "just now";
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
