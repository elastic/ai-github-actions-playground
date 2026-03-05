import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";

import { ElasticsearchClient } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { useAddDataApiKey } from "../hooks/useAddDataApiKey";
import { useRichIngestionVerification } from "../hooks/useRichIngestionVerification";
import { deriveIngestCandidates, probeOtlpEndpoint } from "../utils/addDataUtils";
import type { Platform, TelemetrySignal } from "../utils/addDataUtils";
import {
  ADD_DATA_TECHNOLOGY_BY_ID,
  type AddDataTechnologyCatalogEntry,
} from "../services/addData/catalog";
import { OTEL_RECEIVER_BY_ID } from "../services/addData/otelReceiverCatalog";
import type { AwsDeployTarget } from "../services/addData/awsDeployCatalog";
import { APM_LANGUAGE_BY_ID, type ApmLanguageDefinition } from "../services/addData/apmCatalog";
import type { FluentBitOutputMode } from "../services/addData/fluentBitConfig";

import AddDataStepTechnology from "./addData/AddDataStepTechnology";
import AddDataStepSetup from "./addData/AddDataStepSetup";
import AddDataStepSuccess from "./addData/AddDataStepSuccess";

type WizardStep = 1 | 2 | 3;

export default function AddDataPage() {
  const connection = useConnectionStore((s) => s.connection);
  const canCreateApiKeys = useConnectionStore((s) => s.capabilities?.canCreateApiKeys ?? null);

  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [selectedTechnology, setSelectedTechnology] =
    useState<AddDataTechnologyCatalogEntry | null>(null);
  const [technologySearch, setTechnologySearch] = useState("");

  const [platform, setPlatform] = useState<Platform>("kubernetes");
  const [receiverFieldValues, setReceiverFieldValues] = useState<Record<string, string>>({});
  const [existingCollectorConfig, setExistingCollectorConfig] = useState("");
  const [useExistingConfig, setUseExistingConfig] = useState(false);
  const [selectedAwsTarget, setSelectedAwsTarget] = useState<AwsDeployTarget | null>(null);
  const [awsDeployStarted, setAwsDeployStarted] = useState(false);
  const [manualApiKeyValue, setManualApiKeyValue] = useState("");
  const [selectedApmLanguage, setSelectedApmLanguage] = useState<ApmLanguageDefinition | null>(
    null,
  );
  const [fluentBitOutputMode, setFluentBitOutputMode] =
    useState<FluentBitOutputMode>("elasticsearch");
  const [edotRecommendedSelected, setEdotRecommendedSelected] = useState(false);
  const [onboardingSessionId, setOnboardingSessionId] = useState(0);
  const [verificationSkipped, setVerificationSkipped] = useState(false);

  const [clusterVersion, setClusterVersion] = useState<string | null>(null);
  const [ingestAvailable, setIngestAvailable] = useState<boolean | null>(null);

  const apiKeyResult = useAddDataApiKey();
  const creatingApiKey = apiKeyResult.status === "loading";
  const apiKeyValue = apiKeyResult.status === "success" ? apiKeyResult.data : null;
  const apiKeyError = apiKeyResult.status === "error" ? apiKeyResult.error : null;

  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    const client = new ElasticsearchClient(connection);
    client
      .getClusterInfo()
      .then((info) => {
        if (!cancelled) setClusterVersion(info.version.number);
      })
      .catch(() => {
        /* best effort */
      });
    return () => {
      cancelled = true;
    };
  }, [connection]);

  const esUrl = connection?.url ?? "<YOUR_ELASTICSEARCH_ENDPOINT>";
  const ingestOverrideUrl = connection?.ingestUrl?.trim() ?? "";
  const hasIngestOverride = ingestOverrideUrl.length > 0;
  const ingestCandidates = useMemo(
    () => (hasIngestOverride ? [ingestOverrideUrl] : deriveIngestCandidates(esUrl)),
    [hasIngestOverride, ingestOverrideUrl, esUrl],
  );
  const ingestCandidatesKey = ingestCandidates.join(",");
  const [derivedOtlpUrl, setDerivedOtlpUrl] = useState<string | null>(null);
  const [prevIngestCandidatesKey, setPrevIngestCandidatesKey] = useState(ingestCandidatesKey);
  if (ingestCandidatesKey !== prevIngestCandidatesKey) {
    setPrevIngestCandidatesKey(ingestCandidatesKey);
    setDerivedOtlpUrl(null);
    setIngestAvailable(null);
  }
  const effectiveDerivedOtlpUrl = hasIngestOverride ? ingestOverrideUrl : derivedOtlpUrl;
  const probeTargetOtlpUrl = effectiveDerivedOtlpUrl ?? ingestCandidates[0] ?? null;
  const otlpUrl = effectiveDerivedOtlpUrl ?? "<YOUR_OTLP_ENDPOINT>";
  const effectiveIngestAvailable = hasIngestOverride ? true : ingestAvailable;

  useEffect(() => {
    if (ingestCandidates.length === 0) return;
    if (hasIngestOverride) {
      // Respect explicit ingest URL overrides from settings and skip reachability probing.
      // Values are derived during render above; no setState needed.
      return;
    }
    let cancelled = false;
    (async () => {
      let firstReachable: string | null = null;
      for (const candidate of ingestCandidates) {
        const available = await probeOtlpEndpoint(candidate);
        if (cancelled) return;
        if (available) {
          firstReachable = candidate;
          break;
        }
      }
      if (cancelled) return;
      setDerivedOtlpUrl(firstReachable ?? ingestCandidates[0] ?? null);
      const available = Boolean(firstReachable);
      setIngestAvailable(available);
    })();
    return () => {
      cancelled = true;
    };
  }, [ingestCandidates, hasIngestOverride, ingestOverrideUrl]);

  const version = clusterVersion ?? "<VERSION>";
  const endpointType =
    selectedTechnology?.guideType === "aws_cloud_deploy"
      ? "elasticsearch"
      : selectedTechnology?.guideType === "apm"
        ? "managed_otlp"
        : effectiveIngestAvailable
          ? "managed_otlp"
          : "elasticsearch";
  const effectiveApiKey = apiKeyValue ?? manualApiKeyValue.trim();
  const apiKey = effectiveApiKey || "<YOUR_API_KEY>";
  const hasApiKey = Boolean(effectiveApiKey);
  const hasEndpoint =
    endpointType === "managed_otlp" ? Boolean(effectiveDerivedOtlpUrl) : Boolean(connection?.url);
  const prefilledCount = [hasApiKey, hasEndpoint, Boolean(clusterVersion)].filter(Boolean).length;

  const selectedSignals = (selectedTechnology?.expectedSignals ?? []) as readonly TelemetrySignal[];
  useEffect(() => {
    if (selectedTechnology && selectedTechnology.expectedSignals.length === 0) {
      console.warn(
        `[AddDataPage] Technology "${selectedTechnology.id}" has no expected telemetry signals configured`,
      );
    }
  }, [selectedTechnology]);
  const signalExpectation =
    selectedSignals.length > 1
      ? `${selectedSignals.slice(0, -1).join(", ")} and ${selectedSignals[selectedSignals.length - 1]}`
      : (selectedSignals[0] ?? "no expected signals");

  // ---- Rich ingestion verification (two-tier: data stream + cardinality) ----
  const hostOnboarding = new Set(["linux-host", "windows-host", "macos-host"]).has(
    selectedTechnology?.id ?? "",
  );
  const verification = useRichIngestionVerification(selectedSignals, hostOnboarding);
  const { status: verifyStatus, startPolling } = verification;
  const verifiedSignals = useMemo(
    () => new Set(verification.deltas.filter((d) => d.signalDetected).map((d) => d.signal)),
    [verification.deltas],
  );
  // APM guides can always advance to Step 3 (verification is informational for APM)
  const canContinueToNextSteps =
    selectedTechnology?.guideType === "apm" || verification.overallDetected || verificationSkipped;
  const lastAutoStartedApiKeyRef = useRef<string | null>(null);

  // Auto-start polling when API key is generated
  useEffect(() => {
    const isAwsGuide = selectedTechnology?.guideType === "aws_cloud_deploy";
    const canAutoStartPolling = !isAwsGuide || awsDeployStarted;
    if (
      connection &&
      hasApiKey &&
      canAutoStartPolling &&
      verifyStatus === "idle" &&
      lastAutoStartedApiKeyRef.current !== effectiveApiKey
    ) {
      lastAutoStartedApiKeyRef.current = effectiveApiKey;
      startPolling();
    }
  }, [
    connection,
    hasApiKey,
    effectiveApiKey,
    awsDeployStarted,
    selectedTechnology,
    verifyStatus,
    startPolling,
  ]);

  const receiver = useMemo(
    () =>
      selectedTechnology?.guideType === "otel_receiver"
        ? (OTEL_RECEIVER_BY_ID.get(selectedTechnology.id) ?? null)
        : null,
    [selectedTechnology],
  );

  const handleSelectTechnology = (tech: AddDataTechnologyCatalogEntry) => {
    // Each onboarding journey gets a fresh API key (no cross-journey reuse).
    apiKeyResult.reset();
    setOnboardingSessionId((prev) => prev + 1);
    setSelectedTechnology(tech);
    setPlatform(tech.defaultPlatform);
    setReceiverFieldValues({});
    setExistingCollectorConfig("");
    setUseExistingConfig(false);
    setFluentBitOutputMode("elasticsearch");
    setManualApiKeyValue("");
    setEdotRecommendedSelected(tech.guideType !== "edot_collector");
    setVerificationSkipped(false);

    // Pre-select APM language from tech ID (e.g., "java-apm" → "java")
    if (tech.guideType === "apm") {
      const languageId = tech.id.replace(/-apm$/, "");
      setSelectedApmLanguage(APM_LANGUAGE_BY_ID.get(languageId) ?? null);
    } else {
      setSelectedApmLanguage(null);
    }

    // AWS guide is now step-driven: user explicitly chooses Firehose or another option.
    setSelectedAwsTarget(null);
    setAwsDeployStarted(false);
    setWizardStep(2);
  };

  const handleAddAnotherSource = () => {
    setSelectedTechnology(null);
    setTechnologySearch("");
    setReceiverFieldValues({});
    setExistingCollectorConfig("");
    setUseExistingConfig(false);
    setSelectedAwsTarget(null);
    setAwsDeployStarted(false);
    setManualApiKeyValue("");
    setSelectedApmLanguage(null);
    setFluentBitOutputMode("elasticsearch");
    setEdotRecommendedSelected(false);
    setVerificationSkipped(false);
    apiKeyResult.reset();
    verification.resetVerification();
    lastAutoStartedApiKeyRef.current = null;
    setWizardStep(1);
  };

  const handleResetCurrentOnboarding = () => {
    handleAddAnotherSource();
  };

  const handleSwitchToTechnology = (technologyId: "fluent-bit" | "vector") => {
    const technology = ADD_DATA_TECHNOLOGY_BY_ID.get(technologyId);
    if (!technology) return;
    verification.resetVerification();
    lastAutoStartedApiKeyRef.current = null;
    handleSelectTechnology(technology);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, height: "100%", minHeight: 0 }}>
      {wizardStep === 1 && (
        <AddDataStepTechnology
          selectedTechnology={selectedTechnology}
          onSelectTechnology={handleSelectTechnology}
          onClearTechnology={() => setSelectedTechnology(null)}
          technologySearch={technologySearch}
          onTechnologySearchChange={setTechnologySearch}
          canCreateApiKeys={canCreateApiKeys}
        />
      )}

      {wizardStep === 2 && (
        <AddDataStepSetup
          key={`${selectedTechnology?.id ?? "none"}-${onboardingSessionId}`}
          onSwitchToTechnology={handleSwitchToTechnology}
          edotRecommendedSelected={edotRecommendedSelected}
          onSelectEdotRecommended={() => setEdotRecommendedSelected(true)}
          selectedTechnology={selectedTechnology}
          signalExpectation={signalExpectation}
          selectedSignals={selectedSignals}
          endpointType={endpointType}
          probeTargetOtlpUrl={
            selectedTechnology?.guideType === "edot_collector" ? probeTargetOtlpUrl : null
          }
          ingestAvailable={
            selectedTechnology?.guideType === "edot_collector" ? effectiveIngestAvailable : null
          }
          platform={platform}
          onPlatformChange={setPlatform}
          receiver={receiver}
          receiverFieldValues={receiverFieldValues}
          onReceiverFieldValuesChange={setReceiverFieldValues}
          existingCollectorConfig={existingCollectorConfig}
          onExistingCollectorConfigChange={setExistingCollectorConfig}
          useExistingConfig={useExistingConfig}
          onUseExistingConfigChange={setUseExistingConfig}
          selectedAwsTarget={selectedAwsTarget}
          onSelectAwsTarget={(target) => {
            setSelectedAwsTarget(target);
            setAwsDeployStarted(false);
          }}
          awsDeployStarted={awsDeployStarted}
          onAwsLaunchStack={() => setAwsDeployStarted(true)}
          selectedApmLanguage={selectedApmLanguage}
          onSelectApmLanguage={setSelectedApmLanguage}
          fluentBitOutputMode={fluentBitOutputMode}
          onFluentBitOutputModeChange={setFluentBitOutputMode}
          esUrl={esUrl}
          version={version}
          apiKey={apiKey}
          hasApiKey={hasApiKey}
          manualApiKeyValue={manualApiKeyValue}
          onManualApiKeyValueChange={setManualApiKeyValue}
          otlpUrl={otlpUrl}
          apiKeyValue={apiKeyValue}
          apiKeyError={apiKeyError}
          creatingApiKey={creatingApiKey}
          onCreateApiKey={() => void apiKeyResult.createKey()}
          prefilledCount={prefilledCount}
          connectionAvailable={Boolean(connection)}
          verification={verification}
          onBack={() => {
            verification.resetVerification();
            lastAutoStartedApiKeyRef.current = null;
            setWizardStep(1);
          }}
          onReset={handleResetCurrentOnboarding}
          canContinue={canContinueToNextSteps}
          verificationSkipped={verificationSkipped}
          onSkipVerification={() => setVerificationSkipped(true)}
          onContinue={() => {
            if (!canContinueToNextSteps) return;
            setWizardStep(3);
          }}
        />
      )}

      {wizardStep === 3 && (
        <AddDataStepSuccess
          selectedTechnology={selectedTechnology}
          foundSignals={verifiedSignals}
          selectedSignals={selectedSignals}
          onAddAnotherSource={handleAddAnotherSource}
          onBack={() => setWizardStep(2)}
        />
      )}
    </Box>
  );
}
