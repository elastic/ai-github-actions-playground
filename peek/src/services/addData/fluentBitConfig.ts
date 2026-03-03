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

  if (opts.outputMode === "otlp") {
    return `${input}

[OUTPUT]
    Name              opentelemetry
    Match             *
    Host              ${new URL(opts.esUrl).hostname}
    Port              443
    Tls               On
    Header            Authorization Bearer ${opts.apiKey}
`;
  }

  return `${input}

[OUTPUT]
    Name              es
    Match             *
    Host              ${new URL(opts.esUrl).hostname}
    Port              443
    Tls               On
    HTTP_User         elastic
    HTTP_Passwd       ${opts.apiKey}
    Index             fluent-bit-logs
    Suppress_Type_Name On
`;
}

/**
 * Generate Fluent Bit install commands for common platforms.
 */
export function generateFluentBitInstallCommand(): string {
  return `# 1. Install Fluent Bit
curl https://raw.githubusercontent.com/fluent/fluent-bit/master/install.sh | sh

# 2. Save the configuration above as /etc/fluent-bit/fluent-bit.conf

# 3. Start Fluent Bit
sudo systemctl start fluent-bit`;
}
