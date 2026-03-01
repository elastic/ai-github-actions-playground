import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
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

import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { copyToClipboard } from "../utils/copyToClipboard";
import { useAddDataApiKey } from "../hooks/useAddDataApiKey";

// ---------------------------------------------------------------------------
// Endpoint type helpers
// ---------------------------------------------------------------------------

export type EndpointType = "elasticsearch" | "managed_otlp";

/**
 * Attempt to derive the managed OTLP ingest endpoint from an Elasticsearch URL.
 * Elastic Cloud URLs follow the pattern `<id>.es.<region>.<provider>.elastic.cloud`;
 * replacing the `.es.` segment with `.ingest.` yields the OTLP endpoint.
 * Returns `null` when the URL does not match the Elastic Cloud pattern.
 */
export function deriveOtlpEndpoint(esUrl: string): string | null {
  try {
    const url = new URL(esUrl);
    const parts = url.hostname.split(".");
    if (url.hostname.endsWith(".elastic.cloud") && parts.length >= 3 && parts[1] === "es") {
      parts[1] = "ingest";
      url.hostname = parts.join(".");
      return url.toString().replace(/\/+$/, "");
    }
  } catch {
    /* invalid URL — fall through */
  }
  return null;
}

/**
 * Probe the derived OTLP ingest endpoint to check if it is reachable.
 * Uses `mode: "no-cors"` so the browser won't block on missing CORS headers —
 * if the host exists the fetch resolves (with an opaque response); if DNS or
 * the host is unreachable the fetch rejects.  This means the probe only checks
 * network-level reachability and cannot inspect the HTTP status code.
 */
export async function probeOtlpEndpoint(otlpUrl: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetch(otlpUrl, { method: "HEAD", mode: "no-cors", signal: controller.signal });
      return true;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Ingestion verification helpers
// ---------------------------------------------------------------------------

/** Telemetry signal types that the verification check looks for. */
export type TelemetrySignal = "logs" | "metrics" | "traces";

const SIGNAL_PREFIXES: TelemetrySignal[] = ["logs", "metrics", "traces"];

/**
 * Detect which telemetry signals have data streams present in the cluster.
 * Returns the set of signal types whose `{signal}-*` data streams exist.
 */
export async function detectTelemetrySignals(
  client: ElasticsearchClient,
  signal?: AbortSignal,
): Promise<Set<TelemetrySignal>> {
  const res = await client.getDataStreams(undefined, signal);
  const found = new Set<TelemetrySignal>();
  for (const ds of res.data_streams ?? []) {
    for (const prefix of SIGNAL_PREFIXES) {
      if (ds.name.startsWith(`${prefix}-`)) {
        found.add(prefix);
        break;
      }
    }
  }
  return found;
}

const SIGNAL_NAV: Record<TelemetrySignal, { label: string; path: string }> = {
  metrics: { label: "Metrics", path: "/explore" },
  traces: { label: "Traces", path: "/traces" },
  logs: { label: "Query Lab", path: "/discover" },
};

// ---------------------------------------------------------------------------
// Platform definitions
// ---------------------------------------------------------------------------

type Platform = "kubernetes" | "docker" | "linux" | "macos" | "windows";

const ARTIFACTS_BASE = "https://artifacts.elastic.co/downloads/beats/elastic-agent";

interface CommandContext {
  esUrl: string;
  version: string;
  apiKey: string;
  endpointType: EndpointType;
  otlpUrl: string;
}

interface PlatformGuide {
  label: string;
  quickstartUrl: string;
  command: (ctx: CommandContext) => string;
}

const PLATFORM_GUIDES: Record<Platform, PlatformGuide> = {
  kubernetes: {
    label: "Kubernetes",
    quickstartUrl:
      "https://www.elastic.co/docs/solutions/observability/get-started/opentelemetry/quickstart/self-managed/k8s",
    command: ({ esUrl, version, apiKey, endpointType }) => {
      const managedOtlpNotice =
        endpointType === "managed_otlp"
          ? "# Note: Kubernetes quickstart currently supports Elasticsearch output only.\n# Managed OTLP endpoint mode is available for Docker, Linux, macOS, and Windows.\n\n"
          : "";
      return `${managedOtlpNotice}# 1. Add the OpenTelemetry Helm repository
helm repo add open-telemetry \\
  'https://open-telemetry.github.io/opentelemetry-helm-charts' --force-update

# 2. Create namespace and secret with your ES credentials
kubectl create namespace opentelemetry-operator-system
kubectl create secret generic elastic-secret-otel \\
  --namespace opentelemetry-operator-system \\
  --from-literal=elastic_endpoint='${esUrl}' \\
  --from-literal=elastic_api_key='${apiKey}'

# 3. Install the OpenTelemetry Kube Stack with EDOT values
helm install opentelemetry-kube-stack open-telemetry/opentelemetry-kube-stack \\
  --namespace opentelemetry-operator-system \\
  --values 'https://raw.githubusercontent.com/elastic/elastic-agent/refs/tags/v${version}/deploy/helm/edot-collector/kube-stack/values.yaml' \\
  --version '0.12.4'`;
    },
  },
  docker: {
    label: "Docker",
    quickstartUrl:
      "https://www.elastic.co/docs/solutions/observability/get-started/opentelemetry/quickstart/self-managed/docker",
    command: ({ esUrl, version, apiKey, endpointType, otlpUrl }) => {
      const isOtlp = endpointType === "managed_otlp";
      const endpoint = isOtlp ? otlpUrl : esUrl;
      const endpointEnvKey = isOtlp ? "OTEL_EXPORTER_OTLP_ENDPOINT" : "ELASTIC_ENDPOINT";
      const authEnv = isOtlp
        ? `OTEL_EXPORTER_OTLP_HEADERS=Authorization=ApiKey ${apiKey}`
        : `ELASTIC_API_KEY=${apiKey}`;
      const composeEnvLines = isOtlp
        ? `      - OTEL_EXPORTER_OTLP_ENDPOINT
      - OTEL_EXPORTER_OTLP_HEADERS`
        : `      - ELASTIC_API_KEY
      - ELASTIC_ENDPOINT`;
      return `# 1. Create an otel-collector-config.yml (see official docs for full reference)
# 2. Create a .env file
cat > .env << 'DOTENV'
HOST_FILESYSTEM=/
DOCKER_SOCK=/var/run/docker.sock
ELASTIC_AGENT_OTEL=true
COLLECTOR_CONTRIB_IMAGE=elastic/elastic-agent:${version}
${authEnv}
${endpointEnvKey}=${endpoint}
OTEL_COLLECTOR_CONFIG=./otel-collector-config.yml
DOTENV

# 3. Create a docker-compose.yml
cat > docker-compose.yml << 'COMPOSE'
services:
  otel-collector:
    image: \${COLLECTOR_CONTRIB_IMAGE}
    container_name: otel-collector
    deploy:
      resources:
        limits:
          memory: 1.5G
    restart: unless-stopped
    command: ["--config", "/etc/otelcol-config.yml"]
    network_mode: host
    user: "0:0"
    volumes:
      - \${HOST_FILESYSTEM}:/hostfs:ro
      - \${DOCKER_SOCK}:/var/run/docker.sock:ro
      - \${OTEL_COLLECTOR_CONFIG}:/etc/otelcol-config.yml
    environment:
      - HOST_FILESYSTEM
      - ELASTIC_AGENT_OTEL
${composeEnvLines}
      - STORAGE_DIR=/usr/share/elastic-agent
COMPOSE

# 4. Start the collector
docker compose up -d`;
    },
  },
  linux: {
    label: "Linux",
    quickstartUrl:
      "https://www.elastic.co/docs/solutions/observability/get-started/quickstart-monitor-hosts-with-opentelemetry",
    command: ({ esUrl, version, apiKey, endpointType, otlpUrl }) => {
      const isOtlp = endpointType === "managed_otlp";
      const credentialLines = isOtlp
        ? `export OTEL_EXPORTER_OTLP_ENDPOINT="${otlpUrl}"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=ApiKey ${apiKey}"`
        : `export ELASTIC_ENDPOINT="${esUrl}"
export ELASTIC_API_KEY="${apiKey}"`;
      return `# 1. Download and extract the EDOT Collector
curl -L -O ${ARTIFACTS_BASE}/elastic-agent-${version}-linux-x86_64.tar.gz
tar xzvf elastic-agent-${version}-linux-x86_64.tar.gz
cd elastic-agent-${version}-linux-x86_64

# 2. Set your credentials
${credentialLines}
export STORAGE_DIR="$(pwd)/data/otel"

# 3. Start the EDOT Collector
sudo -E ./otelcol --config otel.yml`;
    },
  },
  macos: {
    label: "macOS",
    quickstartUrl:
      "https://www.elastic.co/docs/solutions/observability/get-started/quickstart-monitor-hosts-with-opentelemetry",
    command: ({ esUrl, version, apiKey, endpointType, otlpUrl }) => {
      const isOtlp = endpointType === "managed_otlp";
      const credentialLines = isOtlp
        ? `export OTEL_EXPORTER_OTLP_ENDPOINT="${otlpUrl}"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=ApiKey ${apiKey}"`
        : `export ELASTIC_ENDPOINT="${esUrl}"
export ELASTIC_API_KEY="${apiKey}"`;
      return `# 1. Download and extract the EDOT Collector
# For Apple Silicon (M1/M2/M3/M4):
curl -L -O ${ARTIFACTS_BASE}/elastic-agent-${version}-darwin-aarch64.tar.gz
tar xzvf elastic-agent-${version}-darwin-aarch64.tar.gz
cd elastic-agent-${version}-darwin-aarch64

# For Intel Macs, replace aarch64 with x86_64 above

# 2. Set your credentials
${credentialLines}
export STORAGE_DIR="$(pwd)/data/otel"

# 3. Start the EDOT Collector
sudo -E ./otelcol --config otel.yml`;
    },
  },
  windows: {
    label: "Windows",
    quickstartUrl:
      "https://www.elastic.co/docs/solutions/observability/get-started/quickstart-monitor-hosts-with-opentelemetry",
    command: ({ esUrl, version, apiKey, endpointType, otlpUrl }) => {
      const isOtlp = endpointType === "managed_otlp";
      const credentialLines = isOtlp
        ? `$env:OTEL_EXPORTER_OTLP_ENDPOINT = "${otlpUrl}"
$env:OTEL_EXPORTER_OTLP_HEADERS = "Authorization=ApiKey ${apiKey}"`
        : `$env:ELASTIC_ENDPOINT = "${esUrl}"
$env:ELASTIC_API_KEY = "${apiKey}"`;
      return `# 1. Download the EDOT Collector
# Download from: ${ARTIFACTS_BASE}/elastic-agent-${version}-windows-x86_64.zip
# Or use PowerShell:
Invoke-WebRequest -Uri "${ARTIFACTS_BASE}/elastic-agent-${version}-windows-x86_64.zip" -OutFile elastic-agent.zip
Expand-Archive -Path elastic-agent.zip -DestinationPath .
cd elastic-agent-${version}-windows-x86_64

# 2. Set your credentials
${credentialLines}
$env:STORAGE_DIR = "$PWD\\data\\otel"

# 3. Start the EDOT Collector
.\\otelcol.exe --config otel.yml`;
    },
  },
};

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
  const derivedOtlpUrl = useMemo(() => deriveOtlpEndpoint(esUrl), [esUrl]);
  const otlpUrl = derivedOtlpUrl ?? "<YOUR_OTLP_ENDPOINT>";

  // Probe the derived OTLP ingest endpoint; auto-select OTLP when reachable
  useEffect(() => {
    if (!derivedOtlpUrl) {
      setIngestAvailable(null);
      return;
    }
    let cancelled = false;
    endpointTypeManuallySetRef.current = false;
    setIngestAvailable(null);
    probeOtlpEndpoint(derivedOtlpUrl).then((available) => {
      if (cancelled) return;
      setIngestAvailable(available);
      if (available && !endpointTypeManuallySetRef.current) setEndpointType("managed_otlp");
    });
    return () => {
      cancelled = true;
    };
  }, [derivedOtlpUrl]);
  const version = clusterVersion ?? "<VERSION>";
  const apiKey = apiKeyValue ?? "<YOUR_API_KEY>";
  const activeGuide = useMemo(() => PLATFORM_GUIDES[platform], [platform]);

  const handleCopyApiKey = useCallback(async () => {
    if (!apiKeyValue) return;
    const ok = await copyToClipboard(apiKeyValue);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [apiKeyValue]);

  // ---- Ingestion verification ----
  type VerifyStatus = "idle" | "checking" | "found" | "not_found" | "error";
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("idle");
  const [foundSignals, setFoundSignals] = useState<Set<TelemetrySignal>>(new Set());
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const verifyAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      verifyAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    verifyAbortControllerRef.current?.abort();
    verifyAbortControllerRef.current = null;
    setVerifyStatus("idle");
    setFoundSignals(new Set());
    setVerifyError(null);
  }, [connection]);

  const handleVerifyIngestion = useCallback(async () => {
    if (!connection) return;
    verifyAbortControllerRef.current?.abort();
    const controller = new AbortController();
    verifyAbortControllerRef.current = controller;
    setVerifyStatus("checking");
    setVerifyError(null);
    try {
      const client = new ElasticsearchClient(connection);
      const signals = await detectTelemetrySignals(client, controller.signal);
      if (controller.signal.aborted) return;
      setFoundSignals(signals);
      setVerifyStatus(signals.size > 0 ? "found" : "not_found");
    } catch (err) {
      if (controller.signal.aborted) return;
      setVerifyError(isElasticsearchError(err) ? err.message : String(err));
      setVerifyStatus("error");
    } finally {
      if (verifyAbortControllerRef.current === controller) {
        verifyAbortControllerRef.current = null;
      }
    }
  }, [connection]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minHeight: 0, height: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" component="h1">
            Add Data
          </Typography>
          {clusterVersion && (
            <Chip label={`EDOT Collector v${clusterVersion}`} size="small" variant="outlined" />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Set up the EDOT Collector (Elastic Distribution of OpenTelemetry Collector) to send logs,
          metrics, and traces to your Elasticsearch cluster.
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Typography variant="subtitle2">Endpoint type</Typography>
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
        {endpointType === "managed_otlp" && derivedOtlpUrl && (
          <Alert
            severity={ingestAvailable ? "success" : ingestAvailable === false ? "warning" : "info"}
          >
            {ingestAvailable === null
              ? `Checking OTLP endpoint availability at ${derivedOtlpUrl}…`
              : ingestAvailable
                ? `OTLP endpoint verified at ${derivedOtlpUrl}`
                : `Could not reach OTLP endpoint at ${derivedOtlpUrl} — verify the URL is correct`}
          </Alert>
        )}
        {endpointType === "managed_otlp" && !derivedOtlpUrl && (
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
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              {activeGuide.label} quickstart
            </Typography>
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

          <TextField
            label="Starter command"
            value={activeGuide.command({ esUrl, version, apiKey, endpointType, otlpUrl })}
            multiline
            minRows={7}
            fullWidth
            slotProps={{
              input: { readOnly: true, sx: { fontFamily: "monospace", fontSize: "0.8rem" } },
              inputLabel: { sx: { color: "text.primary" } },
            }}
          />
          <Alert severity="info">
            {apiKeyValue
              ? "Your generated API key, "
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
              ? "have been pre-filled in the command above."
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

      <Paper variant="outlined" sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="subtitle2">Collector credentials</Typography>
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
              Create API key API
            </Link>{" "}
            or ask an administrator to provision one for collector onboarding.
          </Alert>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="subtitle2">Verify ingestion</Typography>
        <Typography variant="body2" color="text.secondary">
          After starting the collector, check whether telemetry data streams have appeared.
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="small"
            variant="contained"
            onClick={() => void handleVerifyIngestion()}
            disabled={!connection || verifyStatus === "checking"}
            startIcon={
              verifyStatus === "checking" ? (
                <CircularProgress size={16} />
              ) : (
                <CheckCircleOutlineIcon fontSize="small" />
              )
            }
          >
            {verifyStatus === "checking" ? "Checking…" : "Verify ingestion"}
          </Button>
        </Stack>
        {verifyStatus === "error" && <Alert severity="error">{verifyError}</Alert>}
        {verifyStatus === "not_found" && (
          <Alert severity="info">
            No telemetry data streams found yet. Make sure the collector is running and try again in
            a few moments.{" "}
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
