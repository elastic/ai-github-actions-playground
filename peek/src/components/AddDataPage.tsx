import { useEffect, useMemo, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";

import { ElasticsearchClient } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { useAddDataApiKey } from "../hooks/useAddDataApiKey";
import { useRichIngestionVerification } from "../hooks/useRichIngestionVerification";
import {
  deriveIngestCandidates,
  detectTelemetrySignals,
  probeOtlpEndpoint,
  SIGNAL_NAV,
} from "../utils/addDataUtils";
import type { EndpointType, Platform, TelemetrySignal } from "../utils/addDataUtils";
import type { AddDataTechnologyCatalogEntry } from "../services/addData/catalog";
import { OTEL_RECEIVER_BY_ID } from "../services/addData/otelReceiverCatalog";
import type { AwsDeployTarget } from "../services/addData/awsDeployCatalog";
import type { ApmLanguageDefinition } from "../services/addData/apmCatalog";
import type { FluentBitOutputMode } from "../services/addData/fluentBitConfig";

import PageHeader from "./PageHeader";
import AddDataStepTechnology from "./addData/AddDataStepTechnology";
import type { TechnologyCategoryFilter } from "./addData/AddDataStepTechnology";
import AddDataStepSetup from "./addData/AddDataStepSetup";
import AddDataStepSuccess from "./addData/AddDataStepSuccess";

type WizardStep = 1 | 2 | 3;

const STEP_TITLES: Record<WizardStep, string> = {
  1: "What are you monitoring?",
  2: "Set up and verify",
  3: "Explore your data + next steps",
};

export default function AddDataPage() {
  const connection = useConnectionStore((s) => s.connection);
  const capabilities = useConnectionStore((s) => s.capabilities);

  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [selectedTechnology, setSelectedTechnology] =
    useState<AddDataTechnologyCatalogEntry | null>(null);
  const [technologySearch, setTechnologySearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<TechnologyCategoryFilter>("all");

  const [platform, setPlatform] = useState<Platform>("kubernetes");
  const [endpointType, setEndpointType] = useState<EndpointType>("elasticsearch");
  const [receiverFieldValues, setReceiverFieldValues] = useState<Record<string, string>>({});
  const [selectedAwsTarget, setSelectedAwsTarget] = useState<AwsDeployTarget | null>(null);
  const [selectedApmLanguage, setSelectedApmLanguage] = useState<ApmLanguageDefinition | null>(
    null,
  );
  const [fluentBitOutputMode, setFluentBitOutputMode] =
    useState<FluentBitOutputMode>("elasticsearch");

  const [clusterVersion, setClusterVersion] = useState<string | null>(null);
  const endpointTypeManuallySetRef = useRef(false);
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
  const ingestCandidates = useMemo(
    () =>
      connection?.ingestUrl?.trim() ? [connection.ingestUrl.trim()] : deriveIngestCandidates(esUrl),
    [connection, esUrl],
  );
  const ingestCandidatesKey = ingestCandidates.join(",");
  const [derivedOtlpUrl, setDerivedOtlpUrl] = useState<string | null>(null);
  const [prevIngestCandidatesKey, setPrevIngestCandidatesKey] = useState(ingestCandidatesKey);
  if (ingestCandidatesKey !== prevIngestCandidatesKey) {
    setPrevIngestCandidatesKey(ingestCandidatesKey);
    setDerivedOtlpUrl(null);
    setIngestAvailable(null);
  }
  const probeTargetOtlpUrl = derivedOtlpUrl ?? ingestCandidates[0] ?? null;
  const otlpUrl = derivedOtlpUrl ?? "<YOUR_OTLP_ENDPOINT>";

  useEffect(() => {
    if (ingestCandidates.length === 0) return;
    let cancelled = false;
    endpointTypeManuallySetRef.current = false;
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
      if (available && !endpointTypeManuallySetRef.current) setEndpointType("managed_otlp");
    })();
    return () => {
      cancelled = true;
    };
  }, [ingestCandidates]);

  const version = clusterVersion ?? "<VERSION>";
  const apiKey = apiKeyValue ?? "<YOUR_API_KEY>";
  const hasEndpoint =
    endpointType === "managed_otlp" ? Boolean(derivedOtlpUrl) : Boolean(connection?.url);
  const prefilledCount = [apiKeyValue, hasEndpoint, clusterVersion].filter(Boolean).length;

  // Lightweight data-stream detection for the "existing signals" banner
  const [existingSignals, setExistingSignals] = useState<Set<TelemetrySignal> | null>(null);
  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    const client = new ElasticsearchClient(connection);
    detectTelemetrySignals(client)
      .then((signals) => {
        if (!cancelled) setExistingSignals(signals);
      })
      .catch(() => {
        /* best effort */
      });
    return () => {
      cancelled = true;
    };
  }, [connection]);

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
  const verification = useRichIngestionVerification(selectedSignals);
  const { status: verifyStatus, startPolling } = verification;
  const lastAutoStartedApiKeyRef = useRef<string | null>(null);

  // Auto-start polling when API key is generated
  useEffect(() => {
    if (
      connection &&
      apiKeyValue &&
      verifyStatus === "idle" &&
      lastAutoStartedApiKeyRef.current !== apiKeyValue
    ) {
      lastAutoStartedApiKeyRef.current = apiKeyValue;
      startPolling();
    }
  }, [connection, apiKeyValue, verifyStatus, startPolling]);

  const receiver = useMemo(
    () =>
      selectedTechnology?.guideType === "otel_receiver"
        ? (OTEL_RECEIVER_BY_ID.get(selectedTechnology.id) ?? null)
        : null,
    [selectedTechnology],
  );

  const handleSelectTechnology = (tech: AddDataTechnologyCatalogEntry) => {
    setSelectedTechnology(tech);
    setPlatform(tech.defaultPlatform);
    setReceiverFieldValues({});
    setSelectedAwsTarget(null);
    setSelectedApmLanguage(null);
    setFluentBitOutputMode("elasticsearch");
  };

  const handleAddAnotherSource = () => {
    setSelectedTechnology(null);
    setTechnologySearch("");
    setActiveCategory("all");
    setEndpointType("elasticsearch");
    endpointTypeManuallySetRef.current = false;
    setReceiverFieldValues({});
    setSelectedAwsTarget(null);
    setSelectedApmLanguage(null);
    setFluentBitOutputMode("elasticsearch");
    verification.resetVerification();
    lastAutoStartedApiKeyRef.current = null;
    setWizardStep(1);
  };

  const renderStepProgress = () => (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      {(Object.keys(STEP_TITLES) as unknown as WizardStep[]).map((stepNumber) => (
        <Chip
          key={stepNumber}
          label={`Step ${stepNumber}: ${STEP_TITLES[stepNumber]}`}
          color={
            stepNumber === wizardStep ? "primary" : stepNumber < wizardStep ? "success" : "default"
          }
          variant={stepNumber === wizardStep ? "filled" : "outlined"}
          size="small"
        />
      ))}
    </Stack>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Add Data"
          description="Onboard a new telemetry source in three guided steps: choose technology, set up and verify, then explore your data."
          actions={
            clusterVersion ? (
              <Chip label={`EDOT Collector v${clusterVersion}`} size="small" variant="outlined" />
            ) : undefined
          }
        />
        <Box sx={{ mt: 1.5 }}>{renderStepProgress()}</Box>
      </Paper>

      {existingSignals &&
        existingSignals.size > 0 &&
        (() => {
          const sorted = Array.from(existingSignals).sort();
          const label =
            sorted.length > 2
              ? `${sorted.slice(0, -1).join(", ")}, and ${sorted[sorted.length - 1]}`
              : sorted.join(" and ");
          return (
            <Alert severity="info">
              You already have {label} data. {sorted.map((s) => SIGNAL_NAV[s].label).join(", ")} are
              ready. Add another source below.
            </Alert>
          );
        })()}

      {wizardStep === 1 && (
        <AddDataStepTechnology
          selectedTechnology={selectedTechnology}
          onSelectTechnology={handleSelectTechnology}
          technologySearch={technologySearch}
          onTechnologySearchChange={setTechnologySearch}
          activeCategory={activeCategory}
          onActiveCategoryChange={setActiveCategory}
          onContinue={() => setWizardStep(2)}
        />
      )}

      {wizardStep === 2 && (
        <AddDataStepSetup
          selectedTechnology={selectedTechnology}
          signalExpectation={signalExpectation}
          selectedSignals={selectedSignals}
          endpointType={endpointType}
          onEndpointTypeChange={setEndpointType}
          onEndpointTypeManuallySet={() => {
            endpointTypeManuallySetRef.current = true;
          }}
          probeTargetOtlpUrl={probeTargetOtlpUrl}
          ingestAvailable={ingestAvailable}
          platform={platform}
          onPlatformChange={setPlatform}
          receiver={receiver}
          receiverFieldValues={receiverFieldValues}
          onReceiverFieldValuesChange={setReceiverFieldValues}
          selectedAwsTarget={selectedAwsTarget}
          onSelectAwsTarget={setSelectedAwsTarget}
          selectedApmLanguage={selectedApmLanguage}
          onSelectApmLanguage={setSelectedApmLanguage}
          fluentBitOutputMode={fluentBitOutputMode}
          onFluentBitOutputModeChange={setFluentBitOutputMode}
          esUrl={esUrl}
          version={version}
          apiKey={apiKey}
          otlpUrl={otlpUrl}
          apiKeyValue={apiKeyValue}
          apiKeyError={apiKeyError}
          creatingApiKey={creatingApiKey}
          onCreateApiKey={() => void apiKeyResult.createKey()}
          capabilities={capabilities}
          hasEndpoint={hasEndpoint}
          prefilledCount={prefilledCount}
          derivedOtlpUrl={derivedOtlpUrl}
          clusterVersion={clusterVersion}
          connectionUrl={connection?.url ?? null}
          connectionAvailable={Boolean(connection)}
          verification={verification}
          onBack={() => setWizardStep(1)}
          onContinue={() => setWizardStep(3)}
        />
      )}

      {wizardStep === 3 && (
        <AddDataStepSuccess
          selectedTechnology={selectedTechnology}
          foundSignals={verification.dataStreamSignals}
          selectedSignals={selectedSignals}
          onAddAnotherSource={handleAddAnotherSource}
          onBack={() => setWizardStep(2)}
        />
      )}
    </Box>
  );
}
