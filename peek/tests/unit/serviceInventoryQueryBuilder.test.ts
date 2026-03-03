import { describe, it, expect } from "vitest";

import {
  buildServiceInventoryQuery,
  buildServiceEnvironmentsQuery,
  buildServiceSparklineQuery,
  DEFAULT_SERVICE_INVENTORY_FILTERS,
} from "../../src/components/services/serviceInventoryQueryBuilder";
import { parseServiceSparklineData } from "../../src/components/services/serviceInventoryHelpers";

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
      expect(query).toContain('route_key = COALESCE(attributes.http.route, "/")');
      expect(query).toContain('language_key = COALESCE(service.language.name, "unknown")');
      expect(query).toContain(
        "error_message_key = CASE(is_error == 1, COALESCE(status.message, span_name_key), NULL)",
      );
      expect(query).toContain(
        'environment_key = COALESCE(service.environment, deployment.environment, "unknown")',
      );
      expect(query).toContain('version_key = COALESCE(service.version, "unknown")');
      expect(query).toContain('version = TOP(version_key, 1, "desc")');
      expect(query).toContain("unique_versions = COUNT_DISTINCT(version_key)");
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
        'EVAL environment_key = COALESCE(service.environment, deployment.environment, "unknown")',
      );
      expect(query).toContain("BY environment_key");
    });

    it("escapes special characters in service name", () => {
      const query = buildServiceEnvironmentsQuery('my "special" service');
      expect(query).toContain('service.name == "my \\"special\\" service"');
    });
  });

  describe("buildServiceSparklineQuery", () => {
    it("generates a time-bucketed ES|QL query with default filters", () => {
      const query = buildServiceSparklineQuery(DEFAULT_SERVICE_INVENTORY_FILTERS);
      expect(query).toContain("FROM traces-*");
      expect(query).toContain("parent.id IS NULL");
      expect(query).toContain("request_count = COUNT(*)");
      expect(query).toContain("avg_latency_ms = AVG(duration_ms)");
      expect(query).toContain("error_rate = SUM(is_error) / COUNT(*)");
      expect(query).toContain("BY service.name");
      expect(query).toContain("BUCKET(@timestamp");
      expect(query).toContain("SORT bucket");
    });

    it("includes time range in BUCKET and WHERE", () => {
      const query = buildServiceSparklineQuery({
        timeFrom: "NOW() - 30 minutes",
        timeTo: "NOW()",
      });
      expect(query).toContain("@timestamp >= NOW() - 30 minutes");
      expect(query).toContain("@timestamp <= NOW()");
      expect(query).toContain("BUCKET(@timestamp, 20, NOW() - 30 minutes, NOW())");
    });

    it("throws for unsupported time expressions", () => {
      expect(() =>
        buildServiceSparklineQuery({
          timeFrom: "NOW() - 1 hour",
          timeTo: "INVALID_EXPR",
        }),
      ).toThrow("Unsupported time expression");
    });
  });

  describe("parseServiceSparklineData", () => {
    it("parses time-bucketed response into per-service sparkline data", () => {
      const result = parseServiceSparklineData({
        columns: [
          { name: "service.name", type: "keyword" },
          { name: "bucket", type: "date" },
          { name: "request_count", type: "long" },
          { name: "avg_latency_ms", type: "double" },
          { name: "error_rate", type: "double" },
        ],
        values: [
          ["frontend", "2026-01-01T00:00:00.000Z", 100, 45.2, 0.02],
          ["frontend", "2026-01-01T00:03:00.000Z", 120, 50.1, 0.01],
          ["backend", "2026-01-01T00:00:00.000Z", 200, 120.5, 0.1],
        ],
      });

      expect(Object.keys(result)).toEqual(["frontend", "backend"]);
      expect(result["frontend"]!.requests).toHaveLength(2);
      expect(result["frontend"]!.latency).toHaveLength(2);
      expect(result["frontend"]!.errorRate).toHaveLength(2);
      expect(result["backend"]!.requests).toHaveLength(1);

      expect(result["frontend"]!.requests[0]![1]).toBe(100);
      expect(result["frontend"]!.requests[1]![1]).toBe(120);
      expect(result["frontend"]!.latency[0]![1]).toBe(45.2);
      expect(result["backend"]!.errorRate[0]![1]).toBe(0.1);
    });

    it("returns empty object for empty response", () => {
      const result = parseServiceSparklineData({
        columns: [
          { name: "service.name", type: "keyword" },
          { name: "bucket", type: "date" },
          { name: "request_count", type: "long" },
          { name: "avg_latency_ms", type: "double" },
          { name: "error_rate", type: "double" },
        ],
        values: [],
      });
      expect(result).toEqual({});
    });
  });
});
