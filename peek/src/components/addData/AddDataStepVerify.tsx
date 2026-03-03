import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";

import type { AddDataTechnologyCatalogEntry } from "../../services/addData/catalog";
import type { ElasticsearchConnection } from "../../services/es";
import type { TelemetrySignal } from "../../utils/addDataUtils";
import type { VerifyStatus } from "../../hooks/useIngestionVerification";
import AskAiButton from "../AskAiButton";

interface AddDataStepVerifyProps {
  selectedTechnology: AddDataTechnologyCatalogEntry | null;
  signalExpectation: string;
  connection: ElasticsearchConnection | null;
  verifyStatus: VerifyStatus;
  foundSignals: Set<TelemetrySignal>;
  verifyError: string | null;
  handleVerifyIngestion: () => void;
  selectedSignals: readonly TelemetrySignal[];
  onBack: () => void;
  onContinue: () => void;
}

export default function AddDataStepVerify({
  selectedTechnology,
  signalExpectation,
  connection,
  verifyStatus,
  foundSignals,
  verifyError,
  handleVerifyIngestion,
  selectedSignals,
  onBack,
  onContinue,
}: AddDataStepVerifyProps) {
  const expectedButMissingSignals = selectedSignals.filter((signal) => !foundSignals.has(signal));
  const foundExpectedSignals = selectedSignals.filter((signal) => foundSignals.has(signal));

  return (
    <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1.5 }}>
      <Typography variant="h6">Step 4: Validate data receipt</Typography>
      <Typography variant="body2" color="text.secondary">
        For {selectedTechnology?.technology ?? "this integration"}, we expect to receive{" "}
        {signalExpectation}.
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          size="small"
          variant="contained"
          onClick={() => void handleVerifyIngestion()}
          disabled={!connection || verifyStatus === "checking" || verifyStatus === "polling"}
          startIcon={
            verifyStatus === "checking" || verifyStatus === "polling" ? (
              <CircularProgress size={16} />
            ) : (
              <CheckCircleOutlineIcon fontSize="small" />
            )
          }
        >
          {verifyStatus === "checking" || verifyStatus === "polling" ? "Checking…" : "Check now"}
        </Button>
        {verifyStatus === "polling" && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <RadioButtonCheckedIcon
              color="info"
              sx={{
                animation: "pulse 1.5s ease-in-out infinite",
                fontSize: 16,
                "@keyframes pulse": {
                  "0%, 100%": { opacity: 1 },
                  "50%": { opacity: 0.3 },
                },
              }}
            />
            <Typography variant="body2" color="info.main">
              Listening for data…
            </Typography>
          </Stack>
        )}
      </Stack>

      {verifyStatus === "error" && <Alert severity="error">{verifyError}</Alert>}

      {(verifyStatus === "not_found" ||
        (verifyStatus === "polling" && foundSignals.size === 0)) && (
        <>
          <Alert severity="info">
            No telemetry data streams found yet. Make sure the collector is running — we&apos;ll
            keep checking automatically.{" "}
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

      {verifyStatus === "found" && (
        <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
          Telemetry data detected! Found: {Array.from(foundSignals).sort().join(", ")}.
          {expectedButMissingSignals.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Partial success
              </Typography>
              <Typography variant="body2">
                We found {foundExpectedSignals.join(", ") || "telemetry"}, but still missing{" "}
                {expectedButMissingSignals.join(", ")} for{" "}
                {selectedTechnology?.technology ?? "this source"}.
              </Typography>
            </Box>
          )}
        </Alert>
      )}

      <Stack direction="row" justifyContent="space-between">
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
        <Button variant="contained" onClick={onContinue}>
          Continue to step 5
        </Button>
      </Stack>
    </Paper>
  );
}
