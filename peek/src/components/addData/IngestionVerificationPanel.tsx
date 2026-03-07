import { useEffect } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";

import type { IngestionVerificationState } from "../../hooks/useRichIngestionVerification";
import type { TelemetrySignal } from "../../utils/addDataUtils";
import type { PerSignalDelta } from "../../services/addData/ingestionQueries";
import AskAiButton from "../AskAiButton";

import SignalVerificationCard from "./SignalVerificationCard";
import { PULSE_KEYFRAMES } from "./guides/sharedStyles";

const PULSE_ICON_SX = {
  animation: "pulse 1.5s ease-in-out infinite",
  fontSize: 16,
  ...PULSE_KEYFRAMES,
} as const;

interface IngestionVerificationPanelProps {
  technologyName: string;
  isAwsDeploymentVerification?: boolean;
  signalExpectation: string;
  expectedSignals: readonly TelemetrySignal[];
  verification: IngestionVerificationState;
  connectionAvailable: boolean;
  troubleshootingDocsUrl?: string;
  autoStart?: boolean;
}

export default function IngestionVerificationPanel({
  technologyName,
  isAwsDeploymentVerification = false,
  signalExpectation,
  expectedSignals,
  verification,
  connectionAvailable,
  troubleshootingDocsUrl,
  autoStart = true,
}: IngestionVerificationPanelProps) {
  const { status, deltas, overallDetected, error } = verification;
  const isPolling = status === "polling" || status === "capturing_baseline";
  const isActive = isPolling || status === "detected";
  useEffect(() => {
    if (!autoStart) return;
    if (!connectionAvailable) return;
    if (status !== "idle") return;
    verification.startPolling();
  }, [autoStart, connectionAvailable, status, verification]);

  // Build per-signal deltas for display (even when no deltas yet, show placeholder cards)
  const displayDeltas: PerSignalDelta[] =
    deltas.length > 0
      ? deltas
      : expectedSignals.map((signal) => ({
          signal,
          baselineDataStreamExists: false,
          dataStreamAppeared: false,
          newHostsDetected: 0,
          newHostNames: [],
          newServicesDetected: 0,
          newServiceNames: [],
          newAgentsDetected: 0,
          docCountDelta: 0,
          docsPerSecondDelta: 0,
          isDataFlowing: false,
          signalDetected: false,
          latestTimestampIsRecent: false,
          latestTimestamp: null,
          currentHostCount: 0,
          currentServiceCount: 0,
          currentAgentCount: 0,
          currentDocCount: 0,
          currentDocsPerSecond: 0,
        }));
  const detectedMessage = getDetectedMessage(deltas);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Typography variant="body2" color="text.secondary">
        {isAwsDeploymentVerification
          ? "Verifying stack deployment."
          : `${technologyName} sends ${signalExpectation}.`}
      </Typography>
      {isAwsDeploymentVerification && (
        <Typography variant="caption" color="text.secondary">
          Checking for successful stack deployment by detecting new telemetry data in the cluster.
        </Typography>
      )}

      {/* Action row */}
      <Stack direction="row" spacing={1} alignItems="center">
        {status === "idle" && connectionAvailable && (
          <Button size="small" variant="outlined" onClick={() => verification.startPolling()}>
            Check now
          </Button>
        )}
        {isPolling && (
          <Tooltip title="Verification checks for new streams, meaningful increase in docs/sec rate (not just a random batch), and new hosts/agents sending data.">
            <Stack direction="row" spacing={0.5} alignItems="center">
              <RadioButtonCheckedIcon color="info" sx={PULSE_ICON_SX} />
              <Typography variant="body2" color="info.main">
                Checking...
              </Typography>
            </Stack>
          </Tooltip>
        )}
        {(isPolling || status === "error") && (
          <AskAiButton
            prompt="I'm onboarding data but not seeing expected ingestion signals. Help me troubleshoot collector setup and data flow."
            label="Troubleshoot data collection"
          />
        )}
        {!isPolling && status === "detected" && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <CheckCircleOutlineIcon color="success" fontSize="small" />
            <Typography variant="body2" color="info.main">
              {detectedMessage}
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
            {isAwsDeploymentVerification
              ? "No meaningful ingestion changes detected yet. Make sure your Amazon Data Firehose delivery stream is active and sending telemetry to Elastic - we'll keep checking automatically."
              : "No meaningful ingestion changes detected yet. Make sure the collector is running and producing telemetry - we'll keep checking automatically."}{" "}
            <Link
              href={
                troubleshootingDocsUrl ??
                "https://www.elastic.co/docs/solutions/observability/get-started/opentelemetry"
              }
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
    </Box>
  );
}

function getDetectedMessage(deltas: PerSignalDelta[]): string {
  const hostsAdded = deltas.reduce((sum, d) => sum + d.newHostsDetected, 0);
  if (hostsAdded > 0) {
    return `${hostsAdded} new host${hostsAdded > 1 ? "s" : ""} detected!`;
  }

  const servicesAdded = deltas.reduce((sum, d) => sum + d.newServicesDetected, 0);
  if (servicesAdded > 0) {
    return `${servicesAdded} new service${servicesAdded > 1 ? "s" : ""} detected!`;
  }

  const agentsAdded = deltas.reduce((sum, d) => sum + d.newAgentsDetected, 0);
  if (agentsAdded > 0) {
    return `${agentsAdded} new agent${agentsAdded > 1 ? "s" : ""} detected!`;
  }

  const newStreams = deltas.filter((d) => d.dataStreamAppeared).map((d) => d.signal);
  if (newStreams.length > 0) {
    return `${newStreams.length} new data stream${newStreams.length > 1 ? "s" : ""} detected!`;
  }

  return "Data detected!";
}
