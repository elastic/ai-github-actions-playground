import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useState } from "react";

import { useCopyFeedbackTimeout } from "../../hooks/useCopyFeedbackTimeout";
import type { UserCapabilities } from "../../services/es";
import { copyToClipboard } from "../../utils/copyToClipboard";

interface CollectorCredentialsProps {
  apiKeyValue: string | null;
  apiKeyError: string | null;
  capabilities: UserCapabilities | null;
  creatingApiKey: boolean;
  onCreateApiKey: () => void;
}

export default function CollectorCredentials({
  apiKeyValue,
  apiKeyError,
  capabilities,
  creatingApiKey,
  onCreateApiKey,
}: CollectorCredentialsProps) {
  const [copied, setCopied] = useState(false);
  const scheduleCopyFeedbackReset = useCopyFeedbackTimeout(() => setCopied(false));

  const handleCopyApiKey = useCallback(async () => {
    if (!apiKeyValue) return;
    const ok = await copyToClipboard(apiKeyValue);
    if (!ok) return;
    setCopied(true);
    scheduleCopyFeedbackReset();
  }, [apiKeyValue, scheduleCopyFeedbackReset]);

  return (
    <>
      <Typography variant="body2">Collector credentials</Typography>
      {apiKeyError && <Alert severity="error">{apiKeyError}</Alert>}
      {capabilities?.canCreateApiKeys ? (
        <>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant="contained"
              onClick={onCreateApiKey}
              disabled={creatingApiKey}
            >
              {creatingApiKey ? <CircularProgress size={16} /> : "Generate API key"}
            </Button>
            <Typography variant="body2" color="text.secondary">
              Generates an API key for collector setup.
            </Typography>
          </Stack>
          {apiKeyValue && (
            <>
              <Alert severity="warning">
                Copy this API key now. You will not be able to read it again after leaving this
                page.
              </Alert>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  fullWidth
                  label="Base64 API key"
                  value={apiKeyValue}
                  slotProps={{ input: { readOnly: true } }}
                />
                <Button size="small" variant="outlined" onClick={() => void handleCopyApiKey()}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              </Stack>
            </>
          )}
        </>
      ) : (
        <Alert severity="warning">
          Your credentials do not include API key creation privileges. Generate a key manually via{" "}
          <Link
            href="https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-create-api-key"
            target="_blank"
            rel="noopener noreferrer"
          >
            Create API key endpoint
          </Link>{" "}
          or ask an administrator to provision one for collector onboarding.
        </Alert>
      )}
    </>
  );
}
