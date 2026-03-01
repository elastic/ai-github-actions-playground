import { describe, it, expect } from "vitest";

import {
  deriveDefaultOtlpEndpoint,
  getOtlpAuthHeaders,
  getTracingConnectionSnapshot,
  shouldReconfigureTracing,
} from "../../src/services/telemetry/browserTracing";

describe("browser tracing helpers", () => {
  it("derives /v1/traces endpoint from cluster URL", () => {
    expect(deriveDefaultOtlpEndpoint("https://es.example.com:9200")).toBe(
      "https://es.example.com:9200/v1/traces",
    );
  });

  it("returns empty endpoint when URL is invalid", () => {
    expect(deriveDefaultOtlpEndpoint("not a url")).toBe("");
  });

  it("prefers OTLP API key override for auth headers", () => {
    expect(
      getOtlpAuthHeaders({
        url: "https://es.example.com:9200",
        apiKey: "es-key",
        otlpApiKey: "otlp-key",
        otlpUseElasticAuth: true,
      }),
    ).toEqual({ Authorization: "ApiKey otlp-key" });
  });

  it("falls back to Elasticsearch API key when OTLP override is absent", () => {
    expect(
      getOtlpAuthHeaders({
        url: "https://es.example.com:9200",
        apiKey: "es-key",
        otlpUseElasticAuth: true,
      }),
    ).toEqual({ Authorization: "ApiKey es-key" });
  });

  it("returns empty headers when otlpUseElasticAuth is false and no OTLP key", () => {
    expect(
      getOtlpAuthHeaders({
        url: "https://es.example.com:9200",
        apiKey: "es-key",
        otlpUseElasticAuth: false,
      }),
    ).toEqual({});
  });

  it("reconfigures tracing when telemetry-relevant connection fields change", () => {
    const previous = getTracingConnectionSnapshot(
      {
        url: "https://es.example.com:9200",
        apiKey: "es-key",
        otlpEnabled: true,
        otlpEndpoint: "https://otlp.example.com/v1/traces",
      },
      true,
    );
    const next = getTracingConnectionSnapshot(
      {
        url: "https://es.example.com:9200",
        apiKey: "new-key",
        otlpEnabled: true,
        otlpEndpoint: "https://otlp.example.com/v1/traces",
      },
      true,
    );

    expect(shouldReconfigureTracing(previous, next)).toBe(true);
  });

  it("reconfigures tracing when connection URL changes", () => {
    const previous = getTracingConnectionSnapshot(
      {
        url: "https://es-one.example.com:9200",
        apiKey: "es-key",
        otlpEnabled: true,
        otlpEndpoint: "https://otlp.example.com/v1/traces",
      },
      true,
    );
    const next = getTracingConnectionSnapshot(
      {
        url: "https://es-two.example.com:9200",
        apiKey: "es-key",
        otlpEnabled: true,
        otlpEndpoint: "https://otlp.example.com/v1/traces",
      },
      true,
    );

    expect(shouldReconfigureTracing(previous, next)).toBe(true);
  });
});
