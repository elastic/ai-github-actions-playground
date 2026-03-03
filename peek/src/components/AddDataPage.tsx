import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";

import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { copyToClipboard } from "../utils/copyToClipboard";
import { useAddDataApiKey } from "../hooks/useAddDataApiKey";
import { useCopyFeedbackTimeout } from "../hooks/useCopyFeedbackTimeout";
import {
  deriveIngestCandidates,
  detectTelemetrySignals,
  parseCommandSteps,
  probeOtlpEndpoint,
  PLATFORM_GUIDES,
  SIGNAL_NAV,
} from "../utils/addDataUtils";
import type {
  AddDataSuccessCta,
  EndpointType,
  Platform,
  TelemetrySignal,
} from "../utils/addDataUtils";

import PageHeader from "./PageHeader";

const AUTO_POLL_INTERVAL_MS = 5_000;

type WizardStep = 1 | 2 | 3 | 4 | 5;
type TechnologyCategory =
  | "Cloud"
  | "Containers"
  | "Databases"
  | "Applications"
  | "Operating Systems"
  | "Network";

interface TechnologyOption {
  id: string;
  name: string;
  category: TechnologyCategory;
  summary: string;
  expectedSignals: TelemetrySignal[];
  defaultPlatform: Platform;
}

const TECHNOLOGY_OPTIONS: TechnologyOption[] = [
  {
    id: "kubernetes",
    name: "Kubernetes",
    category: "Containers",
    summary: "Collect cluster, node, and workload telemetry.",
    expectedSignals: ["metrics", "logs", "traces"],
    defaultPlatform: "kubernetes",
  },
  {
    id: "docker",
    name: "Docker",
    category: "Containers",
    summary: "Collect container and host telemetry with Docker Compose.",
    expectedSignals: ["metrics", "logs"],
    defaultPlatform: "docker",
  },
  {
    id: "linux-host",
    name: "Linux Host",
    category: "Operating Systems",
    summary: "Install EDOT Collector on Linux hosts/VMs.",
    expectedSignals: ["metrics", "logs"],
    defaultPlatform: "linux",
  },
  {
    id: "windows-host",
    name: "Windows Host",
    category: "Operating Systems",
    summary: "Install EDOT Collector on Windows hosts/VMs.",
    expectedSignals: ["metrics", "logs"],
    defaultPlatform: "windows",
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "Databases",
    summary: "Capture query performance and resource telemetry.",
    expectedSignals: ["metrics", "logs"],
    defaultPlatform: "linux",
  },
  {
    id: "nginx",
    name: "Nginx",
    category: "Applications",
    summary: "Capture request logs and latency metrics.",
    expectedSignals: ["logs", "metrics"],
    defaultPlatform: "linux",
  },
];

const RECOMMENDED_TECHNOLOGY_IDS = ["kubernetes", "docker", "linux-host"];
const CATEGORIES: Array<"All" | TechnologyCategory> = [
  "All",
  "Cloud",
  "Containers",
  "Databases",
  "Applications",
  "Operating Systems",
  "Network",
];

const STEP_TITLES: Record<WizardStep, string> = {
  1: "What are you monitoring?",
  2: "Select your environment",
  3: "Install and configure",
  4: "Validate data receipt",
  5: "Explore your data + next steps",
};

export default function AddDataPage() {
  const navigate = useNavigate();
  const connection = useConnectionStore((s) => s.connection);
  const capabilities = useConnectionStore((s) => s.capabilities);

  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [selectedTechnology, setSelectedTechnology] = useState<TechnologyOption | null>(null);
  const [technologySearch, setTechnologySearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<"All" | TechnologyCategory>("All");

  const [platform, setPlatform] = useState<Platform>("kubernetes");
  const [endpointType, setEndpointType] = useState<EndpointType>("elasticsearch");
  const [copied, setCopied] = useState(false);
  const scheduleCopyFeedbackReset = useCopyFeedbackTimeout(() => setCopied(false));
  const [stepCopiedIndex, setStepCopiedIndex] = useState<number | null>(null);
  const scheduleStepCopyReset = useCopyFeedbackTimeout(() => setStepCopiedIndex(null));

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
    [connection?.ingestUrl, esUrl],
  );
  const [derivedOtlpUrl, setDerivedOtlpUrl] = useState<string | null>(null);
  const probeTargetOtlpUrl = derivedOtlpUrl ?? ingestCandidates[0] ?? null;
  const otlpUrl = derivedOtlpUrl ?? "<YOUR_OTLP_ENDPOINT>";

  useEffect(() => {
    if (ingestCandidates.length === 0) {
      setDerivedOtlpUrl(null);
      setIngestAvailable(null);
      return;
    }
    let cancelled = false;
    endpointTypeManuallySetRef.current = false;
    setDerivedOtlpUrl(null);
    setIngestAvailable(null);
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
  const activeGuide = useMemo(() => PLATFORM_GUIDES[platform], [platform]);

  const fullCommand = useMemo(
    () => activeGuide.command({ esUrl, version, apiKey, endpointType, otlpUrl }),
    [activeGuide, esUrl, version, apiKey, endpointType, otlpUrl],
  );
  const commandSteps = useMemo(() => parseCommandSteps(fullCommand), [fullCommand]);

  const handleCopyAll = useCallback(async () => {
    const ok = await copyToClipboard(fullCommand);
    if (!ok) return;
    setCopied(true);
    scheduleCopyFeedbackReset();
  }, [fullCommand, scheduleCopyFeedbackReset]);

  const handleCopyStep = useCallback(
    async (index: number) => {
      const step = commandSteps[index];
      if (!step) return;
      const ok = await copyToClipboard(step.command);
      if (!ok) return;
      setStepCopiedIndex(index);
      scheduleStepCopyReset();
    },
    [commandSteps, scheduleStepCopyReset],
  );

  const handleCopyApiKey = useCallback(async () => {
    if (!apiKeyValue) return;
    const ok = await copyToClipboard(apiKeyValue);
    if (!ok) return;
    setCopied(true);
    scheduleCopyFeedbackReset();
  }, [apiKeyValue, scheduleCopyFeedbackReset]);

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

  type VerifyStatus = "idle" | "checking" | "polling" | "found" | "not_found" | "error";
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("idle");
  const [foundSignals, setFoundSignals] = useState<Set<TelemetrySignal>>(new Set());
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const verifyAbortControllerRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      verifyAbortControllerRef.current?.abort();
      stopPolling();
    };
  }, [stopPolling]);

  useEffect(() => {
    verifyAbortControllerRef.current?.abort();
    verifyAbortControllerRef.current = null;
    stopPolling();
    setVerifyStatus("idle");
    setFoundSignals(new Set());
    setVerifyError(null);
  }, [connection, stopPolling]);

  const runVerifyOnce = useCallback(async () => {
    if (!connection) return;
    verifyAbortControllerRef.current?.abort();
    const controller = new AbortController();
    verifyAbortControllerRef.current = controller;
    try {
      const client = new ElasticsearchClient(connection);
      const signals = await detectTelemetrySignals(client, controller.signal);
      if (controller.signal.aborted) return;
      setFoundSignals(signals);
      if (signals.size > 0) {
        setVerifyStatus("found");
        stopPolling();
      } else {
        setVerifyStatus("polling");
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setVerifyError(isElasticsearchError(err) ? err.message : String(err));
      setVerifyStatus("error");
      stopPolling();
    } finally {
      if (verifyAbortControllerRef.current === controller) {
        verifyAbortControllerRef.current = null;
      }
    }
  }, [connection, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    setVerifyStatus("polling");
    setVerifyError(null);
    void runVerifyOnce();
    pollIntervalRef.current = setInterval(() => {
      void runVerifyOnce();
    }, AUTO_POLL_INTERVAL_MS);
  }, [stopPolling, runVerifyOnce]);

  const handleVerifyIngestion = useCallback(() => {
    setVerifyStatus("checking");
    startPolling();
  }, [startPolling]);

  const hasTriggeredPolling = useRef(false);
  useEffect(() => {
    if (hasTriggeredPolling.current) return;
    if (apiKeyValue && verifyStatus === "idle") {
      hasTriggeredPolling.current = true;
      startPolling();
    }
  }, [apiKeyValue, verifyStatus, startPolling]);

  const selectedSignals = selectedTechnology?.expectedSignals ?? [];
  const signalExpectation =
    selectedSignals.length > 1
      ? `${selectedSignals.slice(0, -1).join(", ")} and ${selectedSignals[selectedSignals.length - 1]}`
      : (selectedSignals[0] ?? "telemetry");

  const expectedButMissingSignals = selectedSignals.filter((signal) => !foundSignals.has(signal));
  const foundExpectedSignals = selectedSignals.filter((signal) => foundSignals.has(signal));

  const recommendedTechnologies = useMemo(
    () => TECHNOLOGY_OPTIONS.filter((tech) => RECOMMENDED_TECHNOLOGY_IDS.includes(tech.id)),
    [],
  );

  const filteredTechnologies = useMemo(() => {
    const query = technologySearch.trim().toLowerCase();
    return TECHNOLOGY_OPTIONS.filter((tech) => {
      const categoryMatches = activeCategory === "All" || tech.category === activeCategory;
      const queryMatches =
        query.length === 0 ||
        tech.name.toLowerCase().includes(query) ||
        tech.summary.toLowerCase().includes(query);
      return categoryMatches && queryMatches;
    });
  }, [activeCategory, technologySearch]);

  const outcomeSignals =
    foundSignals.size > 0
      ? (Array.from(foundSignals).sort() as TelemetrySignal[])
      : selectedSignals;

  const outcomeCtas = useMemo(() => {
    const ctas: AddDataSuccessCta[] = [];
    for (const signal of outcomeSignals) {
      ctas.push(...SIGNAL_NAV[signal].successCtas);
    }
    if (ctas.length === 0) {
      ctas.push({ id: "additional_source", label: "Add another source", path: "/add-data" });
    }
    const unique = new Map<string, AddDataSuccessCta>();
    for (const cta of ctas) {
      unique.set(`${cta.id}:${cta.path}`, cta);
    }
    return Array.from(unique.values());
  }, [outcomeSignals]);

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
          description="Onboard a new telemetry source in five guided steps: choose technology, configure environment, install collector, verify ingestion, and explore next actions."
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
        <Paper
          variant="outlined"
          sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1.5 }}
        >
          <Typography variant="h6">Step 1: What are you monitoring?</Typography>
          <Typography variant="body2" color="text.secondary">
            Pick a technology to tailor environment choices, setup commands, verification checks,
            and next actions.
          </Typography>
          <TextField
            label="Search technologies"
            value={technologySearch}
            onChange={(e) => setTechnologySearch(e.target.value)}
            fullWidth
          />
          <ToggleButtonGroup
            value={activeCategory}
            exclusive
            size="small"
            onChange={(_, value: "All" | TechnologyCategory | null) => {
              if (value) setActiveCategory(value);
            }}
            aria-label="Technology category"
          >
            {CATEGORIES.map((category) => (
              <ToggleButton key={category} value={category}>
                {category}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Stack spacing={1}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Recommended for you
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {recommendedTechnologies.map((tech) => (
                <Button
                  key={tech.id}
                  size="small"
                  variant={selectedTechnology?.id === tech.id ? "contained" : "outlined"}
                  onClick={() => {
                    setSelectedTechnology(tech);
                    setPlatform(tech.defaultPlatform);
                  }}
                >
                  {tech.name}
                </Button>
              ))}
            </Stack>
          </Stack>

          <Stack spacing={1}>
            {filteredTechnologies.map((tech) => (
              <Paper key={tech.id} variant="outlined" sx={{ p: 1 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  spacing={1}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {tech.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {tech.category} • {tech.summary}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant={selectedTechnology?.id === tech.id ? "contained" : "outlined"}
                    onClick={() => {
                      setSelectedTechnology(tech);
                      setPlatform(tech.defaultPlatform);
                    }}
                  >
                    {selectedTechnology?.id === tech.id ? "Selected" : "Choose"}
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>

          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant="contained"
              onClick={() => setWizardStep(2)}
              disabled={selectedTechnology === null}
            >
              Continue to step 2
            </Button>
          </Stack>
        </Paper>
      )}

      {wizardStep === 2 && (
        <Paper
          variant="outlined"
          sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1.5 }}
        >
          <Typography variant="h6">Step 2: Select your environment</Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedTechnology
              ? `${selectedTechnology.name} can emit ${signalExpectation}.`
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
                  endpointTypeManuallySetRef.current = true;
                  setEndpointType(value);
                }
              }}
              aria-label="Endpoint type"
            >
              <ToggleButton value="elasticsearch">Elasticsearch</ToggleButton>
              <ToggleButton value="managed_otlp">Managed OTLP</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {endpointType === "managed_otlp" && probeTargetOtlpUrl && (
            <Alert
              severity={
                ingestAvailable ? "success" : ingestAvailable === false ? "warning" : "info"
              }
            >
              {ingestAvailable === null
                ? `Checking OTLP endpoint availability at ${probeTargetOtlpUrl}…`
                : ingestAvailable
                  ? `OTLP endpoint verified at ${probeTargetOtlpUrl}`
                  : `Could not reach OTLP endpoint at ${probeTargetOtlpUrl} — verify the URL is correct`}
            </Alert>
          )}

          <Tabs
            value={platform}
            onChange={(_, value: Platform) => setPlatform(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0.5 } }}
          >
            <Tab value="kubernetes" label="Kubernetes" />
            <Tab value="docker" label="Docker" />
            <Tab value="linux" label="Linux" />
            <Tab value="macos" label="macOS" />
            <Tab value="windows" label="Windows" />
          </Tabs>

          <Stack direction="row" justifyContent="space-between">
            <Button variant="outlined" onClick={() => setWizardStep(1)}>
              Back
            </Button>
            <Button variant="contained" onClick={() => setWizardStep(3)}>
              Continue to step 3
            </Button>
          </Stack>
        </Paper>
      )}

      {wizardStep === 3 && (
        <Paper
          variant="outlined"
          sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1.5 }}
        >
          <Typography variant="h6">Step 3: Install and configure</Typography>
          <Typography variant="body2" color="text.secondary">
            Use the generated {activeGuide.label} quickstart commands for{" "}
            {selectedTechnology?.name ?? "your source"}.
          </Typography>

          <Box role="tabpanel">
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ flex: 1 }}>
                {activeGuide.label} quickstart
              </Typography>
              <Button size="small" variant="outlined" onClick={() => void handleCopyAll()}>
                {copied ? "Copied!" : "Copy all"}
              </Button>
              <Button
                size="small"
                variant="outlined"
                href={activeGuide.quickstartUrl}
                target="_blank"
                rel="noopener noreferrer"
                endIcon={<OpenInNewIcon fontSize="small" />}
              >
                Open official docs
              </Button>
            </Stack>

            <Stack spacing={1.5} sx={{ mt: 1.5 }}>
              {commandSteps.map((step, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Chip
                      label={step.number}
                      size="small"
                      color="primary"
                      sx={{ minWidth: 28, fontWeight: 700 }}
                    />
                    <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                      {step.title}
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<ContentCopyIcon fontSize="small" />}
                      onClick={() => void handleCopyStep(index)}
                    >
                      {stepCopiedIndex === index ? "Copied!" : "Copy"}
                    </Button>
                  </Stack>
                  <Box
                    component="pre"
                    sx={{
                      overflow: "auto",
                      m: 0,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: "background.default",
                      wordBreak: "break-all",
                      whiteSpace: "pre-wrap",
                      fontSize: "0.8rem",
                      fontFamily: "monospace",
                    }}
                  >
                    {step.command}
                  </Box>
                </Paper>
              ))}
            </Stack>

            <Alert severity="info" sx={{ mt: 1.5 }}>
              {apiKeyValue
                ? "Your generated API key" + (hasEndpoint || clusterVersion ? ", " : " ")
                : "Generate an API key below (or provide your own) — "}
              {endpointType === "managed_otlp" && derivedOtlpUrl
                ? "OTLP endpoint, "
                : connection?.url
                  ? "Elasticsearch endpoint, "
                  : ""}
              {clusterVersion ? `and EDOT Collector v${clusterVersion} ` : ""}
              {apiKeyValue ||
              (endpointType === "managed_otlp"
                ? Boolean(derivedOtlpUrl)
                : Boolean(connection?.url)) ||
              clusterVersion
                ? (prefilledCount > 1 ? "have" : "has") + " been pre-filled in the command above."
                : "Replace the placeholders before running."}
              {!apiKeyValue && (
                <>
                  {" "}
                  Replace <code>&lt;YOUR_API_KEY&gt;</code> with a generated or existing key.
                </>
              )}
            </Alert>
          </Box>

          <Typography variant="body2">Collector credentials</Typography>
          {apiKeyError && <Alert severity="error">{apiKeyError}</Alert>}
          {capabilities?.canCreateApiKeys ? (
            <>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => void apiKeyResult.createKey()}
                  disabled={creatingApiKey}
                >
                  {creatingApiKey ? <CircularProgress size={16} /> : "Generate API key"}
                </Button>
                <Typography variant="body2" color="text.secondary">
                  Generates an API key for collector setup.
                </Typography>
              </Stack>
              {apiKeyValue && (
                <>
                  <Alert severity="warning">
                    Copy this API key now. You will not be able to read it again after leaving this
                    page.
                  </Alert>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small"
                      fullWidth
                      label="Base64 API key"
                      value={apiKeyValue}
                      slotProps={{ input: { readOnly: true } }}
                    />
                    <Button size="small" variant="outlined" onClick={() => void handleCopyApiKey()}>
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </Stack>
                </>
              )}
            </>
          ) : (
            <Alert severity="warning">
              Your credentials do not include API key creation privileges. Generate a key manually
              via{" "}
              <Link
                href="https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-create-api-key"
                target="_blank"
                rel="noopener noreferrer"
              >
                Create API key endpoint
              </Link>{" "}
              or ask an administrator to provision one for collector onboarding.
            </Alert>
          )}

          <Stack direction="row" justifyContent="space-between">
            <Button variant="outlined" onClick={() => setWizardStep(2)}>
              Back
            </Button>
            <Button variant="contained" onClick={() => setWizardStep(4)}>
              Continue to step 4
            </Button>
          </Stack>
        </Paper>
      )}

      {wizardStep === 4 && (
        <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1.5 }}>
          <Typography variant="h6">Step 4: Validate data receipt</Typography>
          <Typography variant="body2" color="text.secondary">
            For {selectedTechnology?.name ?? "this integration"}, we expect to receive{" "}
            {signalExpectation}.
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant="contained"
              onClick={() => void handleVerifyIngestion()}
              disabled={!connection || verifyStatus === "checking" || verifyStatus === "polling"}
              startIcon={
                verifyStatus === "checking" || verifyStatus === "polling" ? (
                  <CircularProgress size={16} />
                ) : (
                  <CheckCircleOutlineIcon fontSize="small" />
                )
              }
            >
              {verifyStatus === "checking" || verifyStatus === "polling"
                ? "Checking…"
                : "Check now"}
            </Button>
            {verifyStatus === "polling" && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <RadioButtonCheckedIcon
                  color="info"
                  sx={{
                    animation: "pulse 1.5s ease-in-out infinite",
                    fontSize: 16,
                    "@keyframes pulse": {
                      "0%, 100%": { opacity: 1 },
                      "50%": { opacity: 0.3 },
                    },
                  }}
                />
                <Typography variant="body2" color="info.main">
                  Listening for data…
                </Typography>
              </Stack>
            )}
          </Stack>

          {verifyStatus === "error" && <Alert severity="error">{verifyError}</Alert>}

          {(verifyStatus === "not_found" ||
            (verifyStatus === "polling" && foundSignals.size === 0)) && (
            <Alert severity="info">
              No telemetry data streams found yet. Make sure the collector is running — we&apos;ll
              keep checking automatically.{" "}
              <Link
                href="https://www.elastic.co/docs/solutions/observability/get-started/opentelemetry"
                target="_blank"
                rel="noopener noreferrer"
              >
                Troubleshooting docs
              </Link>
            </Alert>
          )}

          {verifyStatus === "found" && (
            <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
              Telemetry data detected! Found: {Array.from(foundSignals).sort().join(", ")}.
              {expectedButMissingSignals.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Partial success
                  </Typography>
                  <Typography variant="body2">
                    We found {foundExpectedSignals.join(", ") || "telemetry"}, but still missing{" "}
                    {expectedButMissingSignals.join(", ")} for{" "}
                    {selectedTechnology?.name ?? "this source"}.
                  </Typography>
                </Box>
              )}
            </Alert>
          )}

          <Stack direction="row" justifyContent="space-between">
            <Button variant="outlined" onClick={() => setWizardStep(3)}>
              Back
            </Button>
            <Button variant="contained" onClick={() => setWizardStep(5)}>
              Continue to step 5
            </Button>
          </Stack>
        </Paper>
      )}

      {wizardStep === 5 && (
        <Paper
          variant="outlined"
          sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1.5 }}
        >
          <Typography variant="h6">Step 5: Explore your data + next steps</Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedTechnology?.name ?? "Your source"} is configured. Choose a next action to
            explore dashboards, set up alerting, or onboard another source.
          </Typography>
          {outcomeSignals.length > 0 && (
            <Alert severity="success">
              Ready signals: {outcomeSignals.map((signal) => SIGNAL_NAV[signal].label).join(", ")}.
            </Alert>
          )}
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {outcomeCtas.map((cta) => (
              <Button
                key={`${cta.id}:${cta.path}`}
                size="small"
                variant={cta.id === "signal" ? "contained" : "outlined"}
                onClick={() => {
                  if (cta.id === "additional_source") {
                    setWizardStep(1);
                    return;
                  }
                  navigate(cta.path);
                }}
              >
                {cta.label}
              </Button>
            ))}
          </Stack>
          <Stack direction="row" justifyContent="flex-start">
            <Button variant="outlined" onClick={() => setWizardStep(4)}>
              Back
            </Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
