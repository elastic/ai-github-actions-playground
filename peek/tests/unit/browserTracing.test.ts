import { describe, it, expect } from "vitest";

import {
  deriveDefaultOtlpEndpoint,
  getOtlpAuthHeaders,
  getTracingConnectionSnapshot,
  shouldReconfigureTracing,
} from "../../src/services/telemetry/browserTracing";
import { deriveOtlpEndpoint } from "../../src/utils/addDataUtils";

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

  it("derives ingest URL for Elastic Cloud ES URLs", () => {
    const esUrl = "https://my-deploy.es.us-east-1.aws.elastic.cloud";
    const ingestBase = deriveOtlpEndpoint(esUrl);
    expect(ingestBase).toBe("https://my-deploy.ingest.us-east-1.aws.elastic.cloud");
    expect(deriveDefaultOtlpEndpoint(ingestBase!)).toBe(
      "https://my-deploy.ingest.us-east-1.aws.elastic.cloud/v1/traces",
    );
  });

  it("falls back to ES URL for non-Cloud URLs", () => {
    const esUrl = "https://es.example.com:9200";
    expect(deriveOtlpEndpoint(esUrl)).toBeNull();
    expect(deriveDefaultOtlpEndpoint(esUrl)).toBe("https://es.example.com:9200/v1/traces");
  });
});
