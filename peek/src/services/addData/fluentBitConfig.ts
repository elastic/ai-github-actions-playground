/**
 * Third-party shipper configuration templates.
 * Supports direct Elasticsearch output and (where available) OTLP output mode.
 */
export type FluentBitOutputMode = "elasticsearch" | "otlp";
export type ThirdPartyCollectorId = "fluent-bit" | "vector" | "fluentd" | "filebeat" | "logstash";

export interface FluentBitOutputConfig {
  readonly mode: FluentBitOutputMode;
  readonly label: string;
  readonly description: string;
}

const OUTPUT_CONFIGS_ALL: readonly FluentBitOutputConfig[] = [
  {
    mode: "elasticsearch",
    label: "Direct to Elasticsearch",
    description: "Send logs directly to Elasticsearch.",
  },
  {
    mode: "otlp",
    label: "Via OTLP",
    description: "Send logs via OpenTelemetry Protocol to an OTLP endpoint.",
  },
];

const OUTPUT_CONFIGS_ES_ONLY: readonly FluentBitOutputConfig[] = [OUTPUT_CONFIGS_ALL[0]!];

export function isThirdPartyCollectorId(id: string | undefined): id is ThirdPartyCollectorId {
  return (
    id === "fluent-bit" ||
    id === "vector" ||
    id === "fluentd" ||
    id === "filebeat" ||
    id === "logstash"
  );
}

export function getCollectorOutputConfigs(
  collectorId: ThirdPartyCollectorId,
): readonly FluentBitOutputConfig[] {
  if (collectorId === "fluent-bit" || collectorId === "vector") return OUTPUT_CONFIGS_ALL;
  return OUTPUT_CONFIGS_ES_ONLY;
}

/**
 * Generate a collector configuration file based on output mode.
 */
export function generateFluentBitConfig(opts: {
  collectorId?: ThirdPartyCollectorId;
  outputMode: FluentBitOutputMode;
  esUrl: string;
  otlpUrl?: string;
  apiKey: string;
}): string {
  const collectorId = opts.collectorId ?? "fluent-bit";
  const input = `[INPUT]
    Name              tail
    Path              /var/log/*.log
    Tag               host.logs
    Refresh_Interval  5
    Read_from_Head    True`;

  const normalizedOtlpUrl = opts.otlpUrl?.trim();
  const destinationUrl =
    opts.outputMode === "otlp" && normalizedOtlpUrl?.match(/^https?:\/\//)
      ? normalizedOtlpUrl
      : opts.esUrl;
  const parsed = new URL(destinationUrl);
  const isHttps = parsed.protocol === "https:";
  const host = parsed.hostname;
  const port = parsed.port || (isHttps ? "443" : "80");
  const tls = isHttps ? "On" : "Off";

  if (collectorId === "vector") {
    if (opts.outputMode === "otlp") {
      return `[sources.host_logs]
type = "file"
include = ["/var/log/*.log"]

[sinks.elastic_otlp]
type = "opentelemetry"
inputs = ["host_logs"]
endpoint = "${parsed.origin}"

[sinks.elastic_otlp.request.headers]
Authorization = "ApiKey ${opts.apiKey}"
`;
    }
    return `[sources.host_logs]
type = "file"
include = ["/var/log/*.log"]

[sinks.elastic_es]
type = "elasticsearch"
inputs = ["host_logs"]
endpoints = ["${parsed.origin}"]
mode = "bulk"

[sinks.elastic_es.request.headers]
Authorization = "ApiKey ${opts.apiKey}"
`;
  }

  if (collectorId === "fluentd") {
    return `<source>
  @type tail
  path /var/log/*.log
  pos_file /var/log/td-agent.log.pos
  tag host.logs
  <parse>
    @type none
  </parse>
</source>

<match host.logs>
  @type elasticsearch
  host ${host}
  port ${port}
  scheme ${isHttps ? "https" : "http"}
  path ""
  api_key ${opts.apiKey}
  index_name fluentd-logs
</match>
`;
  }

  if (collectorId === "filebeat") {
    return `filebeat.inputs:
  - type: filestream
    id: host-logs
    paths:
      - /var/log/*.log

output.elasticsearch:
  hosts: ["${parsed.origin}"]
  api_key: "${opts.apiKey}"
`;
  }

  if (collectorId === "logstash") {
    return `input {
  file {
    path => "/var/log/*.log"
    start_position => "beginning"
    sincedb_path => "/dev/null"
  }
}

output {
  elasticsearch {
    hosts => ["${parsed.origin}"]
    api_key => "${opts.apiKey}"
    index => "logstash-logs"
  }
}
`;
  }

  if (opts.outputMode === "otlp") {
    return `${input}

[OUTPUT]
    Name              opentelemetry
    Match             *
    Host              ${host}
    Port              ${port}
    Tls               ${tls}
    Header            Authorization ApiKey ${opts.apiKey}
`;
  }

  return `${input}

[OUTPUT]
    Name              es
    Match             *
    Host              ${host}
    Port              ${port}
    Tls               ${tls}
    HTTP_API_Key      ${opts.apiKey}
    Index             fluent-bit-logs
    Suppress_Type_Name On
`;
}

/**
 * Generate collector install commands for common platforms.
 */
export function generateFluentBitInstallCommand(
  collectorId: ThirdPartyCollectorId = "fluent-bit",
): string {
  if (collectorId === "vector") {
    return `echo "Step 1: Install Vector"
curl -1sLf 'https://repositories.timber.io/public/vector/cfg/setup/bash.deb.sh' | sudo -E bash
sudo apt-get update && sudo apt-get install -y vector

echo "Step 2: Save the configuration above as /etc/vector/vector.toml"

echo "Step 3: Start Vector"
sudo systemctl enable --now vector`;
  }

  if (collectorId === "fluentd") {
    return `echo "Step 1: Install Fluentd (td-agent)"
curl -L https://toolbelt.treasuredata.com/sh/install-ubuntu-jammy-td-agent4.sh | sh

echo "Step 2: Save the configuration above as /etc/td-agent/td-agent.conf"

echo "Step 3: Start Fluentd"
sudo systemctl enable --now td-agent`;
  }

  if (collectorId === "filebeat") {
    return `echo "Step 1: Install Filebeat"
curl -L -O https://artifacts.elastic.co/downloads/beats/filebeat/filebeat-8.17.0-amd64.deb
sudo dpkg -i filebeat-8.17.0-amd64.deb

echo "Step 2: Save the configuration above as /etc/filebeat/filebeat.yml"

echo "Step 3: Start Filebeat"
sudo systemctl enable --now filebeat`;
  }

  if (collectorId === "logstash") {
    return `echo "Step 1: Install Logstash"
curl -L -O https://artifacts.elastic.co/downloads/logstash/logstash-8.17.0-amd64.deb
sudo dpkg -i logstash-8.17.0-amd64.deb

echo "Step 2: Save the configuration above as /etc/logstash/conf.d/elastic-output.conf"

echo "Step 3: Start Logstash"
sudo systemctl enable --now logstash`;
  }

  return `echo "Step 1: Install Fluent Bit"
install_script="$(mktemp -t fluent-bit-install.XXXXXX.sh)"
trap 'rm -f "$install_script"' EXIT
curl -fsSL -o "$install_script" https://raw.githubusercontent.com/fluent/fluent-bit/master/install.sh
echo "Reviewing installer script before execution"
cat "$install_script"
printf "Press Enter to proceed with installation, or Ctrl+C to abort..."
read -r _
sh "$install_script"

echo "Step 2: Save the configuration above as /etc/fluent-bit/fluent-bit.conf"

echo "Step 3: Start Fluent Bit"
sudo systemctl start fluent-bit`;
}
