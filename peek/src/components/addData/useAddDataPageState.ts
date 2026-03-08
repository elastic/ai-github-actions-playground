import { useEffect, useMemo, useRef, useState } from "react";

import { useAddDataApiKey } from "../../hooks/useAddDataApiKey";
import { useRichIngestionVerification } from "../../hooks/useRichIngestionVerification";
import { APM_LANGUAGE_BY_ID, type ApmLanguageDefinition } from "../../services/addData/apmCatalog";
import type { AwsDeployTarget } from "../../services/addData/awsDeployCatalog";
import {
  ADD_DATA_TECHNOLOGY_BY_ID,
  type AddDataTechnologyCatalogEntry,
} from "../../services/addData/catalog";
import type { FluentBitOutputMode } from "../../services/addData/fluentBitConfig";
import { OTEL_RECEIVER_BY_ID } from "../../services/addData/otelReceiverCatalog";
import { ElasticsearchClient } from "../../services/es";
import { useConnectionStore } from "../../store/useConnectionStore";
import {
  deriveIngestCandidates,
  probeOtlpEndpoint,
  type Platform,
  type TelemetrySignal,
} from "../../utils/addDataUtils";

export type WizardStep = 1 | 2 | 3;

export function useAddDataPageState() {
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
  const [derivedOtlpUrl, setDerivedOtlpUrl] = useState<string | null>(null);
  const [prevIngestCandidatesKey, setPrevIngestCandidatesKey] = useState("");

  const apiKeyResult = useAddDataApiKey();
  const creatingApiKey = apiKeyResult.status === "loading";
  const apiKeyValue = apiKeyResult.status === "success" ? apiKeyResult.data : null;
  const apiKeyError = apiKeyResult.status === "error" ? apiKeyResult.error : null;

  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    setClusterVersion(null);
    const client = new ElasticsearchClient(connection);
    client
      .getClusterInfo()
      .then((info) => {
        if (!cancelled) setClusterVersion(info.version.number);
      })
      .catch(() => {
        if (!cancelled) setClusterVersion(null);
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
    if (ingestCandidates.length === 0 || hasIngestOverride) return;
    let cancelled = false;
    (async () => {
      let firstReachable: string | null = null;
      /* eslint-disable no-await-in-loop -- sequential probing with early exit on first reachable endpoint */
      for (const candidate of ingestCandidates) {
        const available = await probeOtlpEndpoint(candidate);
        if (cancelled) return;
        if (available) {
          firstReachable = candidate;
          break;
        }
      }
      /* eslint-enable no-await-in-loop */
      if (cancelled) return;
      setDerivedOtlpUrl(firstReachable ?? ingestCandidates[0] ?? null);
      setIngestAvailable(Boolean(firstReachable));
    })();
    return () => {
      cancelled = true;
    };
  }, [ingestCandidates, hasIngestOverride]);

  const version = clusterVersion ?? "<VERSION>";
  const endpointType: "managed_otlp" | "elasticsearch" =
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

  const hostOnboarding = new Set(["linux-host", "windows-host", "macos-host"]).has(
    selectedTechnology?.id ?? "",
  );
  const verification = useRichIngestionVerification(selectedSignals, hostOnboarding);
  const { status: verifyStatus, startPolling } = verification;
  const verifiedSignals = useMemo(
    () => new Set(verification.deltas.filter((d) => d.signalDetected).map((d) => d.signal)),
    [verification.deltas],
  );
  const canContinueToNextSteps =
    selectedTechnology?.guideType === "apm" || verification.overallDetected || verificationSkipped;

  const lastAutoStartedApiKeyRef = useRef<string | null>(null);
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

  const resetJourney = () => {
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

  const handleSelectTechnology = (tech: AddDataTechnologyCatalogEntry) => {
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
    if (tech.guideType === "apm") {
      const languageId = tech.id.replace(/-apm$/, "");
      setSelectedApmLanguage(APM_LANGUAGE_BY_ID.get(languageId) ?? null);
    } else {
      setSelectedApmLanguage(null);
    }
    setSelectedAwsTarget(null);
    setAwsDeployStarted(false);
    setWizardStep(2);
  };

  const handleSwitchToTechnology = (technologyId: "fluent-bit" | "vector") => {
    const technology = ADD_DATA_TECHNOLOGY_BY_ID.get(technologyId);
    if (!technology) return;
    verification.resetVerification();
    lastAutoStartedApiKeyRef.current = null;
    handleSelectTechnology(technology);
  };

  return {
    wizardStep,
    setWizardStep,
    selectedTechnology,
    setSelectedTechnology,
    technologySearch,
    setTechnologySearch,
    canCreateApiKeys,
    handleSelectTechnology,
    platform,
    setPlatform,
    receiver,
    receiverFieldValues,
    setReceiverFieldValues,
    existingCollectorConfig,
    setExistingCollectorConfig,
    useExistingConfig,
    setUseExistingConfig,
    selectedAwsTarget,
    setSelectedAwsTarget,
    awsDeployStarted,
    setAwsDeployStarted,
    selectedApmLanguage,
    setSelectedApmLanguage,
    fluentBitOutputMode,
    setFluentBitOutputMode,
    esUrl,
    version,
    apiKey,
    hasApiKey,
    manualApiKeyValue,
    setManualApiKeyValue,
    otlpUrl,
    apiKeyValue,
    apiKeyError,
    creatingApiKey,
    createApiKey: () => void apiKeyResult.createKey(),
    prefilledCount,
    connectionAvailable: Boolean(connection),
    signalExpectation,
    selectedSignals,
    endpointType,
    probeTargetOtlpUrl:
      selectedTechnology?.guideType === "edot_collector" ? probeTargetOtlpUrl : null,
    ingestAvailable:
      selectedTechnology?.guideType === "edot_collector" ? effectiveIngestAvailable : null,
    verification,
    verificationSkipped,
    setVerificationSkipped,
    canContinueToNextSteps,
    verifiedSignals,
    onboardingSessionId,
    edotRecommendedSelected,
    setEdotRecommendedSelected,
    handleSwitchToTechnology,
    handleResetCurrentOnboarding: resetJourney,
    handleAddAnotherSource: resetJourney,
    resetVerificationForBack: () => {
      verification.resetVerification();
      lastAutoStartedApiKeyRef.current = null;
      setWizardStep(1);
    },
  };
}
