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
import type { EndpointType, Platform, TelemetrySignal } from "../utils/addDataUtils";

import PageHeader from "./PageHeader";

const SIGNAL_PREFIXES: TelemetrySignal[] = ["logs", "metrics", "traces"];
const AUTO_POLL_INTERVAL_MS = 5_000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AddDataPage() {
  const navigate = useNavigate();
  const connection = useConnectionStore((s) => s.connection);
  const capabilities = useConnectionStore((s) => s.capabilities);
  const [platform, setPlatform] = useState<Platform>("kubernetes");
  const [endpointType, setEndpointType] = useState<EndpointType>("elasticsearch");
  const [copied, setCopied] = useState(false);
  const scheduleCopyFeedbackReset = useCopyFeedbackTimeout(() => setCopied(false));
  const [stepCopiedIndex, setStepCopiedIndex] = useState<number | null>(null);
  const scheduleStepCopyReset = useCopyFeedbackTimeout(() => setStepCopiedIndex(null));

  const [clusterVersion, setClusterVersion] = useState<string | null>(null);
  const endpointTypeManuallySetRef = useRef(false);
  /** `null` = not yet probed, `true` = reachable, `false` = unreachable */
  const [ingestAvailable, setIngestAvailable] = useState<boolean | null>(null);

  const apiKeyResult = useAddDataApiKey();
  const creatingApiKey = apiKeyResult.status === "loading";
  const apiKeyValue = apiKeyResult.status === "success" ? apiKeyResult.data : null;
  const apiKeyError = apiKeyResult.status === "error" ? apiKeyResult.error : null;

  // Fetch cluster version on mount so commands use the matching EDOT version
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
        /* best-effort; commands will fall back to placeholder */
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

  // Probe the derived OTLP ingest endpoint; auto-select OTLP when reachable
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
        // Probe each candidate in order and use the first reachable endpoint.
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

  // ---- Progressive command steps ----
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

  // ---- Context-aware banner: detect existing data on load ----
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
        /* best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, [connection]);

  // ---- Ingestion verification with auto-polling ----
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

  // Auto-start polling when API key is generated or command is copied
  const hasTriggeredPolling = useRef(false);
  useEffect(() => {
    if (hasTriggeredPolling.current) return;
    if (apiKeyValue && verifyStatus === "idle") {
      hasTriggeredPolling.current = true;
      startPolling();
    }
  }, [apiKeyValue, verifyStatus, startPolling]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Add Data"
          description="Set up the EDOT Collector (Elastic Distribution of OpenTelemetry Collector) to send logs, metrics, and traces to your Elasticsearch cluster."
          actions={
            clusterVersion ? (
              <Chip label={`EDOT Collector v${clusterVersion}`} size="small" variant="outlined" />
            ) : undefined
          }
        />
      </Paper>

      {/* Context-aware banner: existing data detected */}
      {existingSignals && existingSignals.size > 0 && (
        <Alert severity="info">
          You already have {Array.from(existingSignals).sort().join(", ")} data.{" "}
          {Array.from(existingSignals)
            .sort()
            .map((s) => (
              <Link
                key={s}
                component="button"
                variant="body2"
                onClick={() => navigate(SIGNAL_NAV[s].path)}
                sx={{ mx: 0.5 }}
              >
                {SIGNAL_NAV[s].label}
              </Link>
            ))}
          — Add more sources below.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1.5 }}>
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
            severity={ingestAvailable ? "success" : ingestAvailable === false ? "warning" : "info"}
          >
            {ingestAvailable === null
              ? `Checking OTLP endpoint availability at ${probeTargetOtlpUrl}…`
              : ingestAvailable
                ? `OTLP endpoint verified at ${probeTargetOtlpUrl}`
                : `Could not reach OTLP endpoint at ${probeTargetOtlpUrl} — verify the URL is correct`}
          </Alert>
        )}
        {endpointType === "managed_otlp" && !probeTargetOtlpUrl && (
          <Alert severity="info">
            Enter your managed OTLP endpoint. For Elastic Cloud, it follows the pattern
            https://&lt;id&gt;.ingest.&lt;region&gt;.&lt;provider&gt;.elastic.cloud
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

          {/* Progressive command steps */}
          {commandSteps.length > 0 ? (
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
                      bgcolor: "background.default",
                      borderRadius: 1,
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                      m: 0,
                      overflow: "auto",
                      p: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {step.command}
                  </Box>
                </Paper>
              ))}
            </Stack>
          ) : (
            <TextField
              label="Starter command"
              value={fullCommand}
              multiline
              minRows={7}
              fullWidth
              slotProps={{
                input: { readOnly: true, sx: { fontFamily: "monospace", fontSize: "0.8rem" } },
                inputLabel: { sx: { color: "text.primary" } },
              }}
            />
          )}

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
      </Paper>

      <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1.5 }}>
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
            Your credentials do not include API key creation privileges. Generate a key manually via{" "}
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
      </Paper>

      <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1.5 }}>
        <Typography variant="body2">Verify ingestion</Typography>
        <Typography variant="body2" color="text.secondary">
          After starting the collector, check whether telemetry data streams have appeared.
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
            {verifyStatus === "checking" || verifyStatus === "polling" ? "Checking…" : "Check now"}
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
            Telemetry data detected! Found data in: {Array.from(foundSignals).sort().join(", ")}.
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              {SIGNAL_PREFIXES.filter((s) => foundSignals.has(s)).map((s) => (
                <Button
                  key={s}
                  size="small"
                  variant="outlined"
                  onClick={() => navigate(SIGNAL_NAV[s].path)}
                >
                  Go to {SIGNAL_NAV[s].label}
                </Button>
              ))}
            </Stack>
          </Alert>
        )}
      </Paper>
    </Box>
  );
}
