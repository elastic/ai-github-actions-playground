import { describe, it, expect } from "vitest";

import {
  parseRouteRows,
  parseRecentTraces,
} from "../../src/components/services/serviceDashboardHelpers";
import type { EsqlResponse } from "../../src/types";

describe("serviceDashboardHelpers", () => {
  describe("parseRouteRows", () => {
    it("parses route rows from ES|QL response", () => {
      const response: EsqlResponse = {
        columns: [
          { name: "route_key", type: "keyword" },
          { name: "request_count", type: "long" },
          { name: "avg_latency_ms", type: "double" },
          { name: "error_count", type: "long" },
          { name: "error_rate", type: "double" },
        ],
        values: [
          ["/api/users", 100, 45.2, 5, 0.05],
          ["/api/orders", 50, 120.5, 10, 0.2],
        ],
      };
      const rows = parseRouteRows(response);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        route: "/api/users",
        requestCount: 100,
        avgLatencyMs: 45.2,
        errorCount: 5,
        errorRate: 0.05,
      });
      expect(rows[1]).toEqual({
        route: "/api/orders",
        requestCount: 50,
        avgLatencyMs: 120.5,
        errorCount: 10,
        errorRate: 0.2,
      });
    });

    it("handles missing columns with defaults", () => {
      const response: EsqlResponse = {
        columns: [{ name: "route_key", type: "keyword" }],
        values: [["/api/test"]],
      };
      const rows = parseRouteRows(response);
      expect(rows[0]).toEqual({
        route: "/api/test",
        requestCount: 0,
        avgLatencyMs: 0,
        errorCount: 0,
        errorRate: 0,
      });
    });

    it("handles null values with defaults", () => {
      const response: EsqlResponse = {
        columns: [
          { name: "route_key", type: "keyword" },
          { name: "request_count", type: "long" },
          { name: "avg_latency_ms", type: "double" },
          { name: "error_count", type: "long" },
          { name: "error_rate", type: "double" },
        ],
        values: [[null, null, null, null, null]],
      };
      const rows = parseRouteRows(response);
      expect(rows[0]).toEqual({
        route: "/",
        requestCount: 0,
        avgLatencyMs: 0,
        errorCount: 0,
        errorRate: 0,
      });
    });
  });

  describe("parseRecentTraces", () => {
    it("parses trace rows from ES|QL response", () => {
      const response: EsqlResponse = {
        columns: [
          { name: "trace.id", type: "keyword" },
          { name: "name", type: "keyword" },
          { name: "duration_ms", type: "double" },
          { name: "status.code", type: "keyword" },
          { name: "@timestamp", type: "date" },
        ],
        values: [
          ["abc123", "GET /api/users", 45.2, "OK", "2026-01-01T00:00:00Z"],
          ["def456", "POST /api/orders", 120.5, "Error", "2026-01-01T00:01:00Z"],
        ],
      };
      const traces = parseRecentTraces(response);
      expect(traces).toHaveLength(2);
      expect(traces[0]).toEqual({
        traceId: "abc123",
        spanName: "GET /api/users",
        durationMs: 45.2,
        statusCode: "OK",
        timestamp: "2026-01-01T00:00:00Z",
      });
      expect(traces[1]).toEqual({
        traceId: "def456",
        spanName: "POST /api/orders",
        durationMs: 120.5,
        statusCode: "Error",
        timestamp: "2026-01-01T00:01:00Z",
      });
    });

    it("handles missing columns with defaults", () => {
      const response: EsqlResponse = {
        columns: [{ name: "trace.id", type: "keyword" }],
        values: [["abc123"]],
      };
      const traces = parseRecentTraces(response);
      expect(traces[0]).toEqual({
        traceId: "abc123",
        spanName: "unknown",
        durationMs: 0,
        statusCode: "",
        timestamp: "",
      });
    });
  });
});
