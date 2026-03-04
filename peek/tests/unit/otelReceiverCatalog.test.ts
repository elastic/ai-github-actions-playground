import { describe, it, expect } from "vitest";
import { parse } from "yaml";

import {
  interpolateReceiverTemplate,
  buildFullOtelConfig,
  mergeIntoExistingOtelConfig,
} from "../../src/services/addData/otelReceiverCatalog";

// ---------------------------------------------------------------------------
// interpolateReceiverTemplate
// ---------------------------------------------------------------------------

describe("interpolateReceiverTemplate", () => {
  it("replaces placeholders with values", () => {
    const result = interpolateReceiverTemplate('  nginx:\n    endpoint: "{{endpoint}}"', {
      endpoint: "http://localhost:8080/status",
    });
    expect(result).toContain("http://localhost:8080/status");
  });

  it("throws on unresolved placeholders", () => {
    expect(() => interpolateReceiverTemplate('  nginx:\n    endpoint: "{{endpoint}}"', {})).toThrow(
      "Unresolved receiver template placeholders: endpoint",
    );
  });
});

// ---------------------------------------------------------------------------
// buildFullOtelConfig
// ---------------------------------------------------------------------------

describe("buildFullOtelConfig", () => {
  it("includes receivers, processors, exporters, and pipelines", () => {
    const result = buildFullOtelConfig('  nginx:\n    endpoint: "http://localhost/status"', {
      receiverType: "nginx",
      esUrl: "https://es.example.com",
      apiKey: "my-key",
      signals: ["metrics"],
    });
    expect(result).toContain("receivers:");
    expect(result).toContain("nginx:");
    expect(result).toContain("processors:");
    expect(result).toContain("batch:");
    expect(result).toContain("exporters:");
    expect(result).toContain("elasticsearch:");
    expect(result).toContain("service:");
    expect(result).toContain("pipelines:");
    expect(result).toContain("metrics:");
  });

  it("throws when no signals provided", () => {
    expect(() =>
      buildFullOtelConfig("  nginx: {}", {
        receiverType: "nginx",
        esUrl: "https://es.example.com",
        apiKey: "key",
        signals: [],
      }),
    ).toThrow("At least one signal is required");
  });
});

// ---------------------------------------------------------------------------
// mergeIntoExistingOtelConfig
// ---------------------------------------------------------------------------

describe("mergeIntoExistingOtelConfig", () => {
  const baseOpts = {
    receiverType: "nginx",
    esUrl: "https://es.example.com",
    apiKey: "my-key",
    signals: ["metrics"] as const,
  };

  const receiverBlock = '  nginx:\n    endpoint: "http://localhost/status"';

  it("adds receiver, processor, exporter, and pipeline to an empty config", () => {
    const result = mergeIntoExistingOtelConfig("", receiverBlock, baseOpts);
    expect(result).toContain("nginx:");
    expect(result).toContain("batch:");
    expect(result).toContain("elasticsearch:");
    expect(result).toContain("metrics:");
  });

  it("merges into an existing config that has other receivers", () => {
    const existing = `receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
processors:
  batch:
    send_batch_size: 500
exporters:
  otlp:
    endpoint: somewhere:4317
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp]
`;

    const result = mergeIntoExistingOtelConfig(existing, receiverBlock, baseOpts);

    // Original receiver preserved
    expect(result).toContain("otlp:");
    // New receiver added
    expect(result).toContain("nginx:");
    // Existing batch processor preserved (not duplicated)
    expect(result).toContain("batch:");
    // Elasticsearch exporter added
    expect(result).toContain("elasticsearch:");
    // Original pipeline preserved
    expect(result).toContain("traces:");
    // New metrics pipeline added
    expect(result).toContain("metrics:");
  });

  it("does not duplicate entries in existing pipeline arrays", () => {
    const existing = `receivers:
  nginx:
    endpoint: "http://old:80/status"
service:
  pipelines:
    metrics:
      receivers: [nginx]
      processors: [batch]
      exporters: [elasticsearch]
`;

    const result = mergeIntoExistingOtelConfig(existing, receiverBlock, baseOpts);

    // Parse the result to check arrays don't have duplicates
    const parsed = parse(result) as {
      service: {
        pipelines: {
          metrics: { receivers: string[]; processors: string[]; exporters: string[] };
        };
      };
    };
    const receivers = parsed.service.pipelines.metrics.receivers;
    const processors = parsed.service.pipelines.metrics.processors;
    const exporters = parsed.service.pipelines.metrics.exporters;
    expect(receivers.filter((r: string) => r === "nginx")).toHaveLength(1);
    expect(processors.filter((p: string) => p === "batch")).toHaveLength(1);
    expect(exporters.filter((e: string) => e === "elasticsearch")).toHaveLength(1);
  });

  it("preserves existing exporters when adding elasticsearch", () => {
    const existing = `exporters:
  otlp:
    endpoint: somewhere:4317
`;

    const result = mergeIntoExistingOtelConfig(existing, receiverBlock, baseOpts);
    expect(result).toContain("otlp:");
    expect(result).toContain("elasticsearch:");
  });

  it("throws when no signals provided", () => {
    expect(() =>
      mergeIntoExistingOtelConfig("", receiverBlock, {
        ...baseOpts,
        signals: [],
      }),
    ).toThrow("At least one signal is required");
  });

  it("handles multiple signals", () => {
    const result = mergeIntoExistingOtelConfig("", receiverBlock, {
      ...baseOpts,
      signals: ["metrics", "logs"],
    });
    expect(result).toContain("metrics:");
    expect(result).toContain("logs:");
  });

  it("throws for structurally invalid but parseable YAML sections", () => {
    const existing = `receivers: []
service:
  pipelines: []
`;

    expect(() => mergeIntoExistingOtelConfig(existing, receiverBlock, baseOpts)).toThrow(
      'Expected "receivers" to be a YAML mapping.',
    );
  });
});
