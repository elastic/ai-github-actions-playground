import { describe, expect, it } from "vitest";

import {
  buildDuplicateInstanceIdQuery,
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
    expect(query).toContain("has_instance_id");
    expect(query).toContain("has_version");
    expect(query).toContain("has_environment");
    expect(query).toContain("has_k8s_context");
    expect(query).toContain("has_k8s_pod_uid");
    expect(query).toContain(
      'has_instance_id = SUM(CASE(NULLIF(resource.attributes.service\\.instance\\.id, "") IS NOT NULL, 1, 0))',
    );
    expect(query).toContain(
      'has_version = SUM(CASE(NULLIF(service.version, "") IS NOT NULL, 1, 0))',
    );
    expect(query).toContain(
      'has_environment = SUM(CASE(NULLIF(COALESCE(service.environment, deployment.environment.name), "") IS NOT NULL, 1, 0))',
    );
    expect(query).toContain("deployment.environment.name");
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
    expect(query).toContain("is_short_internal");
    expect(query).toContain("max_short_internal_per_trace");
    expect(query).toContain("STATS internal_count = COUNT(*)");
    expect(query).toContain("trace.id");
    expect(query).toContain("max_internal_per_trace");
    expect(query).toContain("LIMIT 1");
  });
});

describe("buildDuplicateInstanceIdQuery", () => {
  it("produces valid ES|QL for duplicate service.instance.id detection", () => {
    const query = buildDuplicateInstanceIdQuery(BASE_FILTERS);
    expect(query).toContain("FROM traces-*");
    expect(query).toContain('service.name == "my-service"');
    expect(query).toContain("resource.attributes.service\\.instance\\.id IS NOT NULL");
    expect(query).toContain("logical_resource");
    expect(query).toContain('CONCAT(COALESCE(k8s.pod.uid, ""), "|", COALESCE(k8s.pod.name, "")');
    expect(query).toContain(
      'EVAL logical_resource = CASE(logical_resource == "|||||", "@@UNVERIFIABLE@@", logical_resource)',
    );
    expect(query).toContain("unverifiable_resources");
    expect(query).toContain("distinct_resources > 1 OR unverifiable_resources > 0");
    expect(query).toContain("duplicate_instance_id_count");
    expect(query).toContain("LIMIT 1");
  });
});

// ---------------------------------------------------------------------------
// Snapshot parser
// ---------------------------------------------------------------------------

describe("parseInstrumentationScoreResult", () => {
  it("returns defaults when main result is null", () => {
    const snapshot = parseInstrumentationScoreResult("svc", null, null, null);
    expect(snapshot.serviceName).toBe("svc");
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
    const snapshot = parseInstrumentationScoreResult("svc", emptyResult, null, null);
    expect(snapshot.totalSpanCount).toBe(0);
  });

  it("parses main result correctly", () => {
    const mainResult: EsqlResponse = {
      columns: [
        { name: "total_spans", type: "long" },
        { name: "root_span_count", type: "long" },
        { name: "root_client_span_count", type: "long" },
        { name: "has_instance_id", type: "long" },
        { name: "has_version", type: "long" },
        { name: "has_environment", type: "long" },
        { name: "has_k8s_context", type: "long" },
        { name: "has_k8s_pod_uid", type: "long" },
      ],
      values: [[500, 100, 5, 120, 120, 0, 300, 0]],
    };
    const snapshot = parseInstrumentationScoreResult("svc", mainResult, null, null);
    expect(snapshot.totalSpanCount).toBe(500);
    expect(snapshot.rootSpanCount).toBe(100);
    expect(snapshot.rootClientSpanCount).toBe(5);
    expect(snapshot.hasServiceInstanceId).toBe(true);
    expect(snapshot.hasServiceVersion).toBe(true);
    // has_environment = 0 means no span had service/deployment environment
    expect(snapshot.hasDeploymentEnvironment).toBe(false);
    expect(snapshot.hasK8sContext).toBe(true);
    expect(snapshot.hasK8sPodUid).toBe(false);
  });

  it("treats single-valued attribute counts as present", () => {
    const mainResult: EsqlResponse = {
      columns: [
        { name: "total_spans", type: "long" },
        { name: "root_span_count", type: "long" },
        { name: "root_client_span_count", type: "long" },
        { name: "has_instance_id", type: "long" },
        { name: "has_version", type: "long" },
        { name: "has_environment", type: "long" },
        { name: "has_k8s_context", type: "long" },
        { name: "has_k8s_pod_uid", type: "long" },
      ],
      values: [[100, 10, 0, 1, 1, 1, 1, 1]],
    };

    const snapshot = parseInstrumentationScoreResult("svc", mainResult, null, null);
    expect(snapshot.hasServiceInstanceId).toBe(true);
    expect(snapshot.hasServiceVersion).toBe(true);
    expect(snapshot.hasDeploymentEnvironment).toBe(true);
    expect(snapshot.hasK8sContext).toBe(true);
    expect(snapshot.hasK8sPodUid).toBe(true);
  });

  it("parses internal span result correctly", () => {
    const mainResult: EsqlResponse = {
      columns: [
        { name: "total_spans", type: "long" },
        { name: "root_span_count", type: "long" },
        { name: "root_client_span_count", type: "long" },
        { name: "has_instance_id", type: "long" },
        { name: "has_version", type: "long" },
        { name: "has_environment", type: "long" },
        { name: "has_k8s_context", type: "long" },
        { name: "has_k8s_pod_uid", type: "long" },
      ],
      values: [[500, 100, 0, 2, 2, 2, 1, 1]],
    };
    const internalResult: EsqlResponse = {
      columns: [
        { name: "max_internal_per_trace", type: "long" },
        { name: "max_short_internal_per_trace", type: "long" },
      ],
      values: [[15, 12]],
    };
    const duplicateResult: EsqlResponse = {
      columns: [{ name: "duplicate_instance_id_count", type: "long" }],
      values: [[3]],
    };
    const snapshot = parseInstrumentationScoreResult(
      "svc",
      mainResult,
      internalResult,
      duplicateResult,
    );
    expect(snapshot.maxInternalSpansPerTrace).toBe(15);
    expect(snapshot.maxShortInternalSpansPerTrace).toBe(12);
    expect(snapshot.duplicateInstanceIdCount).toBe(3);
  });
});
