import { useCallback, useEffect, useMemo, useState } from "react";
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
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { copyToClipboard } from "../utils/copyToClipboard";

// ---------------------------------------------------------------------------
// Platform definitions
// ---------------------------------------------------------------------------

type Platform = "kubernetes" | "docker" | "linux" | "macos" | "windows";

const ARTIFACTS_BASE = "https://artifacts.elastic.co/downloads/beats/elastic-agent";

interface PlatformGuide {
  label: string;
  quickstartUrl: string;
  command: (ctx: { esUrl: string; version: string; apiKey: string }) => string;
}

const PLATFORM_GUIDES: Record<Platform, PlatformGuide> = {
  kubernetes: {
    label: "Kubernetes",
    quickstartUrl:
      "https://www.elastic.co/docs/solutions/observability/get-started/opentelemetry/quickstart/self-managed/k8s",
    command: ({ esUrl, version, apiKey }) => `# 1. Add the OpenTelemetry Helm repository
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
  --version '0.12.4'`,
  },
  docker: {
    label: "Docker",
    quickstartUrl:
      "https://www.elastic.co/docs/solutions/observability/get-started/opentelemetry/quickstart/self-managed/docker",
    command: ({
      esUrl,
      version,
      apiKey,
    }) => `# 1. Create an otel-collector-config.yml (see official docs for full reference)
# 2. Create a .env file
cat > .env << 'DOTENV'
HOST_FILESYSTEM=/
DOCKER_SOCK=/var/run/docker.sock
ELASTIC_AGENT_OTEL=true
COLLECTOR_CONTRIB_IMAGE=elastic/elastic-agent:${version}
ELASTIC_API_KEY=${apiKey}
ELASTIC_ENDPOINT=${esUrl}
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
      - ELASTIC_API_KEY
      - ELASTIC_ENDPOINT
      - STORAGE_DIR=/usr/share/elastic-agent
COMPOSE

# 4. Start the collector
docker compose up -d`,
  },
  linux: {
    label: "Linux",
    quickstartUrl:
      "https://www.elastic.co/docs/solutions/observability/get-started/quickstart-monitor-hosts-with-opentelemetry",
    command: ({ esUrl, version, apiKey }) => `# 1. Download and extract the EDOT Collector
curl -L -O ${ARTIFACTS_BASE}/elastic-agent-${version}-linux-x86_64.tar.gz
tar xzvf elastic-agent-${version}-linux-x86_64.tar.gz
cd elastic-agent-${version}-linux-x86_64

# 2. Set your credentials
export ELASTIC_ENDPOINT="${esUrl}"
export ELASTIC_API_KEY="${apiKey}"
export STORAGE_DIR="$(pwd)/data/otel"

# 3. Start the EDOT Collector
sudo -E ./otelcol --config otel.yml`,
  },
  macos: {
    label: "macOS",
    quickstartUrl:
      "https://www.elastic.co/docs/solutions/observability/get-started/quickstart-monitor-hosts-with-opentelemetry",
    command: ({ esUrl, version, apiKey }) => `# 1. Download and extract the EDOT Collector
# For Apple Silicon (M1/M2/M3/M4):
curl -L -O ${ARTIFACTS_BASE}/elastic-agent-${version}-darwin-aarch64.tar.gz
tar xzvf elastic-agent-${version}-darwin-aarch64.tar.gz
cd elastic-agent-${version}-darwin-aarch64

# For Intel Macs, replace aarch64 with x86_64 above

# 2. Set your credentials
export ELASTIC_ENDPOINT="${esUrl}"
export ELASTIC_API_KEY="${apiKey}"
export STORAGE_DIR="$(pwd)/data/otel"

# 3. Start the EDOT Collector
sudo -E ./otelcol --config otel.yml`,
  },
  windows: {
    label: "Windows",
    quickstartUrl:
      "https://www.elastic.co/docs/solutions/observability/get-started/quickstart-monitor-hosts-with-opentelemetry",
    command: ({ esUrl, version, apiKey }) => `# 1. Download the EDOT Collector
# Download from: ${ARTIFACTS_BASE}/elastic-agent-${version}-windows-x86_64.zip
# Or use PowerShell:
Invoke-WebRequest -Uri "${ARTIFACTS_BASE}/elastic-agent-${version}-windows-x86_64.zip" -OutFile elastic-agent.zip
Expand-Archive -Path elastic-agent.zip -DestinationPath .
cd elastic-agent-${version}-windows-x86_64

# 2. Set your credentials
$env:ELASTIC_ENDPOINT = "${esUrl}"
$env:ELASTIC_API_KEY = "${apiKey}"
$env:STORAGE_DIR = "$PWD\\data\\otel"

# 3. Start the EDOT Collector
.\\otelcol.exe --config otel.yml`,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AddDataPage() {
  const connection = useConnectionStore((s) => s.connection);
  const capabilities = useConnectionStore((s) => s.capabilities);
  const [platform, setPlatform] = useState<Platform>("kubernetes");
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [clusterVersion, setClusterVersion] = useState<string | null>(null);

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
  const version = clusterVersion ?? "<VERSION>";
  const apiKey = apiKeyValue ?? "<YOUR_API_KEY>";
  const activeGuide = useMemo(() => PLATFORM_GUIDES[platform], [platform]);

  const handleCreateApiKey = useCallback(async () => {
    if (!connection) return;
    setCreatingApiKey(true);
    setApiKeyError(null);
    setApiKeyValue(null);
    try {
      const client = new ElasticsearchClient(connection);
      const response = await client.createApiKey({
        name: `peek-edot-${Date.now()}`,
        metadata: { managed_by: "elastic-peek", purpose: "edot-onboarding" },
      });
      setApiKeyValue(response.encodedApiKey);
    } catch (err) {
      setApiKeyError(isElasticsearchError(err) ? err.message : String(err));
    } finally {
      setCreatingApiKey(false);
    }
  }, [connection]);

  const handleCopyApiKey = useCallback(async () => {
    if (!apiKeyValue) return;
    const ok = await copyToClipboard(apiKeyValue);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [apiKeyValue]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minHeight: 0, height: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6">Add Data</Typography>
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
          value={activeGuide.command({ esUrl, version, apiKey })}
          multiline
          minRows={7}
          fullWidth
          slotProps={{
            input: { readOnly: true, sx: { fontFamily: "monospace", fontSize: "0.8rem" } },
          }}
        />
        <Alert severity="info">
          {apiKeyValue
            ? "Your generated API key, "
            : "Generate an API key below (or provide your own) — "}
          {connection?.url ? "Elasticsearch endpoint, " : ""}
          {clusterVersion ? `and EDOT Collector v${clusterVersion} ` : ""}
          {apiKeyValue || connection?.url || clusterVersion
            ? "have been pre-filled in the command above."
            : "Replace the placeholders before running."}
          {!apiKeyValue && (
            <>
              {" "}
              Replace <code>&lt;YOUR_API_KEY&gt;</code> with a generated or existing key.
            </>
          )}
        </Alert>
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
                onClick={() => void handleCreateApiKey()}
                disabled={creatingApiKey}
              >
                {creatingApiKey ? <CircularProgress size={16} /> : "Generate API key"}
              </Button>
              <Typography variant="body2" color="text.secondary">
                Generates a one-time API key for collector setup.
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
    </Box>
  );
}
