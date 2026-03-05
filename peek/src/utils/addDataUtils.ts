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
    await fetch(otlpUrl, {
      method: "HEAD",
      mode: "no-cors",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return true;
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

/** For host onboarding (Linux/Windows/macOS), we care about hostmetricsreceiver streams. */
export const HOST_METRICS_INDEX_PATTERN = "metrics-hostmetricsreceiver*";

/**
 * Index pattern for a signal type. For host onboarding, metrics uses hostmetricsreceiver streams.
 */
export function getIngestionIndexPattern(
  signalType: TelemetrySignal,
  hostOnboarding: boolean,
): string {
  if (signalType === "metrics" && hostOnboarding) {
    return HOST_METRICS_INDEX_PATTERN;
  }
  return `${signalType}-*`;
}

/**
 * Detect which telemetry signals have data streams present in the cluster.
 * Returns the set of signal types whose data streams exist.
 * @param hostOnboarding - When true (Linux/Windows/macOS hosts), "metrics" requires metrics-hostmetricsreceiver* streams.
 */
export async function detectTelemetrySignals(
  client: ElasticsearchClient,
  signal?: AbortSignal,
  hostOnboarding = false,
): Promise<Set<TelemetrySignal>> {
  const res = await client.getDataStreams(undefined, signal);
  const found = new Set<TelemetrySignal>();
  for (const ds of res.data_streams ?? []) {
    for (const prefix of SIGNAL_PREFIXES) {
      const matches =
        prefix === "metrics" && hostOnboarding
          ? ds.name.startsWith("metrics-hostmetricsreceiver")
          : ds.name.startsWith(`${prefix}-`);
      if (matches) {
        found.add(prefix);
        break;
      }
    }
  }
  return found;
}

export interface AddDataSuccessCta {
  id: string;
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
export type HostRunMode = "run_once" | "systemd" | "shell_profile";
export type LinuxPackageFormat = "deb" | "rpm" | "auto";

/** Flattened Linux install choice: Run once | Install on Debian/Ubuntu | Install on Red Hat/CentOS. */
export type LinuxInstallChoice = "run_once" | "deb" | "rpm";

export function linuxChoiceToContext(choice: LinuxInstallChoice): {
  runMode: HostRunMode;
  linuxPackageFormat: LinuxPackageFormat;
} {
  if (choice === "run_once") return { runMode: "run_once", linuxPackageFormat: "auto" };
  return { runMode: "systemd", linuxPackageFormat: choice };
}

const ARTIFACTS_BASE = "https://artifacts.elastic.co/downloads/beats/elastic-agent";

export interface CommandContext {
  esUrl: string;
  version: string;
  apiKey: string;
  endpointType: EndpointType;
  otlpUrl: string;
  runMode?: HostRunMode;
  linuxPackageFormat?: LinuxPackageFormat;
}

export interface PlatformGuide {
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
    command: ({ esUrl, version, apiKey, endpointType, otlpUrl, linuxPackageFormat = "deb" }) => {
      const isOtlp = endpointType === "managed_otlp";
      const sampleConfig = isOtlp
        ? "otel_samples/managed_otlp/platformlogs_hostmetrics.yml"
        : "otel_samples/platformlogs_hostmetrics.yml";
      const envLines = isOtlp
        ? `ELASTIC_OTLP_ENDPOINT="${otlpUrl}"
ELASTIC_API_KEY="${apiKey}"`
        : `ELASTIC_ENDPOINT="${esUrl}"
ELASTIC_API_KEY="${apiKey}"`;

      // Run once: use generic tar.gz (no package manager)
      if (linuxPackageFormat === "auto") {
        const runOnceCredentialLines = isOtlp
          ? `export ELASTIC_OTLP_ENDPOINT="${otlpUrl}"
export ELASTIC_API_KEY="${apiKey}"`
          : `export ELASTIC_ENDPOINT="${esUrl}"
export ELASTIC_API_KEY="${apiKey}"`;
        return `# 1. Detect architecture, then download and extract the EDOT Collector (generic tar.gz)
AGENT_ARCH="$(uname -m | sed -E 's/^(x86_64|amd64)$/x86_64/; s/^(aarch64|arm64)$/arm64/')"
curl -L -O ${ARTIFACTS_BASE}/elastic-agent-${version}-linux-\${AGENT_ARCH}.tar.gz
tar xzvf elastic-agent-${version}-linux-\${AGENT_ARCH}.tar.gz
cd elastic-agent-${version}-linux-\${AGENT_ARCH}

# 2. Set your credentials
${runOnceCredentialLines}
export STORAGE_DIR="$(pwd)/data/otel"
mkdir -p "$STORAGE_DIR"
cp ${sampleConfig} otel.yml

# 3. Start the EDOT Collector
sudo -E ./elastic-agent otel --config otel.yml`;
      }

      // deb/rpm: package manager install with systemd
      const packageExt = linuxPackageFormat === "rpm" ? "rpm" : "deb";
      const installSnippet =
        linuxPackageFormat === "rpm" ? 'sudo rpm -Uvh "$PKG_FILE"' : 'sudo dpkg -i "$PKG_FILE"';
      const runModeCredentials = `sudo install -d -m 0755 /etc/elastic
cat <<EOF | sudo tee /etc/elastic/elastic-agent-otel.env > /dev/null
${envLines}
STORAGE_DIR="$AGENT_DIR/data/otel"
EOF`;
      const runModeStart = `cat <<EOF | sudo tee /etc/systemd/system/elastic-agent-otel.service > /dev/null
[Unit]
Description=Elastic EDOT Collector
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/elastic/elastic-agent-otel.env
WorkingDirectory=$AGENT_DIR
ExecStart=$AGENT_DIR/elastic-agent otel --config $AGENT_DIR/otel.yml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now elastic-agent-otel.service`;
      return `# 1. Detect architecture, then install the EDOT Collector package
AGENT_ARCH="$(uname -m | sed -E 's/^(x86_64|amd64)$/x86_64/; s/^(aarch64|arm64)$/arm64/')"
AGENT_DIR="/opt/Elastic/Agent"
PKG_FILE="elastic-agent-${version}-linux-\${AGENT_ARCH}.${packageExt}"
curl -L -O ${ARTIFACTS_BASE}/\${PKG_FILE}
${installSnippet}
sudo cp "$AGENT_DIR/${sampleConfig}" "$AGENT_DIR/otel.yml"

# 2. Set your credentials
${runModeCredentials}
sudo mkdir -p "$AGENT_DIR/data/otel"

# 3. Start the EDOT Collector
${runModeStart}`;
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
      return `# 1. Detect architecture, then download and extract the EDOT Collector
AGENT_ARCH="$(uname -m | sed -E 's/^arm64$/aarch64/; s/^x86_64$/x86_64/')"
curl -L -O ${ARTIFACTS_BASE}/elastic-agent-${version}-darwin-\${AGENT_ARCH}.tar.gz
tar xzvf elastic-agent-${version}-darwin-\${AGENT_ARCH}.tar.gz
cd elastic-agent-${version}-darwin-\${AGENT_ARCH}

# 2. Set your credentials
${credentialLines}
export STORAGE_DIR="$(pwd)/data/otel"
mkdir -p "$STORAGE_DIR"

# 3. Start the EDOT Collector
sudo -E ./elastic-agent otel --config otel.yml`;
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
      return `# 1. Detect architecture and download the EDOT Collector
$agentArch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x86_64" }
# Download from: ${ARTIFACTS_BASE}/elastic-agent-${version}-windows-$agentArch.zip
# Or use PowerShell:
Invoke-WebRequest -Uri "${ARTIFACTS_BASE}/elastic-agent-${version}-windows-$agentArch.zip" -OutFile elastic-agent.zip
Expand-Archive -Path elastic-agent.zip -DestinationPath .
cd elastic-agent-${version}-windows-$agentArch

# 2. Set your credentials
${credentialLines}
$env:STORAGE_DIR = "$PWD\\data\\otel"
New-Item -ItemType Directory -Path $env:STORAGE_DIR -Force | Out-Null

# 3. Start the EDOT Collector
.\\elastic-agent.exe otel --config otel.yml`;
    },
  },
};
