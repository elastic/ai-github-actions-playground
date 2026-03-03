import { describe, it, expect } from "vitest";

import {
  buildServiceInventoryQuery,
  buildServiceEnvironmentsQuery,
  DEFAULT_SERVICE_INVENTORY_FILTERS,
} from "../../src/components/services/serviceInventoryQueryBuilder";

describe("serviceInventoryQueryBuilder", () => {
  describe("buildServiceInventoryQuery", () => {
    it("generates a valid ES|QL query with default filters", () => {
      const query = buildServiceInventoryQuery(DEFAULT_SERVICE_INVENTORY_FILTERS);
      expect(query).toContain("FROM traces-*");
      expect(query).toContain("parent.id IS NULL");
      expect(query).toContain("STATS request_count = COUNT(*)");
      expect(query).toContain("avg_latency_ms = AVG(duration_ms)");
      expect(query).toContain("error_count = SUM(is_error)");
      expect(query).toContain("unique_routes = COUNT_DISTINCT(route_key)");
      expect(query).toContain('top_route = TOP(route_key, 1, "desc")');
      expect(query).toContain('top_span_name = TOP(span_name_key, 1, "desc")');
      expect(query).toContain('language = TOP(language_key, 1, "desc")');
      expect(query).toContain("BY service.name");
      expect(query).toContain("SORT request_count DESC");
      expect(query).toContain("LIMIT 200");
    });

    it("includes time range filters", () => {
      const query = buildServiceInventoryQuery({
        timeFrom: "NOW() - 15 minutes",
        timeTo: "NOW()",
      });
      expect(query).toContain("@timestamp >= NOW() - 15 minutes");
      expect(query).toContain("@timestamp <= NOW()");
    });

    it("supports absolute ISO timestamps", () => {
      const query = buildServiceInventoryQuery({
        timeFrom: "2026-01-01T00:00:00.000Z",
        timeTo: "2026-01-01T01:00:00.000Z",
      });
      expect(query).toContain('@timestamp >= "2026-01-01T00:00:00.000Z"');
      expect(query).toContain('@timestamp <= "2026-01-01T01:00:00.000Z"');
    });

    it("throws for unsupported time expressions", () => {
      expect(() =>
        buildServiceInventoryQuery({
          timeFrom: "NOW() - 15 minutes",
          timeTo: "NOW(); DROP TABLE traces",
        }),
      ).toThrow("Unsupported time expression");
    });

    it("computes error_rate from error_count and request_count", () => {
      const query = buildServiceInventoryQuery(DEFAULT_SERVICE_INVENTORY_FILTERS);
      expect(query).toContain("EVAL error_rate = error_count / request_count");
    });

    it("classifies errors using OTel status code values", () => {
      const query = buildServiceInventoryQuery(DEFAULT_SERVICE_INVENTORY_FILTERS);
      expect(query).toContain('IN ("Error", "STATUS_CODE_ERROR")');
    });
  });

  describe("buildServiceEnvironmentsQuery", () => {
    it("generates query for a specific service", () => {
      const query = buildServiceEnvironmentsQuery("my-service");
      expect(query).toContain("FROM traces-*");
      expect(query).toContain('service.name == "my-service"');
      expect(query).toContain(
        "EVAL environment_key = COALESCE(service.environment, deployment.environment, 'unknown')",
      );
      expect(query).toContain("BY environment_key");
    });

    it("escapes special characters in service name", () => {
      const query = buildServiceEnvironmentsQuery('my "special" service');
      expect(query).toContain('service.name == "my \\"special\\" service"');
    });
  });
});
