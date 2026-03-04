import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { AddDataTechnologyCatalogEntry } from "../../services/addData/catalog";
import type { EndpointType, Platform, TelemetrySignal } from "../../utils/addDataUtils";
import { COMPONENT_HEIGHTS } from "../../types/tokens";
import type { OtelReceiverDefinition } from "../../services/addData/otelReceiverCatalog";
import type { AwsDeployTarget } from "../../services/addData/awsDeployCatalog";
import type { ApmLanguageDefinition } from "../../services/addData/apmCatalog";
import type { FluentBitOutputMode } from "../../services/addData/fluentBitConfig";
import type { UserCapabilities } from "../../services/es";
import type { IngestionVerificationState } from "../../hooks/useRichIngestionVerification";

import { TECHNOLOGY_ICONS } from "./addDataTechnologyConstants";
import { GUIDE_TYPE_DEFINITIONS } from "./guideRegistry";
import CollapsibleSection from "./CollapsibleSection";
import IngestionVerificationPanel from "./IngestionVerificationPanel";
import CollectorCredentials from "./CollectorCredentials";
import EdotCollectorConfigure from "./guides/EdotCollectorConfigure";
import OtelReceiverConfigure from "./guides/OtelReceiverConfigure";
import AwsDeployConfigure from "./guides/AwsDeployConfigure";
import ApmConfigure from "./guides/ApmConfigure";
import FluentBitConfigure from "./guides/FluentBitConfigure";
import EdotCollectorInstall from "./guides/EdotCollectorInstall";
import OtelReceiverInstall from "./guides/OtelReceiverInstall";
import AwsDeployInstall from "./guides/AwsDeployInstall";
import ApmInstall from "./guides/ApmInstall";
import FluentBitInstall from "./guides/FluentBitInstall";

interface ConfigureProps {
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
  selectedAwsTarget: AwsDeployTarget | null;
  onSelectAwsTarget: (target: AwsDeployTarget) => void;
  selectedApmLanguage: ApmLanguageDefinition | null;
  onSelectApmLanguage: (lang: ApmLanguageDefinition) => void;
  fluentBitOutputMode: FluentBitOutputMode;
  onFluentBitOutputModeChange: (mode: FluentBitOutputMode) => void;
}

interface InstallProps {
  esUrl: string;
  version: string;
  apiKey: string;
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
}

interface VerificationProps {
  connectionAvailable: boolean;
  verification: IngestionVerificationState;
}

interface NavigationProps {
  onBack: () => void;
  onContinue: () => void;
}

interface AddDataStepSetupProps
  extends ConfigureProps, InstallProps, VerificationProps, NavigationProps {
  selectedTechnology: AddDataTechnologyCatalogEntry | null;
  signalExpectation: string;
  selectedSignals: readonly TelemetrySignal[];
}

export default function AddDataStepSetup(p: AddDataStepSetupProps) {
  const [configureExpanded, setConfigureExpanded] = useState(true);
  const [credentialsExpanded, setCredentialsExpanded] = useState(true);
  const [installExpanded, setInstallExpanded] = useState(true);

  if (!p.selectedTechnology) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Typography variant="h6">Set up and verify</Typography>
        <Typography variant="body2" color="text.secondary">
          Select a technology before continuing.
        </Typography>
        <Stack direction="row" justifyContent="space-between">
          <Button variant="outlined" onClick={p.onBack}>
            Back
          </Button>
        </Stack>
      </Box>
    );
  }

  const guideType = p.selectedTechnology.guideType;
  const guideDef = GUIDE_TYPE_DEFINITIONS[guideType];
  const handleSelectApmLanguage = (lang: ApmLanguageDefinition) => {
    p.onSelectApmLanguage(lang);
    setConfigureExpanded(false);
    setInstallExpanded(true);
  };

  // ---------------------------------------------------------------------------
  // Configure section content (guide-specific)
  // ---------------------------------------------------------------------------
  let configureContent: ReactNode;
  switch (guideType) {
    case "edot_collector":
      configureContent = (
        <EdotCollectorConfigure
          endpointType={p.endpointType}
          onEndpointTypeChange={p.onEndpointTypeChange}
          onEndpointTypeManuallySet={p.onEndpointTypeManuallySet}
          probeTargetOtlpUrl={p.probeTargetOtlpUrl}
          ingestAvailable={p.ingestAvailable}
          platform={p.platform}
          onPlatformChange={p.onPlatformChange}
          supportedEnvironments={p.selectedTechnology!.supportedEnvironments}
        />
      );
      break;
    case "otel_receiver":
      configureContent = p.receiver ? (
        <OtelReceiverConfigure
          receiver={p.receiver}
          fieldValues={p.receiverFieldValues}
          onFieldValuesChange={p.onReceiverFieldValuesChange}
        />
      ) : (
        <Typography variant="body2" color="text.secondary">
          Receiver details are unavailable for this selection.
        </Typography>
      );
      break;
    case "aws_cloud_deploy":
      configureContent = (
        <AwsDeployConfigure
          selectedTarget={p.selectedAwsTarget}
          onSelectTarget={p.onSelectAwsTarget}
        />
      );
      break;
    case "apm":
      configureContent = (
        <ApmConfigure
          selectedLanguage={p.selectedApmLanguage}
          onSelectLanguage={handleSelectApmLanguage}
        />
      );
      break;
    case "fluent_bit":
      configureContent = (
        <FluentBitConfigure
          outputMode={p.fluentBitOutputMode}
          onOutputModeChange={p.onFluentBitOutputModeChange}
        />
      );
      break;
    default: {
      const _exhaustiveCheck: never = guideType;
      configureContent = _exhaustiveCheck;
    }
  }

  // ---------------------------------------------------------------------------
  // Install section content (guide-specific)
  // ---------------------------------------------------------------------------
  let installContent: ReactNode;
  switch (guideType) {
    case "edot_collector":
      installContent = (
        <EdotCollectorInstall
          technologyLabel={p.selectedTechnology.technology}
          platform={p.platform}
          esUrl={p.esUrl}
          version={p.version}
          apiKey={p.apiKey}
          endpointType={p.endpointType}
          otlpUrl={p.otlpUrl}
          apiKeyValue={p.apiKeyValue}
          hasEndpoint={p.hasEndpoint}
          prefilledCount={p.prefilledCount}
          derivedOtlpUrl={p.derivedOtlpUrl}
          clusterVersion={p.clusterVersion}
          connectionUrl={p.connectionUrl}
        />
      );
      break;
    case "otel_receiver":
      installContent = p.receiver ? (
        <OtelReceiverInstall
          receiver={p.receiver}
          fieldValues={p.receiverFieldValues}
          esUrl={p.esUrl}
          apiKey={p.apiKey}
        />
      ) : (
        <Typography variant="body2" color="text.secondary">
          Receiver details are unavailable for this selection.
        </Typography>
      );
      break;
    case "aws_cloud_deploy":
      installContent = p.selectedAwsTarget ? (
        <AwsDeployInstall target={p.selectedAwsTarget} esUrl={p.esUrl} apiKey={p.apiKey} />
      ) : (
        <Typography variant="body2" color="text.secondary">
          Select a deployment target to show install steps.
        </Typography>
      );
      break;
    case "apm":
      installContent = p.selectedApmLanguage ? (
        <ApmInstall language={p.selectedApmLanguage} endpoint={p.esUrl} apiKey={p.apiKey} />
      ) : (
        <Typography variant="body2" color="text.secondary">
          Select a language to show install steps.
        </Typography>
      );
      break;
    case "fluent_bit":
      installContent = (
        <FluentBitInstall outputMode={p.fluentBitOutputMode} esUrl={p.esUrl} apiKey={p.apiKey} />
      );
      break;
    default: {
      const _exhaustiveCheck: never = guideType;
      installContent = _exhaustiveCheck;
    }
  }
  const sectionSubtitle =
    guideType === "aws_cloud_deploy" || guideType === "apm"
      ? undefined
      : p.selectedTechnology.technology;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        {TECHNOLOGY_ICONS[p.selectedTechnology.id] && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: COMPONENT_HEIGHTS.sidebarNavItem,
              height: COMPONENT_HEIGHTS.sidebarNavItem,
              borderRadius: 1,
              bgcolor: "action.selected",
              color: "text.secondary",
            }}
          >
            {TECHNOLOGY_ICONS[p.selectedTechnology.id]}
          </Box>
        )}
        <Typography variant="h6">Set up {p.selectedTechnology.technology}</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {`${p.selectedTechnology.technology} can emit ${p.signalExpectation}.`}
      </Typography>

      {/* Section 1: Configure */}
      <CollapsibleSection
        title={guideDef.configureLabel}
        subtitle={sectionSubtitle}
        expanded={configureExpanded}
        onToggle={() => setConfigureExpanded((prev) => !prev)}
      >
        {configureContent}
      </CollapsibleSection>

      {/* Section 2: Credentials */}
      <CollapsibleSection
        title="Collector credentials"
        expanded={credentialsExpanded}
        onToggle={() => setCredentialsExpanded((prev) => !prev)}
        completed={Boolean(p.apiKeyValue)}
      >
        <CollectorCredentials
          apiKeyValue={p.apiKeyValue}
          apiKeyError={p.apiKeyError}
          capabilities={p.capabilities}
          creatingApiKey={p.creatingApiKey}
          onCreateApiKey={p.onCreateApiKey}
        />
      </CollapsibleSection>

      {/* Section 3: Install */}
      <CollapsibleSection
        title={guideDef.installLabel}
        subtitle={sectionSubtitle}
        expanded={installExpanded}
        onToggle={() => setInstallExpanded((prev) => !prev)}
      >
        {installContent}
      </CollapsibleSection>

      {/* Section 3: Verify (always visible, not collapsible) */}
      <IngestionVerificationPanel
        technologyName={p.selectedTechnology.technology}
        signalExpectation={p.signalExpectation}
        expectedSignals={p.selectedSignals}
        verification={p.verification}
        connectionAvailable={p.connectionAvailable}
      />

      {/* Navigation */}
      <Stack direction="row" justifyContent="space-between">
        <Button variant="outlined" onClick={p.onBack}>
          Back
        </Button>
        <Button variant="contained" onClick={p.onContinue}>
          Continue
        </Button>
      </Stack>
    </Box>
  );
}
