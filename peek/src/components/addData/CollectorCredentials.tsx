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

/** Map raw Elasticsearch API key errors to user-friendly messages. */
function formatApiKeyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    (lower.includes("api_key") || lower.includes("api key")) &&
    (lower.includes("unauthorized") ||
      lower.includes("forbidden") ||
      lower.includes("access denied"))
  ) {
    return "";
  }
  if (lower.includes("authentication") || lower.includes("401")) {
    return "Authentication failed. Check your Elasticsearch connection credentials.";
  }
  return raw;
}

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
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const scheduleCopyFeedbackReset = useCopyFeedbackTimeout(() => setCopiedApiKeyValue(null));
  const effectiveApiKey = apiKeyValue ?? manualApiKeyValue.trim();
  const copied = effectiveApiKey.length > 0 && copiedApiKeyValue === effectiveApiKey;
  const showApiKey = revealedKey !== null && revealedKey === effectiveApiKey;
  const handleCreateApiKey = useCallback(() => {
    setRevealedKey(null);
    onCreateApiKey();
  }, [onCreateApiKey]);
  const handleManualApiKeyValueChange = useCallback(
    (value: string) => {
      setRevealedKey(null);
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
  const friendlyError = apiKeyError ? formatApiKeyError(apiKeyError) : null;

  const hasProbeTarget = Boolean(probeTargetOtlpUrl);
  const outputMode =
    ingestAvailable === false || !hasProbeTarget ? "elasticsearch" : "managed_otlp";
  const otlpUndetectable = !probeTargetOtlpUrl;
  const otlpUnavailable = otlpUndetectable || ingestAvailable === false;
  const destinationUrl = outputMode === "managed_otlp" ? (probeTargetOtlpUrl ?? esUrl) : esUrl;
  const showTransportSection = typeof ingestAvailable !== "undefined";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Transport & destination */}
      {showTransportSection && (
        <Box
          component="fieldset"
          sx={{
            minWidth: 0,
            m: 0,
            py: 1,
            px: 1.5,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <Typography component="legend" variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
            Collector output
          </Typography>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80 }}>
                Transport
              </Typography>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <ToggleButtonGroup
                  value={outputMode}
                  exclusive
                  disabled
                  size="small"
                  aria-label="Detected transport (read only)"
                  sx={{
                    "& .MuiToggleButton-root": {
                      minHeight: 0,
                      py: 0.5,
                      px: 1,
                      borderColor: "divider",
                      textTransform: "none",
                      fontSize: "0.75rem",
                    },
                    "& .MuiToggleButton-root.Mui-selected": {
                      bgcolor: "action.selected",
                    },
                    "& .MuiToggleButton-root:first-of-type": {
                      borderTopLeftRadius: 4,
                      borderBottomLeftRadius: 4,
                    },
                    "& .MuiToggleButton-root:last-of-type": {
                      borderTopRightRadius: 4,
                      borderBottomRightRadius: 4,
                    },
                  }}
                >
                  <ToggleButton value="elasticsearch">Bulk</ToggleButton>
                  <ToggleButton value="managed_otlp">
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <span>OTLP</span>
                      {otlpUnavailable && (
                        <Tooltip title="Managed OTLP was not auto-detected. Using Elasticsearch output.">
                          <WarningAmberIcon color="warning" sx={{ fontSize: 12 }} />
                        </Tooltip>
                      )}
                    </Stack>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Stack>
            {!apiKeyError && (
              <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap">
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80, pt: 1 }}>
                  Destination
                </Typography>
                <TextField
                  size="small"
                  fullWidth
                  label="Destination URL"
                  value={destinationUrl}
                  slotProps={{ input: { readOnly: true } }}
                  sx={{
                    flex: 1,
                    minWidth: 200,
                    "& .MuiInputBase-input": {
                      fontSize: "0.8rem",
                      fontFamily: "monospace",
                    },
                  }}
                />
              </Stack>
            )}
            {(otlpUnavailable || ingestAvailable === null) && !apiKeyError && (
              <Typography variant="caption" color="text.secondary" style={{ paddingLeft: "88px" }}>
                {otlpUnavailable
                  ? "Sending data via Elasticsearch _bulk transport."
                  : "Checking managed OTLP endpoint availability..."}
              </Typography>
            )}
          </Stack>
        </Box>
      )}

      {/* API key */}
      <Box
        component="fieldset"
        sx={{
          minWidth: 0,
          m: 0,
          py: 1,
          px: 1.5,
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        <Typography
          component="legend"
          variant="caption"
          color="text.secondary"
          sx={{ px: 0.5, fontWeight: 600 }}
        >
          API key
        </Typography>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          {!effectiveApiKey && (
            <>
              {creatingApiKey && !apiKeyError && (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CircularProgress size={16} aria-hidden="true" />
                  <Typography variant="body2" color="text.secondary">
                    Creating API key...
                  </Typography>
                </Stack>
              )}
              {apiKeyError && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    Unable to automatically create an API key. Provide an API key to proceed.
                  </Typography>
                  {friendlyError && (
                    <Typography variant="caption" color="text.secondary">
                      {friendlyError}
                    </Typography>
                  )}
                  <TextField
                    size="small"
                    fullWidth
                    label="API key"
                    type="password"
                    autoComplete="off"
                    value={manualApiKeyValue}
                    onChange={(event) => handleManualApiKeyValueChange(event.target.value)}
                    placeholder="Base64 API key"
                  />
                </>
              )}
            </>
          )}

          {effectiveApiKey && (
            <>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <TextField
                  size="small"
                  fullWidth
                  label="API key"
                  value={effectiveApiKey}
                  type={showApiKey ? "text" : "password"}
                  slotProps={{ input: { readOnly: true } }}
                  sx={{ flex: 1, minWidth: 200 }}
                />
                <Stack direction="row" spacing={0.5} flexShrink={0}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setRevealedKey(showApiKey ? null : effectiveApiKey)}
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => void handleCopyApiKey()}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </Stack>
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
        </Stack>
      </Box>
    </Box>
  );
}
