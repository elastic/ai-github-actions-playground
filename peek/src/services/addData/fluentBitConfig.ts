/**
 * Fluent Bit output configuration templates.
 * Supports direct Elasticsearch output and OTLP output mode.
 */
export type FluentBitOutputMode = "elasticsearch" | "otlp";

export interface FluentBitOutputConfig {
  readonly mode: FluentBitOutputMode;
  readonly label: string;
  readonly description: string;
}

export const FLUENT_BIT_OUTPUT_CONFIGS: readonly FluentBitOutputConfig[] = [
  {
    mode: "elasticsearch",
    label: "Direct to Elasticsearch",
    description: "Send logs directly to Elasticsearch using the es output plugin.",
  },
  {
    mode: "otlp",
    label: "Via OTLP",
    description: "Send logs via OpenTelemetry Protocol to an OTLP endpoint.",
  },
];

/**
 * Generate a Fluent Bit configuration file based on output mode.
 */
export function generateFluentBitConfig(opts: {
  outputMode: FluentBitOutputMode;
  esUrl: string;
  apiKey: string;
}): string {
  const input = `[INPUT]
    Name              tail
    Path              /var/log/*.log
    Tag               host.logs
    Refresh_Interval  5
    Read_from_Head    True`;

  const parsed = new URL(opts.esUrl);
  const isHttps = parsed.protocol === "https:";
  const host = parsed.hostname;
  const port = parsed.port || (isHttps ? "443" : "80");
  const tls = isHttps ? "On" : "Off";

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
 * Generate Fluent Bit install commands for common platforms.
 */
export function generateFluentBitInstallCommand(): string {
  return `# 1. Install Fluent Bit
curl -fsSL -o /tmp/fluent-bit-install.sh https://raw.githubusercontent.com/fluent/fluent-bit/master/install.sh
# Review the script before running it.
cat /tmp/fluent-bit-install.sh
sh /tmp/fluent-bit-install.sh

# 2. Save the configuration above as /etc/fluent-bit/fluent-bit.conf

# 3. Start Fluent Bit
sudo systemctl start fluent-bit`;
}
