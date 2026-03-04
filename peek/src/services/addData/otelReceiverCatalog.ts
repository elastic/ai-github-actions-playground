import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

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
 * Escape a value for safe inclusion in a YAML double-quoted scalar.
 * Handles backslashes, double quotes, newlines, carriage returns, and tabs.
 */
function escapeYamlValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function asMapping(value: unknown, path: string): Record<string, unknown> {
  if (value == null) {
    return {};
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected "${path}" to be a YAML mapping.`);
  }
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown, path: string): string[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`Expected "${path}" to be a string array.`);
  }
  return [...value];
}

/**
 * Interpolate field values into a YAML template.
 * Replaces `{{key}}` placeholders with the corresponding escaped value.
 */
export function interpolateReceiverTemplate(
  template: string,
  values: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{{${key}}}`, escapeYamlValue(value));
  }
  const unresolved = [...result.matchAll(/{{\s*([\w.-]+)\s*}}/g)].map(([, key]) => key);
  if (unresolved.length > 0) {
    throw new Error(
      `Unresolved receiver template placeholders: ${[...new Set(unresolved)].join(", ")}`,
    );
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
    receiverType: string;
    esUrl: string;
    apiKey: string;
    signals: readonly AddDataExpectedSignal[];
  },
): string {
  const uniqueSignals = [...new Set(opts.signals)];
  if (uniqueSignals.length === 0) {
    throw new Error("At least one signal is required to build pipelines.");
  }

  const pipelines = uniqueSignals
    .map(
      (signal) => `    ${signal}:
      receivers: [${opts.receiverType}]
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
    endpoints: ["${escapeYamlValue(opts.esUrl)}"]
    api_key: "${escapeYamlValue(opts.apiKey)}"

service:
  pipelines:
${pipelines}
`;
}

/**
 * Merge a new receiver, batch processor, Elasticsearch exporter, and service
 * pipelines into an existing OTel Collector YAML config.  If any section
 * already exists it is extended rather than replaced.
 *
 * Returns the merged YAML string.  Throws on YAML parse failure, empty
 * signals, shape-validation errors (non-mapping / non-string-array where
 * expected), or when the receiver block does not define the target receiver.
 */
export function mergeIntoExistingOtelConfig(
  existingYaml: string,
  receiverBlock: string,
  opts: {
    receiverType: string;
    esUrl: string;
    apiKey: string;
    signals: readonly AddDataExpectedSignal[];
  },
): string {
  const uniqueSignals = [...new Set(opts.signals)];
  if (uniqueSignals.length === 0) {
    throw new Error("At least one signal is required to build pipelines.");
  }

  // Parse existing config and incoming receiver block as JS objects.
  const existing = asMapping(parseYaml(existingYaml) ?? {}, "root");
  const receiverObj = asMapping(parseYaml(`receivers:\n${receiverBlock}`), "receiver block");
  const newReceivers = asMapping(receiverObj.receivers, "receiver block.receivers");
  if (!(opts.receiverType in newReceivers)) {
    throw new Error(
      `Receiver block must define "receivers.${opts.receiverType}" before pipelines can reference it.`,
    );
  }

  // --- receivers ---
  const receivers = asMapping(existing.receivers, "receivers");
  Object.assign(receivers, newReceivers);
  existing.receivers = receivers;

  // --- processors (add batch if missing) ---
  const processors = asMapping(existing.processors, "processors");
  if (processors.batch == null) {
    processors.batch = { send_batch_size: 1000, timeout: "5s" };
  } else {
    asMapping(processors.batch, "processors.batch");
  }
  existing.processors = processors;

  // --- exporters (add elasticsearch if missing) ---
  const exporters = asMapping(existing.exporters, "exporters");
  if (exporters.elasticsearch == null) {
    exporters.elasticsearch = {
      endpoints: [opts.esUrl],
      api_key: opts.apiKey,
    };
  } else {
    asMapping(exporters.elasticsearch, "exporters.elasticsearch");
  }
  existing.exporters = exporters;

  // --- service.pipelines ---
  const service = asMapping(existing.service, "service");
  const pipelines = asMapping(service.pipelines, "service.pipelines");

  for (const signal of uniqueSignals) {
    const existingPipeline = asMapping(pipelines[signal], `service.pipelines.${signal}`);
    const existingReceivers = asStringArray(
      existingPipeline.receivers,
      `service.pipelines.${signal}.receivers`,
    );
    const existingProcessors = asStringArray(
      existingPipeline.processors,
      `service.pipelines.${signal}.processors`,
    );
    const existingExporters = asStringArray(
      existingPipeline.exporters,
      `service.pipelines.${signal}.exporters`,
    );

    if (!existingReceivers.includes(opts.receiverType)) {
      existingReceivers.push(opts.receiverType);
    }
    if (!existingProcessors.includes("batch")) {
      existingProcessors.push("batch");
    }
    if (!existingExporters.includes("elasticsearch")) {
      existingExporters.push("elasticsearch");
    }

    existingPipeline.receivers = existingReceivers;
    existingPipeline.processors = existingProcessors;
    existingPipeline.exporters = existingExporters;
    pipelines[signal] = existingPipeline;
  }

  service.pipelines = pipelines;
  existing.service = service;

  return stringifyYaml(existing, { lineWidth: 0 });
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
        placeholder: "http://localhost:8080/status",
        helpText: "URL of the nginx stub_status module endpoint.",
      },
    ],
    yamlTemplate: `  nginx:
      endpoint: "{{endpoint}}"
      collection_interval: 10s`,
    signals: ["metrics"],
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
        placeholder: "localhost:5432",
        helpText: "host:port of the PostgreSQL server.",
      },
      {
        key: "username",
        label: "Username",
        defaultValue: "postgres",
        placeholder: "postgres",
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
        placeholder: "postgres",
      },
    ],
    yamlTemplate: `  postgresql:
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
        placeholder: "localhost:6379",
        helpText: "host:port of the Redis server.",
      },
      {
        key: "password",
        label: "Password (optional)",
        defaultValue: "",
        placeholder: "Leave empty if no auth",
      },
    ],
    yamlTemplate: `  redis:
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
        placeholder: "localhost:3306",
        helpText: "host:port of the MySQL server.",
      },
      {
        key: "username",
        label: "Username",
        defaultValue: "root",
        placeholder: "root",
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
    yamlTemplate: `  mysql:
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
        placeholder: "mongodb://localhost:27017",
        helpText: "Full MongoDB connection URI.",
      },
    ],
    yamlTemplate: `  mongodb:
      hosts:
        - endpoint: "{{endpoint}}"
      collection_interval: 10s`,
    signals: ["metrics"],
  },
];

export const OTEL_RECEIVER_BY_ID: ReadonlyMap<string, OtelReceiverDefinition> = new Map(
  OTEL_RECEIVER_CATALOG.map((r) => [r.receiverId, r]),
);
