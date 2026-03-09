import { describe, expect, it } from "vitest";

import {
  buildInstrumentationScoreQuery,
  buildInternalSpanCountQuery,
} from "../../src/instrumentation-score/queryBuilder";
import { parseInstrumentationScoreResult } from "../../src/instrumentation-score/snapshotParser";
import type { EsqlResponse } from "../../src/types";

const BASE_FILTERS = {
  serviceName: "my-service",
  timeFrom: "NOW() - 1 hour",
  timeTo: "NOW()",
};

// ---------------------------------------------------------------------------
// Query builders
// ---------------------------------------------------------------------------

describe("buildInstrumentationScoreQuery", () => {
  it("produces valid ES|QL with service filter", () => {
    const query = buildInstrumentationScoreQuery(BASE_FILTERS);
    expect(query).toContain("FROM traces-*");
    expect(query).toContain('service.name == "my-service"');
    expect(query).toContain("STATS");
    expect(query).toContain("total_spans");
    expect(query).toContain("root_span_count");
    expect(query).toContain("root_client_span_count");
    expect(query).toContain("has_service_name");
    expect(query).toContain("has_instance_id");
    expect(query).toContain("has_version");
    expect(query).toContain("has_environment");
    expect(query).toContain("LIMIT 1");
  });

  it("escapes special characters in service name", () => {
    const query = buildInstrumentationScoreQuery({
      ...BASE_FILTERS,
      serviceName: 'my "special" service',
    });
    expect(query).toContain('my \\"special\\" service');
  });

  it("uses time range expressions", () => {
    const query = buildInstrumentationScoreQuery(BASE_FILTERS);
    expect(query).toContain("NOW() - 1 hour");
    expect(query).toContain("NOW()");
  });
});

describe("buildInternalSpanCountQuery", () => {
  it("produces valid ES|QL for internal span counting", () => {
    const query = buildInternalSpanCountQuery(BASE_FILTERS);
    expect(query).toContain("FROM traces-*");
    expect(query).toContain('service.name == "my-service"');
    expect(query).toContain("INTERNAL");
    expect(query).toContain("STATS internal_count = COUNT(*)");
    expect(query).toContain("trace.id");
    expect(query).toContain("max_internal_per_trace");
    expect(query).toContain("LIMIT 1");
  });
});

// ---------------------------------------------------------------------------
// Snapshot parser
// ---------------------------------------------------------------------------

describe("parseInstrumentationScoreResult", () => {
  it("returns defaults when main result is null", () => {
    const snapshot = parseInstrumentationScoreResult("svc", null, null);
    expect(snapshot.serviceName).toBe("svc");
    expect(snapshot.hasServiceName).toBe(true);
    expect(snapshot.hasServiceInstanceId).toBe(false);
    expect(snapshot.rootSpanCount).toBe(0);
    expect(snapshot.totalSpanCount).toBe(0);
    expect(snapshot.maxInternalSpansPerTrace).toBe(0);
  });

  it("returns defaults when main result has no values", () => {
    const emptyResult: EsqlResponse = {
      columns: [{ name: "total_spans", type: "long" }],
      values: [],
    };
    const snapshot = parseInstrumentationScoreResult("svc", emptyResult, null);
    expect(snapshot.totalSpanCount).toBe(0);
  });

  it("parses main result correctly", () => {
    const mainResult: EsqlResponse = {
      columns: [
        { name: "total_spans", type: "long" },
        { name: "root_span_count", type: "long" },
        { name: "root_client_span_count", type: "long" },
        { name: "has_service_name", type: "long" },
        { name: "has_instance_id", type: "long" },
        { name: "has_version", type: "long" },
        { name: "has_environment", type: "long" },
      ],
      values: [[500, 100, 5, 1, 2, 2, 1]],
    };
    const snapshot = parseInstrumentationScoreResult("svc", mainResult, null);
    expect(snapshot.totalSpanCount).toBe(500);
    expect(snapshot.rootSpanCount).toBe(100);
    expect(snapshot.rootClientSpanCount).toBe(5);
    expect(snapshot.hasServiceName).toBe(true);
    // has_instance_id = 2 means > 1 distinct values (real + sentinel), so present
    expect(snapshot.hasServiceInstanceId).toBe(true);
    expect(snapshot.hasServiceVersion).toBe(true);
    // has_environment = 1 means only sentinel, so absent
    expect(snapshot.hasDeploymentEnvironment).toBe(false);
  });

  it("parses internal span result correctly", () => {
    const mainResult: EsqlResponse = {
      columns: [
        { name: "total_spans", type: "long" },
        { name: "root_span_count", type: "long" },
        { name: "root_client_span_count", type: "long" },
        { name: "has_service_name", type: "long" },
        { name: "has_instance_id", type: "long" },
        { name: "has_version", type: "long" },
        { name: "has_environment", type: "long" },
      ],
      values: [[500, 100, 0, 1, 2, 2, 2]],
    };
    const internalResult: EsqlResponse = {
      columns: [{ name: "max_internal_per_trace", type: "long" }],
      values: [[15]],
    };
    const snapshot = parseInstrumentationScoreResult("svc", mainResult, internalResult);
    expect(snapshot.maxInternalSpansPerTrace).toBe(15);
  });
});
