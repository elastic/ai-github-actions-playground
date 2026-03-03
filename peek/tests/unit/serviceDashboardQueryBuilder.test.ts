import { describe, it, expect } from "vitest";

import {
  buildServiceRoutesQuery,
  buildServiceRecentTracesQuery,
  buildServiceDeploymentsQuery,
} from "../../src/components/services/serviceDashboardQueryBuilder";

describe("serviceDashboardQueryBuilder", () => {
  const defaultFilters = {
    serviceName: "my-service",
    timeFrom: "NOW() - 1 hour",
    timeTo: "NOW()",
  };

  describe("buildServiceRoutesQuery", () => {
    it("generates a valid ES|QL query for route breakdown", () => {
      const query = buildServiceRoutesQuery(defaultFilters);
      expect(query).toContain("FROM traces-*");
      expect(query).toContain("parent.id IS NULL");
      expect(query).toContain('service.name == "my-service"');
      expect(query).toContain("@timestamp >= NOW() - 1 hour");
      expect(query).toContain("@timestamp <= NOW()");
      expect(query).toContain("STATS request_count = COUNT(*)");
      expect(query).toContain("avg_latency_ms = AVG(duration_ms)");
      expect(query).toContain("error_count = SUM(is_error)");
      expect(query).toContain("BY route_key");
      expect(query).toContain("EVAL error_rate = error_count / request_count");
      expect(query).toContain("SORT request_count DESC");
      expect(query).not.toContain("LIMIT");
    });

    it("includes route_key EVAL with COALESCE", () => {
      const query = buildServiceRoutesQuery(defaultFilters);
      expect(query).toContain('route_key = COALESCE(attributes.http.route, "/")');
    });

    it("classifies errors using OTel status code values", () => {
      const query = buildServiceRoutesQuery(defaultFilters);
      expect(query).toContain('IN ("Error", "STATUS_CODE_ERROR")');
    });

    it("escapes special characters in service name", () => {
      const query = buildServiceRoutesQuery({
        ...defaultFilters,
        serviceName: 'my "special" service',
      });
      expect(query).toContain('service.name == "my \\"special\\" service"');
    });

    it("supports absolute ISO timestamps", () => {
      const query = buildServiceRoutesQuery({
        serviceName: "test-svc",
        timeFrom: "2026-01-01T00:00:00.000Z",
        timeTo: "2026-01-01T01:00:00.000Z",
      });
      expect(query).toContain('@timestamp >= "2026-01-01T00:00:00.000Z"');
      expect(query).toContain('@timestamp <= "2026-01-01T01:00:00.000Z"');
    });

    it("throws for unsupported time expressions", () => {
      expect(() =>
        buildServiceRoutesQuery({
          ...defaultFilters,
          timeTo: "NOW(); DROP TABLE traces",
        }),
      ).toThrow("Unsupported time expression");
    });
  });

  describe("buildServiceRecentTracesQuery", () => {
    it("generates a valid ES|QL query for recent traces", () => {
      const query = buildServiceRecentTracesQuery(defaultFilters);
      expect(query).toContain("FROM traces-*");
      expect(query).toContain("parent.id IS NULL");
      expect(query).toContain('service.name == "my-service"');
      expect(query).toContain("@timestamp >= NOW() - 1 hour");
      expect(query).toContain("@timestamp <= NOW()");
      expect(query).toContain("EVAL duration_ms =");
      expect(query).toContain("KEEP trace.id, span.id, name, duration_ms, status.code, @timestamp");
      expect(query).toContain("SORT @timestamp DESC");
      expect(query).toContain("LIMIT 100");
    });

    it("does not contain STATS (returns raw traces)", () => {
      const query = buildServiceRecentTracesQuery(defaultFilters);
      expect(query).not.toContain("STATS");
    });

    it("escapes special characters in service name", () => {
      const query = buildServiceRecentTracesQuery({
        ...defaultFilters,
        serviceName: 'my "special" service',
      });
      expect(query).toContain('service.name == "my \\"special\\" service"');
    });

    it("supports absolute ISO timestamps", () => {
      const query = buildServiceRecentTracesQuery({
        serviceName: "test-svc",
        timeFrom: "2026-01-01T00:00:00.000Z",
        timeTo: "2026-01-01T01:00:00.000Z",
      });
      expect(query).toContain('@timestamp >= "2026-01-01T00:00:00.000Z"');
      expect(query).toContain('@timestamp <= "2026-01-01T01:00:00.000Z"');
    });

    it("throws for unsupported time expressions", () => {
      expect(() =>
        buildServiceRecentTracesQuery({
          ...defaultFilters,
          timeTo: "NOW(); DROP TABLE traces",
        }),
      ).toThrow("Unsupported time expression");
    });
  });

  describe("buildServiceDeploymentsQuery", () => {
    it("generates a valid ES|QL query for deployments", () => {
      const query = buildServiceDeploymentsQuery(defaultFilters);
      expect(query).toContain("FROM traces-*");
      expect(query).toContain("parent.id IS NULL");
      expect(query).toContain('service.name == "my-service"');
      expect(query).toContain("@timestamp >= NOW() - 1 hour");
      expect(query).toContain("@timestamp <= NOW()");
      expect(query).toContain('version_key = COALESCE(service.version, "unknown")');
      expect(query).toContain("STATS first_seen = MIN(@timestamp)");
      expect(query).toContain("last_seen = MAX(@timestamp)");
      expect(query).toContain("request_count = COUNT(*)");
      expect(query).toContain("BY version_key");
      expect(query).toContain("SORT first_seen DESC");
    });

    it("escapes special characters in service name", () => {
      const query = buildServiceDeploymentsQuery({
        ...defaultFilters,
        serviceName: 'my "special" service',
      });
      expect(query).toContain('service.name == "my \\"special\\" service"');
    });

    it("supports absolute ISO timestamps", () => {
      const query = buildServiceDeploymentsQuery({
        serviceName: "test-svc",
        timeFrom: "2026-01-01T00:00:00.000Z",
        timeTo: "2026-01-01T01:00:00.000Z",
      });
      expect(query).toContain('@timestamp >= "2026-01-01T00:00:00.000Z"');
      expect(query).toContain('@timestamp <= "2026-01-01T01:00:00.000Z"');
    });

    it("throws for unsupported time expressions", () => {
      expect(() =>
        buildServiceDeploymentsQuery({
          ...defaultFilters,
          timeTo: "NOW(); DROP TABLE traces",
        }),
      ).toThrow("Unsupported time expression");
    });

    it("does not contain duration calculations", () => {
      const query = buildServiceDeploymentsQuery(defaultFilters);
      expect(query).not.toContain("duration_ms");
    });
  });
});
