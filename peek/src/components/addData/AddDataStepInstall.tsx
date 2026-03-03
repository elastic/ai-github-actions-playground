import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useState } from "react";

import type { AddDataTechnologyCatalogEntry } from "../../services/addData/catalog";
import type { UserCapabilities } from "../../services/es";
import { copyToClipboard } from "../../utils/copyToClipboard";
import { useCopyFeedbackTimeout } from "../../hooks/useCopyFeedbackTimeout";
import type { EndpointType, Platform } from "../../utils/addDataUtils";
import type { OtelReceiverDefinition } from "../../services/addData/otelReceiverCatalog";

import { GUIDE_TYPE_DEFINITIONS } from "./guideRegistry";
import EdotCollectorInstall from "./guides/EdotCollectorInstall";
import OtelReceiverInstall from "./guides/OtelReceiverInstall";

interface AddDataStepInstallProps {
  selectedTechnology: AddDataTechnologyCatalogEntry | null;
  platform: Platform;
  esUrl: string;
  version: string;
  apiKey: string;
  endpointType: EndpointType;
  otlpUrl: string;
  apiKeyValue: string | null;
  apiKeyError: string | null;
  creatingApiKey: boolean;
  onCreateApiKey: () => void;
  capabilities: UserCapabilities | null;
  hasEndpoint: boolean;
  prefilledCount: number;
  derivedOtlpUrl: string | null;
  clusterVersion: string | null;
  connectionUrl: string | null;
  receiver: OtelReceiverDefinition | null;
  receiverFieldValues: Record<string, string>;
  onBack: () => void;
  onContinue: () => void;
}

export default function AddDataStepInstall({
  selectedTechnology,
  platform,
  esUrl,
  version,
  apiKey,
  endpointType,
  otlpUrl,
  apiKeyValue,
  apiKeyError,
  creatingApiKey,
  onCreateApiKey,
  capabilities,
  hasEndpoint,
  prefilledCount,
  derivedOtlpUrl,
  clusterVersion,
  connectionUrl,
  receiver,
  receiverFieldValues,
  onBack,
  onContinue,
}: AddDataStepInstallProps) {
  const guideType = selectedTechnology?.guideType ?? "edot_collector";
  const guideDef = GUIDE_TYPE_DEFINITIONS[guideType];

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
    <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1.5 }}>
      <Typography variant="h6">Step 3: {guideDef.step3Label}</Typography>

      {guideType === "edot_collector" && (
        <EdotCollectorInstall
          technologyLabel={selectedTechnology?.technology ?? "your source"}
          platform={platform}
          esUrl={esUrl}
          version={version}
          apiKey={apiKey}
          endpointType={endpointType}
          otlpUrl={otlpUrl}
          apiKeyValue={apiKeyValue}
          hasEndpoint={hasEndpoint}
          prefilledCount={prefilledCount}
          derivedOtlpUrl={derivedOtlpUrl}
          clusterVersion={clusterVersion}
          connectionUrl={connectionUrl}
        />
      )}

      {guideType === "otel_receiver" && receiver && (
        <OtelReceiverInstall
          receiver={receiver}
          fieldValues={receiverFieldValues}
          esUrl={esUrl}
          apiKey={apiKey}
        />
      )}

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

      <Stack direction="row" justifyContent="space-between">
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
        <Button variant="contained" onClick={onContinue}>
          Continue to step 4
        </Button>
      </Stack>
    </Paper>
  );
}
