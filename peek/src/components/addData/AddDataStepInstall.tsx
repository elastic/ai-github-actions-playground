import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { AddDataTechnologyCatalogEntry } from "../../services/addData/catalog";
import type { UserCapabilities } from "../../services/es";
import type { EndpointType, Platform } from "../../utils/addDataUtils";
import type { OtelReceiverDefinition } from "../../services/addData/otelReceiverCatalog";
import type { AwsDeployTarget } from "../../services/addData/awsDeployCatalog";
import type { ApmLanguageDefinition } from "../../services/addData/apmCatalog";
import type { FluentBitOutputMode } from "../../services/addData/fluentBitConfig";

import { GUIDE_TYPE_DEFINITIONS } from "./guideRegistry";
import EdotCollectorInstall from "./guides/EdotCollectorInstall";
import OtelReceiverInstall from "./guides/OtelReceiverInstall";
import AwsDeployInstall from "./guides/AwsDeployInstall";
import ApmInstall from "./guides/ApmInstall";
import FluentBitInstall from "./guides/FluentBitInstall";
import CollectorCredentials from "./CollectorCredentials";

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
  // OTel Receiver
  receiver: OtelReceiverDefinition | null;
  receiverFieldValues: Record<string, string>;
  // AWS Cloud Deploy
  selectedAwsTarget: AwsDeployTarget | null;
  // APM
  selectedApmLanguage: ApmLanguageDefinition | null;
  // Fluent Bit
  fluentBitOutputMode: FluentBitOutputMode;
  // Navigation
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
  selectedAwsTarget,
  selectedApmLanguage,
  fluentBitOutputMode,
  onBack,
  onContinue,
}: AddDataStepInstallProps) {
  const guideType = selectedTechnology?.guideType ?? "edot_collector";
  const guideDef = GUIDE_TYPE_DEFINITIONS[guideType];

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

      {guideType === "aws_cloud_deploy" && selectedAwsTarget && (
        <AwsDeployInstall target={selectedAwsTarget} esUrl={esUrl} apiKey={apiKey} />
      )}

      {guideType === "apm" && selectedApmLanguage && (
        <ApmInstall language={selectedApmLanguage} endpoint={esUrl} apiKey={apiKey} />
      )}

      {guideType === "fluent_bit" && (
        <FluentBitInstall outputMode={fluentBitOutputMode} esUrl={esUrl} apiKey={apiKey} />
      )}

      <CollectorCredentials
        apiKeyValue={apiKeyValue}
        apiKeyError={apiKeyError}
        capabilities={capabilities}
        creatingApiKey={creatingApiKey}
        onCreateApiKey={onCreateApiKey}
      />

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
