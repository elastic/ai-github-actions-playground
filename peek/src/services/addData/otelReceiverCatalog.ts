import type { AddDataExpectedSignal } from "./catalog";

/**
 * Field definition for an OTel receiver configuration form.
 * Each field maps to a `{{key}}` placeholder in the receiver's YAML template.
 */
export interface OtelReceiverField {
  readonly key: string;
  readonly label: string;
  readonly defaultValue: string;
  readonly placeholder?: string;
  readonly helpText?: string;
}

/**
 * An OTel receiver definition used by the OTel Receiver guide type.
 * Drives the Step 2 configuration form and Step 3 YAML generation.
 */
export interface OtelReceiverDefinition {
  readonly receiverId: string;
  readonly receiverType: string;
  readonly label: string;
  readonly fields: readonly OtelReceiverField[];
  readonly yamlTemplate: string;
  readonly signals: readonly AddDataExpectedSignal[];
}

/**
 * Interpolate field values into a YAML template.
 * Replaces `{{key}}` placeholders with the corresponding value.
 */
export function interpolateReceiverTemplate(
  template: string,
  values: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/**
 * Build a complete OTel Collector config YAML with the given receiver block,
 * standard processors, and OTLP/Elasticsearch exporter.
 */
export function buildFullOtelConfig(
  receiverBlock: string,
  opts: {
    esUrl: string;
    apiKey: string;
    signals: readonly AddDataExpectedSignal[];
  },
): string {
  const pipelines = opts.signals
    .map(
      (signal) => `    ${signal}:
      receivers: [configured_receiver]
      processors: [batch]
      exporters: [elasticsearch]`,
    )
    .join("\n");

  return `receivers:
${receiverBlock}

processors:
  batch:
    send_batch_size: 1000
    timeout: 5s

exporters:
  elasticsearch:
    endpoints: ["${opts.esUrl}"]
    api_key: "${opts.apiKey}"

service:
  pipelines:
${pipelines}
`;
}

// ---------------------------------------------------------------------------
// Receiver definitions
// ---------------------------------------------------------------------------

export const OTEL_RECEIVER_CATALOG: readonly OtelReceiverDefinition[] = [
  {
    receiverId: "nginx",
    receiverType: "nginx",
    label: "Nginx",
    fields: [
      {
        key: "endpoint",
        label: "Nginx stub_status endpoint",
        defaultValue: "http://localhost:8080/status",
        helpText: "URL of the nginx stub_status module endpoint.",
      },
    ],
    yamlTemplate: `  configured_receiver:
    nginx:
      endpoint: "{{endpoint}}"
      collection_interval: 10s`,
    signals: ["metrics", "logs"],
  },
  {
    receiverId: "postgresql",
    receiverType: "postgresql",
    label: "PostgreSQL",
    fields: [
      {
        key: "endpoint",
        label: "PostgreSQL endpoint",
        defaultValue: "localhost:5432",
        helpText: "host:port of the PostgreSQL server.",
      },
      {
        key: "username",
        label: "Username",
        defaultValue: "postgres",
      },
      {
        key: "password",
        label: "Password",
        defaultValue: "",
        placeholder: "Enter password",
      },
      {
        key: "database",
        label: "Database name",
        defaultValue: "postgres",
      },
    ],
    yamlTemplate: `  configured_receiver:
    postgresql:
      endpoint: "{{endpoint}}"
      username: "{{username}}"
      password: "{{password}}"
      databases:
        - "{{database}}"
      collection_interval: 10s`,
    signals: ["metrics", "logs"],
  },
  {
    receiverId: "redis",
    receiverType: "redis",
    label: "Redis",
    fields: [
      {
        key: "endpoint",
        label: "Redis endpoint",
        defaultValue: "localhost:6379",
        helpText: "host:port of the Redis server.",
      },
      {
        key: "password",
        label: "Password (optional)",
        defaultValue: "",
        placeholder: "Leave empty if no auth",
      },
    ],
    yamlTemplate: `  configured_receiver:
    redis:
      endpoint: "{{endpoint}}"
      password: "{{password}}"
      collection_interval: 10s`,
    signals: ["metrics"],
  },
  {
    receiverId: "mysql",
    receiverType: "mysql",
    label: "MySQL",
    fields: [
      {
        key: "endpoint",
        label: "MySQL endpoint",
        defaultValue: "localhost:3306",
        helpText: "host:port of the MySQL server.",
      },
      {
        key: "username",
        label: "Username",
        defaultValue: "root",
      },
      {
        key: "password",
        label: "Password",
        defaultValue: "",
        placeholder: "Enter password",
      },
      {
        key: "database",
        label: "Database name",
        defaultValue: "",
        placeholder: "Leave empty for all databases",
      },
    ],
    yamlTemplate: `  configured_receiver:
    mysql:
      endpoint: "{{endpoint}}"
      username: "{{username}}"
      password: "{{password}}"
      database: "{{database}}"
      collection_interval: 10s`,
    signals: ["metrics"],
  },
  {
    receiverId: "mongodb",
    receiverType: "mongodb",
    label: "MongoDB",
    fields: [
      {
        key: "endpoint",
        label: "MongoDB connection string",
        defaultValue: "mongodb://localhost:27017",
        helpText: "Full MongoDB connection URI.",
      },
    ],
    yamlTemplate: `  configured_receiver:
    mongodb:
      hosts:
        - endpoint: "{{endpoint}}"
      collection_interval: 10s`,
    signals: ["metrics"],
  },
];

export const OTEL_RECEIVER_BY_ID: ReadonlyMap<string, OtelReceiverDefinition> = new Map(
  OTEL_RECEIVER_CATALOG.map((r) => [r.receiverId, r]),
);
