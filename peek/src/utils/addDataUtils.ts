import type { ElasticsearchClient } from "../services/es";

// ---------------------------------------------------------------------------
// Endpoint type helpers
// ---------------------------------------------------------------------------

export type EndpointType = "elasticsearch" | "managed_otlp";

/**
 * Attempt to derive the managed OTLP ingest endpoint from an Elasticsearch (or Kibana) URL.
 *
 * Supported patterns:
 * - `<id>.es.<region>.<provider>.elastic.cloud`  → `<id>.ingest.<region>.<provider>.elastic.cloud`
 * - `<id>.es.<region>.<provider>.cloud.es.io`    → `<id>.ingest.<region>.<provider>.cloud.es.io`
 * - `<id>.kb.<region>.<provider>.cloud.es.io`    → `<id>.ingest.<region>.<provider>.cloud.es.io`
 *
 * Returns `null` when the URL does not match any known Elastic Cloud pattern.
 */
export function deriveOtlpEndpoint(esUrl: string): string | null {
  try {
    const url = new URL(esUrl);
    const parts = url.hostname.split(".");
    const isElasticCloud =
      url.hostname.endsWith(".elastic.cloud") && parts.length >= 3 && parts[1] === "es";
    const isCloudEsIo =
      url.hostname.endsWith(".cloud.es.io") &&
      parts.length >= 3 &&
      (parts[1] === "es" || parts[1] === "kb");
    if (isElasticCloud || isCloudEsIo) {
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
 * Return candidate ingest URLs for the given connection URL.
 * For `.cloud.es.io` URLs an additional `.elastic-cloud.com` variant is
 * included so the caller can probe both and use whichever responds.
 */
export function deriveIngestCandidates(esUrl: string): string[] {
  const primary = deriveOtlpEndpoint(esUrl);
  if (!primary) return [];
  const candidates = [primary];
  try {
    const url = new URL(primary);
    if (url.hostname.endsWith(".cloud.es.io")) {
      const alt = new URL(primary);
      // Replace trailing .cloud.es.io with .elastic-cloud.com
      alt.hostname = alt.hostname.replace(/\.cloud\.es\.io$/, ".elastic-cloud.com");
      candidates.push(alt.toString().replace(/\/+$/, ""));
    }
  } catch {
    /* ignore */
  }
  return candidates;
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

export interface AddDataSuccessCta {
  id: "signal" | "dashboard" | "alerting" | "additional_source";
  label: string;
  path: string;
}

export const SIGNAL_NAV: Record<
  TelemetrySignal,
  { label: string; path: string; successCtas: AddDataSuccessCta[] }
> = {
  metrics: {
    label: "Metrics",
    path: "/explore",
    successCtas: [
      { id: "signal", label: "Open Metrics", path: "/explore" },
      { id: "dashboard", label: "Open Dashboards", path: "/dashboards" },
      { id: "alerting", label: "Set up alerting", path: "/docs" },
      { id: "additional_source", label: "Add another source", path: "/add-data" },
    ],
  },
  traces: {
    label: "Traces",
    path: "/traces",
    successCtas: [
      { id: "signal", label: "Open Traces", path: "/traces" },
      { id: "dashboard", label: "Open Dashboards", path: "/dashboards" },
      { id: "alerting", label: "Set up alerting", path: "/docs" },
      { id: "additional_source", label: "Add another source", path: "/add-data" },
    ],
  },
  logs: {
    label: "Logs",
    path: "/logs",
    successCtas: [
      { id: "signal", label: "Open Logs", path: "/logs" },
      { id: "dashboard", label: "Open Dashboards", path: "/dashboards" },
      { id: "alerting", label: "Set up alerting", path: "/docs" },
      { id: "additional_source", label: "Add another source", path: "/add-data" },
    ],
  },
};

// ---------------------------------------------------------------------------
// Command step parsing
// ---------------------------------------------------------------------------

export interface CommandStep {
  /** Step number (1-based). */
  number: number;
  /** The comment title text (without the leading `# N. `). */
  title: string;
  /** The command text that follows the comment line. */
  command: string;
}

/**
 * Split a multi-step command string into discrete steps.
 *
 * Each step is identified by a comment line matching the pattern `# N. <title>`
 * where `N` is a positive integer.  All lines between two step markers (or
 * between the last marker and end-of-string) are joined to form the step's
 * command text.  Leading non-step preamble lines (e.g. notes about managed OTLP)
 * are prepended to the first step's command.
 *
 * Returns an empty array when the command contains no step markers.
 */
export function parseCommandSteps(command: string): CommandStep[] {
  const lines = command.split("\n");
  const stepPattern = /^#\s*(\d+)\.\s*(.*)$/;
  const steps: CommandStep[] = [];
  const preambleLines: string[] = [];

  for (const line of lines) {
    const match = stepPattern.exec(line);
    if (match) {
      steps.push({ number: parseInt(match[1]!, 10), title: match[2]!.trim(), command: "" });
    } else if (steps.length === 0) {
      preambleLines.push(line);
    } else {
      const last = steps[steps.length - 1]!;
      last.command += (last.command ? "\n" : "") + line;
    }
  }

  // Prepend any preamble lines to the first step
  if (preambleLines.length > 0 && steps.length > 0) {
    const preamble = preambleLines.join("\n").trim();
    if (preamble) {
      steps[0]!.command = steps[0]!.command ? preamble + "\n" + steps[0]!.command : preamble;
    }
  }

  // Trim trailing whitespace from each command
  for (const step of steps) {
    step.command = step.command.trim();
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Platform definitions
// ---------------------------------------------------------------------------

export type Platform = "kubernetes" | "docker" | "linux" | "macos" | "windows";

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

export const PLATFORM_GUIDES: Record<Platform, PlatformGuide> = {
  kubernetes: {
    label: "Kubernetes",
    quickstartUrl:
      "https://www.elastic.co/docs/solutions/observability/get-started/opentelemetry/quickstart/self-managed/k8s",
    command: ({ esUrl, version, apiKey, endpointType }) => {
      const managedOtlpNotice =
        endpointType === "managed_otlp"
          ? `# Note: Kubernetes quickstart currently supports Elasticsearch output only.\n# Managed OTLP endpoint mode is available for Docker, Linux, macOS, and Windows.\n\n`
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
