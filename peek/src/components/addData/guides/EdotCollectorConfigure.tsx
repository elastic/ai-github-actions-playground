import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { COMPONENT_HEIGHTS } from "../../../types/tokens";
import type { EndpointType, Platform } from "../../../utils/addDataUtils";
import type { AddDataEnvironment } from "../../../services/addData/catalog";

const ALL_PLATFORM_TABS: { value: Platform; label: string }[] = [
  { value: "kubernetes", label: "Kubernetes" },
  { value: "docker", label: "Docker" },
  { value: "linux", label: "Linux" },
  { value: "macos", label: "macOS" },
  { value: "windows", label: "Windows" },
];

export interface EdotCollectorConfigureProps {
  endpointType: EndpointType;
  onEndpointTypeChange: (type: EndpointType) => void;
  onEndpointTypeManuallySet: () => void;
  probeTargetOtlpUrl: string | null;
  ingestAvailable: boolean | null;
  platform: Platform;
  onPlatformChange: (platform: Platform) => void;
  supportedEnvironments?: readonly AddDataEnvironment[];
}

export default function EdotCollectorConfigure({
  endpointType,
  onEndpointTypeChange,
  onEndpointTypeManuallySet,
  probeTargetOtlpUrl,
  ingestAvailable,
  platform,
  onPlatformChange,
  supportedEnvironments,
}: EdotCollectorConfigureProps) {
  const filteredTabs = supportedEnvironments
    ? ALL_PLATFORM_TABS.filter((tab) =>
        supportedEnvironments.includes(tab.value as AddDataEnvironment),
      )
    : ALL_PLATFORM_TABS;
  const displayTabs = filteredTabs.length > 0 ? filteredTabs : ALL_PLATFORM_TABS;

  return (
    <>
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
          <ToggleButton value="managed_otlp">
            <Tooltip title="Send telemetry via OpenTelemetry Protocol to an Elastic-managed ingest endpoint.">
              <span>Managed OTLP</span>
            </Tooltip>
          </ToggleButton>
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
        {displayTabs.map((tab) => (
          <Tab key={tab.value} value={tab.value} label={tab.label} />
        ))}
      </Tabs>
    </>
  );
}
