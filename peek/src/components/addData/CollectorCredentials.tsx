import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useCallback, useState } from "react";

import { useCopyFeedbackTimeout } from "../../hooks/useCopyFeedbackTimeout";
import { copyToClipboard } from "../../utils/copyToClipboard";

interface CollectorCredentialsProps {
  apiKeyValue: string | null;
  manualApiKeyValue: string;
  onManualApiKeyValueChange: (value: string) => void;
  apiKeyError: string | null;
  creatingApiKey: boolean;
  onCreateApiKey: () => void;
  esUrl: string;
  probeTargetOtlpUrl?: string | null;
  ingestAvailable?: boolean | null;
}

export default function CollectorCredentials({
  apiKeyValue,
  manualApiKeyValue,
  onManualApiKeyValueChange,
  apiKeyError,
  creatingApiKey,
  onCreateApiKey,
  esUrl,
  probeTargetOtlpUrl,
  ingestAvailable,
}: CollectorCredentialsProps) {
  const [copiedApiKeyValue, setCopiedApiKeyValue] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const scheduleCopyFeedbackReset = useCopyFeedbackTimeout(() => setCopiedApiKeyValue(null));
  const effectiveApiKey = apiKeyValue ?? manualApiKeyValue.trim();
  const copied = effectiveApiKey.length > 0 && copiedApiKeyValue === effectiveApiKey;
  const handleCreateApiKey = useCallback(() => {
    setShowApiKey(false);
    onCreateApiKey();
  }, [onCreateApiKey]);
  const handleManualApiKeyValueChange = useCallback(
    (value: string) => {
      setShowApiKey(false);
      onManualApiKeyValueChange(value);
    },
    [onManualApiKeyValueChange],
  );

  const handleCopyApiKey = useCallback(async () => {
    if (!effectiveApiKey) return;
    const ok = await copyToClipboard(effectiveApiKey);
    if (!ok) return;
    setCopiedApiKeyValue(effectiveApiKey);
    scheduleCopyFeedbackReset();
  }, [effectiveApiKey, scheduleCopyFeedbackReset]);
  const isManualEntry = apiKeyValue == null && manualApiKeyValue.trim().length > 0;
  const hasProbeTarget = Boolean(probeTargetOtlpUrl);
  const outputMode =
    ingestAvailable === false || !hasProbeTarget ? "elasticsearch" : "managed_otlp";
  const otlpUndetectable = !probeTargetOtlpUrl;
  const otlpUnavailable = otlpUndetectable || ingestAvailable === false;
  const destinationUrl = outputMode === "managed_otlp" ? (probeTargetOtlpUrl ?? esUrl) : esUrl;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {typeof ingestAvailable !== "undefined" && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            p: 0,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Transport
            </Typography>
            <ToggleButtonGroup
              value={outputMode}
              exclusive
              disabled
              size="small"
              fullWidth
              aria-label="Detected transport (read only)"
              sx={{ maxWidth: 320, bgcolor: "transparent" }}
            >
              <ToggleButton value="elasticsearch">_BULK</ToggleButton>
              <ToggleButton value="managed_otlp">
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <span>OTLP</span>
                  {otlpUnavailable && (
                    <Tooltip title="Managed OTLP was not auto-detected. Using Elasticsearch output.">
                      <WarningAmberIcon color="warning" sx={{ fontSize: 16 }} />
                    </Tooltip>
                  )}
                </Stack>
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <TextField
            size="small"
            fullWidth
            label="Destination URL"
            value={destinationUrl}
            slotProps={{ input: { readOnly: true } }}
            sx={{
              "& .MuiInputBase-input": {
                fontSize: "0.8rem",
                fontFamily: "monospace",
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ minHeight: "1.25rem" }}>
            {otlpUnavailable
              ? "Sending data via Elasticsearch _bulk transport."
              : ingestAvailable === null
                ? "Checking managed OTLP endpoint availability..."
                : ""}
          </Typography>
        </Box>
      )}
      {apiKeyError && <Alert severity="error">{apiKeyError}</Alert>}
      {!effectiveApiKey && (
        <>
          <Button
            size="small"
            variant="contained"
            onClick={handleCreateApiKey}
            disabled={creatingApiKey}
            aria-busy={creatingApiKey}
            sx={{ alignSelf: "flex-start" }}
          >
            {creatingApiKey ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} aria-hidden="true" />
                Generating API key...
              </>
            ) : (
              "Generate API key"
            )}
          </Button>
          <Typography variant="body2" color="text.secondary">
            {creatingApiKey
              ? "Generating API key..."
              : "Create an API key for this onboarding. If generation fails, enter one manually below."}
          </Typography>
        </>
      )}

      {apiKeyError && (
        <TextField
          size="small"
          fullWidth
          label="Enter API key"
          type="password"
          autoComplete="off"
          value={manualApiKeyValue}
          onChange={(event) => handleManualApiKeyValueChange(event.target.value)}
          placeholder="Base64 API key"
        />
      )}

      {effectiveApiKey && (
        <>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              fullWidth
              label="Base64 API key"
              value={effectiveApiKey}
              type={showApiKey ? "text" : "password"}
              slotProps={{ input: { readOnly: true } }}
            />
            <Button size="small" variant="outlined" onClick={() => setShowApiKey((prev) => !prev)}>
              {showApiKey ? "Hide" : "Show"}
            </Button>
            <Button size="small" variant="outlined" onClick={() => void handleCopyApiKey()}>
              {copied ? "Copied" : "Copy"}
            </Button>
            {isManualEntry && (
              <Typography variant="caption" color="text.secondary">
                Manual
              </Typography>
            )}
          </Stack>
          <Button
            size="small"
            variant="text"
            onClick={handleCreateApiKey}
            disabled={creatingApiKey}
            sx={{ alignSelf: "flex-start" }}
          >
            Regenerate API key
          </Button>
        </>
      )}
    </Box>
  );
}
