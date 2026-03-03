import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";

import type { AddDataTechnologyCatalogEntry } from "../../services/addData/catalog";
import { COMPONENT_HEIGHTS } from "../../types/tokens";
import type { EndpointType, Platform } from "../../utils/addDataUtils";

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
  onBack,
  onContinue,
}: AddDataStepConfigureProps) {
  return (
    <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1.5 }}>
      <Typography variant="h6">Step 2: Select your environment</Typography>
      <Typography variant="body2" color="text.secondary">
        {selectedTechnology
          ? `${selectedTechnology.technology} can emit ${signalExpectation}.`
          : "Choose endpoint and platform options for your deployment."}
      </Typography>

      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Typography variant="body2">Endpoint type</Typography>
        <ToggleButtonGroup
          value={endpointType}
          exclusive
          size="small"
          onChange={(_, value: EndpointType | null) => {
            if (value) {
              onEndpointTypeManuallySet();
              onEndpointTypeChange(value);
            }
          }}
          aria-label="Endpoint type"
        >
          <ToggleButton value="elasticsearch">Elasticsearch</ToggleButton>
          <ToggleButton value="managed_otlp">Managed OTLP</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {endpointType === "managed_otlp" && (
        <Alert
          severity={
            !probeTargetOtlpUrl
              ? "warning"
              : ingestAvailable
                ? "success"
                : ingestAvailable === false
                  ? "warning"
                  : "info"
          }
        >
          {!probeTargetOtlpUrl
            ? "Could not derive an OTLP endpoint from the Elasticsearch URL. Enter an ingest URL in connection settings or use an Elastic Cloud deployment."
            : ingestAvailable === null
              ? `Checking OTLP endpoint availability at ${probeTargetOtlpUrl}…`
              : ingestAvailable
                ? `OTLP endpoint verified at ${probeTargetOtlpUrl}`
                : `Could not reach OTLP endpoint at ${probeTargetOtlpUrl} — verify the URL is correct`}
        </Alert>
      )}

      <Tabs
        value={platform}
        onChange={(_, value: Platform) => onPlatformChange(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: COMPONENT_HEIGHTS.tab,
          "& .MuiTab-root": { minHeight: COMPONENT_HEIGHTS.tab, py: 0.5 },
        }}
      >
        <Tab value="kubernetes" label="Kubernetes" />
        <Tab value="docker" label="Docker" />
        <Tab value="linux" label="Linux" />
        <Tab value="macos" label="macOS" />
        <Tab value="windows" label="Windows" />
      </Tabs>

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
