import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { AddDataTechnologyCatalogEntry } from "../../services/addData/catalog";
import type { EndpointType, Platform } from "../../utils/addDataUtils";
import type { OtelReceiverDefinition } from "../../services/addData/otelReceiverCatalog";

import { GUIDE_TYPE_DEFINITIONS } from "./guideRegistry";
import EdotCollectorConfigure from "./guides/EdotCollectorConfigure";
import OtelReceiverConfigure from "./guides/OtelReceiverConfigure";

interface AddDataStepConfigureProps {
  selectedTechnology: AddDataTechnologyCatalogEntry | null;
  signalExpectation: string;
  endpointType: EndpointType;
  onEndpointTypeChange: (type: EndpointType) => void;
  onEndpointTypeManuallySet: () => void;
  probeTargetOtlpUrl: string | null;
  ingestAvailable: boolean | null;
  platform: Platform;
  onPlatformChange: (platform: Platform) => void;
  receiver: OtelReceiverDefinition | null;
  receiverFieldValues: Record<string, string>;
  onReceiverFieldValuesChange: (values: Record<string, string>) => void;
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
  onBack,
  onContinue,
}: AddDataStepConfigureProps) {
  const guideType = selectedTechnology?.guideType ?? "edot_collector";
  const guideDef = GUIDE_TYPE_DEFINITIONS[guideType];

  return (
    <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1.5 }}>
      <Typography variant="h6">Step 2: {guideDef.step2Label}</Typography>
      <Typography variant="body2" color="text.secondary">
        {selectedTechnology
          ? `${selectedTechnology.technology} can emit ${signalExpectation}.`
          : "Choose endpoint and platform options for your deployment."}
      </Typography>

      {guideType === "edot_collector" && (
        <EdotCollectorConfigure
          endpointType={endpointType}
          onEndpointTypeChange={onEndpointTypeChange}
          onEndpointTypeManuallySet={onEndpointTypeManuallySet}
          probeTargetOtlpUrl={probeTargetOtlpUrl}
          ingestAvailable={ingestAvailable}
          platform={platform}
          onPlatformChange={onPlatformChange}
        />
      )}

      {guideType === "otel_receiver" && receiver && (
        <OtelReceiverConfigure
          receiver={receiver}
          fieldValues={receiverFieldValues}
          onFieldValuesChange={onReceiverFieldValuesChange}
        />
      )}

      <Stack direction="row" justifyContent="space-between">
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
        <Button variant="contained" onClick={onContinue}>
          Continue to step 3
        </Button>
      </Stack>
    </Paper>
  );
}
