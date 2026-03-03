import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

import type { AddDataTechnologyCatalogEntry } from "../../services/addData/catalog";
import type { EndpointType, Platform } from "../../utils/addDataUtils";
import type { OtelReceiverDefinition } from "../../services/addData/otelReceiverCatalog";
import type { AwsDeployTarget } from "../../services/addData/awsDeployCatalog";
import type { ApmLanguageDefinition } from "../../services/addData/apmCatalog";
import type { FluentBitOutputMode } from "../../services/addData/fluentBitConfig";

import { GUIDE_TYPE_DEFINITIONS } from "./guideRegistry";
import EdotCollectorConfigure from "./guides/EdotCollectorConfigure";
import OtelReceiverConfigure from "./guides/OtelReceiverConfigure";
import AwsDeployConfigure from "./guides/AwsDeployConfigure";
import ApmConfigure from "./guides/ApmConfigure";
import FluentBitConfigure from "./guides/FluentBitConfigure";

interface AddDataStepConfigureProps {
  selectedTechnology: AddDataTechnologyCatalogEntry | null;
  signalExpectation: string;
  // EDOT Collector
  endpointType: EndpointType;
  onEndpointTypeChange: (type: EndpointType) => void;
  onEndpointTypeManuallySet: () => void;
  probeTargetOtlpUrl: string | null;
  ingestAvailable: boolean | null;
  platform: Platform;
  onPlatformChange: (platform: Platform) => void;
  // OTel Receiver
  receiver: OtelReceiverDefinition | null;
  receiverFieldValues: Record<string, string>;
  onReceiverFieldValuesChange: (values: Record<string, string>) => void;
  // AWS Cloud Deploy
  selectedAwsTarget: AwsDeployTarget | null;
  onSelectAwsTarget: (target: AwsDeployTarget) => void;
  // APM
  selectedApmLanguage: ApmLanguageDefinition | null;
  onSelectApmLanguage: (lang: ApmLanguageDefinition) => void;
  // Fluent Bit
  fluentBitOutputMode: FluentBitOutputMode;
  onFluentBitOutputModeChange: (mode: FluentBitOutputMode) => void;
  // Navigation
  onBack: () => void;
  onContinue: () => void;
}

export default function AddDataStepConfigure({
  selectedTechnology,
  signalExpectation,
  endpointType,
  onEndpointTypeChange,
  onEndpointTypeManuallySet,
  probeTargetOtlpUrl,
  ingestAvailable,
  platform,
  onPlatformChange,
  receiver,
  receiverFieldValues,
  onReceiverFieldValuesChange,
  selectedAwsTarget,
  onSelectAwsTarget,
  selectedApmLanguage,
  onSelectApmLanguage,
  fluentBitOutputMode,
  onFluentBitOutputModeChange,
  onBack,
  onContinue,
}: AddDataStepConfigureProps) {
  const guideType = selectedTechnology?.guideType ?? "edot_collector";
  const guideDef = GUIDE_TYPE_DEFINITIONS[guideType];

  const canContinue =
    guideType === "edot_collector" ||
    guideType === "fluent_bit" ||
    (guideType === "otel_receiver" && Boolean(receiver)) ||
    (guideType === "aws_cloud_deploy" && Boolean(selectedAwsTarget)) ||
    (guideType === "apm" && Boolean(selectedApmLanguage));

  let configureContent: ReactNode;
  switch (guideType) {
    case "edot_collector":
      configureContent = (
        <EdotCollectorConfigure
          endpointType={endpointType}
          onEndpointTypeChange={onEndpointTypeChange}
          onEndpointTypeManuallySet={onEndpointTypeManuallySet}
          probeTargetOtlpUrl={probeTargetOtlpUrl}
          ingestAvailable={ingestAvailable}
          platform={platform}
          onPlatformChange={onPlatformChange}
        />
      );
      break;
    case "otel_receiver":
      configureContent = receiver ? (
        <OtelReceiverConfigure
          receiver={receiver}
          fieldValues={receiverFieldValues}
          onFieldValuesChange={onReceiverFieldValuesChange}
        />
      ) : null;
      break;
    case "aws_cloud_deploy":
      configureContent = (
        <AwsDeployConfigure selectedTarget={selectedAwsTarget} onSelectTarget={onSelectAwsTarget} />
      );
      break;
    case "apm":
      configureContent = (
        <ApmConfigure
          selectedLanguage={selectedApmLanguage}
          onSelectLanguage={onSelectApmLanguage}
        />
      );
      break;
    case "fluent_bit":
      configureContent = (
        <FluentBitConfigure
          outputMode={fluentBitOutputMode}
          onOutputModeChange={onFluentBitOutputModeChange}
        />
      );
      break;
    default: {
      const _exhaustiveCheck: never = guideType;
      configureContent = _exhaustiveCheck;
    }
  }

  return (
    <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1.5 }}>
      <Typography variant="h6">Step 2: {guideDef.step2Label}</Typography>
      <Typography variant="body2" color="text.secondary">
        {selectedTechnology
          ? `${selectedTechnology.technology} can emit ${signalExpectation}.`
          : "Choose endpoint and platform options for your deployment."}
      </Typography>

      {configureContent}

      <Stack direction="row" justifyContent="space-between">
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
        <Button variant="contained" onClick={onContinue} disabled={!canContinue}>
          Continue to step 3
        </Button>
      </Stack>
    </Paper>
  );
}
