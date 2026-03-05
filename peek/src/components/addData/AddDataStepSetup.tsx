import { useEffect, useRef, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

import type { AddDataTechnologyCatalogEntry } from "../../services/addData/catalog";
import type { EndpointType, Platform, TelemetrySignal } from "../../utils/addDataUtils";
import { COMPONENT_HEIGHTS } from "../../types/tokens";
import type { OtelReceiverDefinition } from "../../services/addData/otelReceiverCatalog";
import type { AwsDeployTarget } from "../../services/addData/awsDeployCatalog";
import type { ApmLanguageDefinition } from "../../services/addData/apmCatalog";
import type { FluentBitOutputMode } from "../../services/addData/fluentBitConfig";
import {
  getCollectorOutputConfigs,
  isThirdPartyCollectorId,
} from "../../services/addData/fluentBitConfig";
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
  onSwitchToTechnology: (technologyId: "fluent-bit" | "vector") => void;
  edotRecommendedSelected: boolean;
  onSelectEdotRecommended: () => void;
  endpointType: EndpointType;
  probeTargetOtlpUrl: string | null;
  ingestAvailable: boolean | null;
  platform: Platform;
  onPlatformChange: (platform: Platform) => void;
  receiver: OtelReceiverDefinition | null;
  receiverFieldValues: Record<string, string>;
  onReceiverFieldValuesChange: (values: Record<string, string>) => void;
  existingCollectorConfig: string;
  onExistingCollectorConfigChange: (config: string) => void;
  useExistingConfig: boolean;
  onUseExistingConfigChange: (use: boolean) => void;
  selectedAwsTarget: AwsDeployTarget | null;
  onSelectAwsTarget: (target: AwsDeployTarget) => void;
  awsDeployStarted: boolean;
  onAwsLaunchStack: () => void;
  selectedApmLanguage: ApmLanguageDefinition | null;
  onSelectApmLanguage: (lang: ApmLanguageDefinition) => void;
  fluentBitOutputMode: FluentBitOutputMode;
  onFluentBitOutputModeChange: (mode: FluentBitOutputMode) => void;
}

interface InstallProps {
  esUrl: string;
  version: string;
  apiKey: string;
  hasApiKey: boolean;
  manualApiKeyValue: string;
  onManualApiKeyValueChange: (value: string) => void;
  otlpUrl: string;
  apiKeyValue: string | null;
  apiKeyError: string | null;
  creatingApiKey: boolean;
  onCreateApiKey: () => void;
  prefilledCount: number;
}

interface VerificationProps {
  connectionAvailable: boolean;
  verification: IngestionVerificationState;
}

interface NavigationProps {
  onBack: () => void;
  onReset: () => void;
  onContinue: () => void;
  canContinue: boolean;
}

interface AddDataStepSetupProps
  extends ConfigureProps, InstallProps, VerificationProps, NavigationProps {
  selectedTechnology: AddDataTechnologyCatalogEntry | null;
  signalExpectation: string;
  selectedSignals: readonly TelemetrySignal[];
}

function hasReceiverValuesReady(
  receiver: OtelReceiverDefinition | null,
  fieldValues: Record<string, string>,
): boolean {
  if (!receiver) return false;
  return receiver.fields.every((field) => {
    const value = fieldValues[field.key];
    if (typeof value === "string") return value.trim().length > 0;
    return field.defaultValue.trim().length > 0;
  });
}

function formatSignalExpectation(signals: readonly TelemetrySignal[]): string {
  if (signals.length === 0) return "telemetry";
  if (signals.length === 1) return signals[0]!;
  if (signals.length === 2) return `${signals[0]!} and ${signals[1]!}`;
  const lead = signals.slice(0, -1).join(", ");
  const tail = signals[signals.length - 1]!;
  return `${lead}, and ${tail}`;
}

export default function AddDataStepSetup(p: AddDataStepSetupProps) {
  const [configureExpanded, setConfigureExpanded] = useState(true);
  const [credentialsExpanded, setCredentialsExpanded] = useState(true);
  const [installExpanded, setInstallExpanded] = useState(true);
  const installAutoCollapseTimeoutRef = useRef<number | null>(null);
  const installVisibleSinceRef = useRef<number | null>(null);
  const autoGenerateRequestedRef = useRef(false);
  const MIN_INSTALL_VISIBLE_MS = 3000;

  const guideType = p.selectedTechnology?.guideType;
  const collectorId =
    guideType === "fluent_bit" && isThirdPartyCollectorId(p.selectedTechnology?.id)
      ? p.selectedTechnology.id
      : undefined;
  const collectorOutputModes =
    guideType === "fluent_bit" && collectorId ? getCollectorOutputConfigs(collectorId) : [];
  const showConfigureSection =
    guideType !== "apm" && !(guideType === "fluent_bit" && collectorOutputModes.length <= 1);
  const awsFlowEnabled = guideType === "aws_cloud_deploy";
  const awsConfigureComplete = awsFlowEnabled && Boolean(p.selectedAwsTarget);
  const configureComplete = (() => {
    switch (guideType) {
      case "aws_cloud_deploy":
        return awsConfigureComplete;
      case "apm":
        return Boolean(p.selectedApmLanguage);
      case "otel_receiver":
        return hasReceiverValuesReady(p.receiver, p.receiverFieldValues);
      case "edot_collector":
        return p.edotRecommendedSelected;
      case "fluent_bit":
        return true;
      default:
        return false;
    }
  })();
  const hasAnyApiKey = p.hasApiKey;
  const { creatingApiKey, apiKeyError, onCreateApiKey } = p;
  const awsListeningForData =
    awsFlowEnabled &&
    p.awsDeployStarted &&
    (p.verification.status === "capturing_baseline" || p.verification.status === "polling");
  const showCredentialsSection = !showConfigureSection || configureComplete;
  const showInstallSection = showCredentialsSection && hasAnyApiKey;
  const showVerifySection = awsFlowEnabled ? p.awsDeployStarted : hasAnyApiKey;
  const awsCredentialsSource = p.selectedAwsTarget?.label ?? "AWS source";
  const hostOnboardingFlow =
    guideType === "edot_collector" &&
    new Set(["linux-host", "windows-host", "macos-host"]).has(p.selectedTechnology?.id ?? "");
  const edotSupportsPlatformTabs =
    guideType === "edot_collector" &&
    new Set(["kubernetes", "docker", "linux-host", "windows-host", "macos-host"]).has(
      p.selectedTechnology?.id ?? "",
    );
  const credentialsSectionTitle = awsFlowEnabled
    ? `${awsCredentialsSource} -> Elastic Credentials`
    : guideType === "apm"
      ? "SDK Configuration"
      : "Collector configuration";
  const stepLaneSx = {
    border: 1,
    borderColor: "divider",
    borderRadius: 1,
    px: 1,
    py: 1,
    bgcolor: "background.paper",
  } as const;

  useEffect(() => {
    const apply = () => {
      if (showConfigureSection && !configureComplete) {
        setConfigureExpanded(true);
        setCredentialsExpanded(false);
        setInstallExpanded(false);
        return;
      }
      if (!hasAnyApiKey) {
        setConfigureExpanded(false);
        setCredentialsExpanded(true);
        setInstallExpanded(false);
        return;
      }
      setConfigureExpanded(false);
      setCredentialsExpanded(false);
      setInstallExpanded(awsFlowEnabled ? !p.awsDeployStarted : true);
    };
    queueMicrotask(apply);
  }, [showConfigureSection, configureComplete, hasAnyApiKey, awsFlowEnabled, p.awsDeployStarted]);

  useEffect(() => {
    if (!showInstallSection) {
      installVisibleSinceRef.current = null;
      if (installAutoCollapseTimeoutRef.current != null) {
        window.clearTimeout(installAutoCollapseTimeoutRef.current);
        installAutoCollapseTimeoutRef.current = null;
      }
      return;
    }
    if (installVisibleSinceRef.current == null) {
      installVisibleSinceRef.current = Date.now();
    }
  }, [showInstallSection]);

  useEffect(() => {
    if (!hostOnboardingFlow || !showInstallSection || !p.verification.overallDetected) return;
    const shownAt = installVisibleSinceRef.current ?? Date.now();
    const elapsed = Date.now() - shownAt;
    const waitRemaining = Math.max(0, MIN_INSTALL_VISIBLE_MS - elapsed);
    if (waitRemaining === 0) {
      queueMicrotask(() => setInstallExpanded(false));
      return;
    }
    if (installAutoCollapseTimeoutRef.current != null) {
      window.clearTimeout(installAutoCollapseTimeoutRef.current);
    }
    installAutoCollapseTimeoutRef.current = window.setTimeout(() => {
      setInstallExpanded(false);
      installAutoCollapseTimeoutRef.current = null;
    }, waitRemaining);
    return () => {
      if (installAutoCollapseTimeoutRef.current != null) {
        window.clearTimeout(installAutoCollapseTimeoutRef.current);
        installAutoCollapseTimeoutRef.current = null;
      }
    };
  }, [hostOnboardingFlow, showInstallSection, p.verification.overallDetected]);

  useEffect(() => {
    if (!showCredentialsSection) {
      autoGenerateRequestedRef.current = false;
      return;
    }
    if (hasAnyApiKey) return;
    if (creatingApiKey) return;
    if (apiKeyError) return;
    if (autoGenerateRequestedRef.current) return;
    autoGenerateRequestedRef.current = true;
    onCreateApiKey();
  }, [showCredentialsSection, hasAnyApiKey, creatingApiKey, apiKeyError, onCreateApiKey]);

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

  // ---------------------------------------------------------------------------
  // Configure section content (guide-specific)
  // ---------------------------------------------------------------------------
  const tech = p.selectedTechnology;
  const gt = tech.guideType;
  const gd = GUIDE_TYPE_DEFINITIONS[gt];
  const cid = isThirdPartyCollectorId(tech.id) ? tech.id : undefined;
  const configureSectionTitleResolved =
    awsFlowEnabled && p.selectedAwsTarget
      ? p.selectedAwsTarget.targetId === "firehose"
        ? "Connecting using AWS Firehose"
        : "Connecting using AWS Cloud Forwarder"
      : gd.configureLabel;
  let configureContent: ReactNode;
  switch (gt) {
    case "edot_collector":
      configureContent = (
        <EdotCollectorConfigure
          onSwitchToTechnology={p.onSwitchToTechnology}
          recommendedSelected={p.edotRecommendedSelected}
          onSelectRecommended={p.onSelectEdotRecommended}
          platform={p.platform}
          onPlatformChange={p.onPlatformChange}
          supportedEnvironments={edotSupportsPlatformTabs ? tech.supportedEnvironments : undefined}
        />
      );
      break;
    case "otel_receiver":
      configureContent = p.receiver ? (
        <OtelReceiverConfigure
          receiver={p.receiver}
          fieldValues={p.receiverFieldValues}
          onFieldValuesChange={p.onReceiverFieldValuesChange}
          existingCollectorConfig={p.existingCollectorConfig}
          onExistingCollectorConfigChange={p.onExistingCollectorConfigChange}
          useExistingConfig={p.useExistingConfig}
          onUseExistingConfigChange={p.onUseExistingConfigChange}
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
          onSelectLanguage={p.onSelectApmLanguage}
        />
      );
      break;
    case "fluent_bit":
      if (cid) {
        configureContent = (
          <FluentBitConfigure
            collectorId={cid}
            technologyLabel={tech.technology}
            outputMode={p.fluentBitOutputMode}
            onOutputModeChange={p.onFluentBitOutputModeChange}
          />
        );
      }
      break;
    default: {
      const _exhaustiveCheck: never = gt;
      configureContent = _exhaustiveCheck;
    }
  }

  // ---------------------------------------------------------------------------
  // Install section content (guide-specific)
  // ---------------------------------------------------------------------------
  let installContent: ReactNode;
  switch (gt) {
    case "edot_collector":
      installContent = (
        <EdotCollectorInstall
          technologyLabel={tech.technology}
          platform={p.platform}
          esUrl={p.esUrl}
          version={p.version}
          apiKey={p.apiKey}
          endpointType={p.endpointType}
          otlpUrl={p.otlpUrl}
          apiKeyValue={p.apiKeyValue}
          prefilledCount={p.prefilledCount}
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
          existingCollectorConfig={p.existingCollectorConfig}
          useExistingConfig={p.useExistingConfig}
        />
      ) : (
        <Typography variant="body2" color="text.secondary">
          Receiver details are unavailable for this selection.
        </Typography>
      );
      break;
    case "aws_cloud_deploy":
      installContent = p.selectedAwsTarget ? (
        <AwsDeployInstall
          target={p.selectedAwsTarget}
          esUrl={p.esUrl}
          apiKey={p.apiKey}
          onLaunchStack={p.onAwsLaunchStack}
        />
      ) : (
        <Typography variant="body2" color="text.secondary">
          Select a deployment target to show install steps.
        </Typography>
      );
      break;
    case "apm":
      installContent = p.selectedApmLanguage ? (
        <ApmInstall language={p.selectedApmLanguage} endpoint={p.otlpUrl} apiKey={p.apiKey} />
      ) : (
        <Typography variant="body2" color="text.secondary">
          SDK language details are unavailable for this selection.
        </Typography>
      );
      break;
    case "fluent_bit":
      if (cid) {
        installContent = (
          <FluentBitInstall
            collectorId={cid}
            technologyLabel={tech.technology}
            outputMode={p.fluentBitOutputMode}
            esUrl={p.esUrl}
            apiKey={p.apiKey}
          />
        );
      } else {
        installContent = (
          <Typography variant="body2" color="text.secondary">
            Collector details are unavailable for this selection.
          </Typography>
        );
      }
      break;
    default: {
      const _exhaustiveCheck: never = gt;
      installContent = _exhaustiveCheck;
    }
  }
  const sectionSubtitle =
    gt === "aws_cloud_deploy" || gt === "apm" || gt === "edot_collector"
      ? undefined
      : tech.technology;
  const displayTechnologyName = tech.id === "aws" ? "Amazon Web Services" : tech.technology;
  const formattedSignalExpectation = formatSignalExpectation(p.selectedSignals);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Button size="small" startIcon={<ArrowBackIcon fontSize="small" />} onClick={p.onBack}>
          Back
        </Button>
        <Button size="small" variant="text" onClick={p.onReset}>
          Start over
        </Button>
        <Stack direction="row" spacing={1} alignItems="center">
          {TECHNOLOGY_ICONS[tech.id] && (
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
              {TECHNOLOGY_ICONS[tech.id]}
            </Box>
          )}
          <Typography variant="h6">Set up {displayTechnologyName}</Typography>
        </Stack>
      </Stack>
      {gt !== "aws_cloud_deploy" && (
        <Typography variant="body2" color="text.secondary">
          {`${displayTechnologyName} sends ${formattedSignalExpectation}.`}
        </Typography>
      )}

      {/* Section 1: Configure */}
      {showConfigureSection && (
        <Box sx={stepLaneSx}>
          <CollapsibleSection
            title={configureSectionTitleResolved}
            subtitle={sectionSubtitle}
            expanded={configureExpanded}
            onToggle={() => setConfigureExpanded((prev) => !prev)}
            completed={configureComplete}
          >
            {configureContent}
          </CollapsibleSection>
        </Box>
      )}

      {/* Section 2: Credentials */}
      {showCredentialsSection && (
        <Box sx={stepLaneSx}>
          <CollapsibleSection
            title={credentialsSectionTitle}
            expanded={credentialsExpanded}
            onToggle={() => setCredentialsExpanded((prev) => !prev)}
            completed={hasAnyApiKey}
          >
            <CollectorCredentials
              apiKeyValue={p.apiKeyValue}
              manualApiKeyValue={p.manualApiKeyValue}
              onManualApiKeyValueChange={p.onManualApiKeyValueChange}
              apiKeyError={p.apiKeyError}
              creatingApiKey={p.creatingApiKey}
              onCreateApiKey={p.onCreateApiKey}
              esUrl={p.esUrl}
              probeTargetOtlpUrl={gt === "edot_collector" ? p.probeTargetOtlpUrl : undefined}
              ingestAvailable={gt === "edot_collector" ? p.ingestAvailable : undefined}
            />
          </CollapsibleSection>
        </Box>
      )}

      {/* Section 3: Install */}
      {showInstallSection && (
        <Box sx={stepLaneSx}>
          <CollapsibleSection
            title={gd.installLabel}
            subtitle={sectionSubtitle}
            expanded={installExpanded}
            onToggle={() => setInstallExpanded((prev) => !prev)}
            leading={
              awsListeningForData ||
              (hostOnboardingFlow &&
                showVerifySection &&
                (p.verification.status === "idle" ||
                  p.verification.status === "capturing_baseline" ||
                  p.verification.status === "polling") &&
                !p.verification.overallDetected) ? (
                <AccessTimeIcon fontSize="small" color="warning" />
              ) : undefined
            }
          >
            {installContent}
          </CollapsibleSection>
        </Box>
      )}

      {/* Section 4: Verify */}
      {showVerifySection && (
        <Box sx={stepLaneSx}>
          <IngestionVerificationPanel
            technologyName={displayTechnologyName}
            isAwsDeploymentVerification={awsFlowEnabled}
            signalExpectation={formattedSignalExpectation}
            expectedSignals={p.selectedSignals}
            verification={p.verification}
            connectionAvailable={p.connectionAvailable}
            autoStart={!awsFlowEnabled || p.awsDeployStarted}
          />
        </Box>
      )}

      {/* Navigation */}
      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" onClick={p.onContinue} disabled={!p.canContinue}>
          Continue
        </Button>
      </Stack>
    </Box>
  );
}
