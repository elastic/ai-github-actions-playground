import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";

import type { IngestionVerificationState } from "../../hooks/useRichIngestionVerification";
import type { TelemetrySignal } from "../../utils/addDataUtils";
import type { PerSignalDelta } from "../../services/addData/ingestionQueries";
import AskAiButton from "../AskAiButton";

import SignalVerificationCard from "./SignalVerificationCard";

const PULSE_ICON_SX = {
  animation: "ingestionPulse 1.5s ease-in-out infinite",
  fontSize: 16,
  "@keyframes ingestionPulse": {
    "0%, 100%": { opacity: 1 },
    "50%": { opacity: 0.3 },
  },
} as const;

interface IngestionVerificationPanelProps {
  technologyName: string;
  signalExpectation: string;
  expectedSignals: readonly TelemetrySignal[];
  verification: IngestionVerificationState;
  connectionAvailable: boolean;
}

export default function IngestionVerificationPanel({
  technologyName,
  signalExpectation,
  expectedSignals,
  verification,
  connectionAvailable,
}: IngestionVerificationPanelProps) {
  const { status, deltas, overallDetected, error } = verification;
  const isPolling = status === "polling" || status === "capturing_baseline";
  const isActive = isPolling || status === "detected";

  // Build per-signal deltas for display (even when no deltas yet, show placeholder cards)
  const displayDeltas: PerSignalDelta[] =
    deltas.length > 0
      ? deltas
      : expectedSignals.map((signal) => ({
          signal,
          dataStreamAppeared: false,
          newHostsDetected: 0,
          newAgentsDetected: 0,
          docCountDelta: 0,
          isDataFlowing: false,
          latestTimestampIsRecent: false,
          latestTimestamp: null,
          currentHostCount: 0,
          currentAgentCount: 0,
          currentDocCount: 0,
        }));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Typography variant="body2" color="text.secondary">
        For {technologyName}, we expect to receive {signalExpectation}.
      </Typography>

      {/* Action row */}
      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          size="small"
          variant="contained"
          onClick={() => {
            if (status === "idle") {
              verification.startPolling();
              return;
            }
            if (status === "error" && !verification.baseline) {
              verification.resetVerification();
              verification.startPolling();
              return;
            }
            verification.checkNow();
          }}
          disabled={!connectionAvailable || status === "capturing_baseline"}
          startIcon={
            isPolling ? <CircularProgress size={16} /> : <CheckCircleOutlineIcon fontSize="small" />
          }
        >
          {isPolling ? "Checking..." : "Check now"}
        </Button>
        {isPolling && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <RadioButtonCheckedIcon color="info" sx={PULSE_ICON_SX} />
            <Typography variant="body2" color="info.main">
              Listening for data...
            </Typography>
          </Stack>
        )}
      </Stack>

      {/* Per-signal cards */}
      {(isActive || overallDetected || deltas.length > 0) && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 1,
          }}
        >
          {displayDeltas.map((delta) => (
            <SignalVerificationCard key={delta.signal} delta={delta} isPolling={isPolling} />
          ))}
        </Box>
      )}

      {/* Overall status alert */}
      {status === "error" && (
        <Alert severity="error">
          {error ?? "An error occurred while verifying data ingestion."}
        </Alert>
      )}

      {status === "polling" && !overallDetected && (
        <>
          <Alert severity="info">
            No new data detected yet. Make sure the collector is running — we&apos;ll keep checking
            automatically.{" "}
            <Link
              href="https://www.elastic.co/docs/solutions/observability/get-started/opentelemetry"
              target="_blank"
              rel="noopener noreferrer"
            >
              Troubleshooting docs
            </Link>
          </Alert>
          <AskAiButton
            prompt="No data found yet. Describe what you see or paste an error, and I'll help troubleshoot."
            label="Troubleshoot with AI"
          />
        </>
      )}

      {overallDetected && <DetectionSummaryAlert deltas={deltas} />}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Detection summary
// ---------------------------------------------------------------------------

function DetectionSummaryAlert({ deltas }: { deltas: PerSignalDelta[] }) {
  const parts: string[] = [];

  const newStreams = deltas.filter((d) => d.dataStreamAppeared).map((d) => d.signal);
  if (newStreams.length > 0) {
    parts.push(`${newStreams.join(", ")} data stream${newStreams.length > 1 ? "s" : ""} appeared`);
  }

  const hostsAdded = deltas.reduce((sum, d) => sum + d.newHostsDetected, 0);
  if (hostsAdded > 0) {
    parts.push(`${hostsAdded} new host${hostsAdded > 1 ? "s" : ""} detected`);
  }

  const agentsAdded = deltas.reduce((sum, d) => sum + d.newAgentsDetected, 0);
  if (agentsAdded > 0) {
    parts.push(`${agentsAdded} new agent${agentsAdded > 1 ? "s" : ""} detected`);
  }

  const flowing = deltas.filter((d) => d.isDataFlowing && !d.dataStreamAppeared);
  if (flowing.length > 0) {
    parts.push("data is flowing — document counts are increasing");
  }

  const message = parts.length > 0 ? parts.join(". ") + "." : "New data detected!";

  return (
    <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
      {message.charAt(0).toUpperCase() + message.slice(1)}
    </Alert>
  );
}
