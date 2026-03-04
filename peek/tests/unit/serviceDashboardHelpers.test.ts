import { describe, it, expect } from "vitest";

import {
  parseRouteRows,
  parseRecentTraces,
  parseDeploymentRows,
  parseServiceK8sContext,
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

    it("handles malformed numeric values with defaults", () => {
      const response: EsqlResponse = {
        columns: [
          { name: "route_key", type: "keyword" },
          { name: "request_count", type: "long" },
          { name: "avg_latency_ms", type: "double" },
          { name: "error_count", type: "long" },
          { name: "error_rate", type: "double" },
        ],
        values: [["/api/test", "abc", "oops", "bad", "nope"]],
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
  });

  describe("parseRecentTraces", () => {
    it("parses trace rows from ES|QL response", () => {
      const response: EsqlResponse = {
        columns: [
          { name: "trace.id", type: "keyword" },
          { name: "span.id", type: "keyword" },
          { name: "name", type: "keyword" },
          { name: "duration_ms", type: "double" },
          { name: "status.code", type: "keyword" },
          { name: "@timestamp", type: "date" },
        ],
        values: [
          ["abc123", "span-1", "GET /api/users", 45.2, "OK", "2026-01-01T00:00:00Z"],
          ["def456", "span-2", "POST /api/orders", 120.5, "Error", "2026-01-01T00:01:00Z"],
        ],
      };
      const traces = parseRecentTraces(response);
      expect(traces).toHaveLength(2);
      expect(traces[0]).toEqual({
        traceId: "abc123",
        spanId: "span-1",
        spanName: "GET /api/users",
        durationMs: 45.2,
        statusCode: "OK",
        timestamp: "2026-01-01T00:00:00Z",
      });
      expect(traces[1]).toEqual({
        traceId: "def456",
        spanId: "span-2",
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
        spanId: "",
        spanName: "unknown",
        durationMs: 0,
        statusCode: "",
        timestamp: "",
      });
    });

    it("handles malformed duration values with defaults", () => {
      const response: EsqlResponse = {
        columns: [
          { name: "trace.id", type: "keyword" },
          { name: "span.id", type: "keyword" },
          { name: "name", type: "keyword" },
          { name: "duration_ms", type: "double" },
          { name: "status.code", type: "keyword" },
          { name: "@timestamp", type: "date" },
        ],
        values: [["abc123", "span-1", "op", "abc", "OK", "2026-01-01T00:00:00Z"]],
      };
      const traces = parseRecentTraces(response);
      expect(traces[0]).toEqual({
        traceId: "abc123",
        spanId: "span-1",
        spanName: "op",
        durationMs: 0,
        statusCode: "OK",
        timestamp: "2026-01-01T00:00:00Z",
      });
    });
  });

  describe("parseDeploymentRows", () => {
    it("parses deployment rows from ES|QL response", () => {
      const response: EsqlResponse = {
        columns: [
          { name: "version_key", type: "keyword" },
          { name: "first_seen", type: "date" },
          { name: "last_seen", type: "date" },
          { name: "request_count", type: "long" },
        ],
        values: [
          ["2.0.0", "2026-01-01T12:00:00Z", "2026-01-01T18:00:00Z", 500],
          ["1.0.0", "2026-01-01T00:00:00Z", "2026-01-01T11:59:59Z", 1000],
        ],
      };
      const rows = parseDeploymentRows(response);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        version: "2.0.0",
        firstSeen: "2026-01-01T12:00:00Z",
        lastSeen: "2026-01-01T18:00:00Z",
        requestCount: 500,
      });
      expect(rows[1]).toEqual({
        version: "1.0.0",
        firstSeen: "2026-01-01T00:00:00Z",
        lastSeen: "2026-01-01T11:59:59Z",
        requestCount: 1000,
      });
    });

    it("handles missing columns with defaults", () => {
      const response: EsqlResponse = {
        columns: [{ name: "version_key", type: "keyword" }],
        values: [["1.0.0"]],
      };
      const rows = parseDeploymentRows(response);
      expect(rows[0]).toEqual({
        version: "1.0.0",
        firstSeen: "",
        lastSeen: "",
        requestCount: 0,
      });
    });

    it("handles null values with defaults", () => {
      const response: EsqlResponse = {
        columns: [
          { name: "version_key", type: "keyword" },
          { name: "first_seen", type: "date" },
          { name: "last_seen", type: "date" },
          { name: "request_count", type: "long" },
        ],
        values: [[null, null, null, null]],
      };
      const rows = parseDeploymentRows(response);
      expect(rows[0]).toEqual({
        version: "unknown",
        firstSeen: "",
        lastSeen: "",
        requestCount: 0,
      });
    });

    it("normalizes blank and whitespace versions to unknown", () => {
      const response: EsqlResponse = {
        columns: [
          { name: "version_key", type: "keyword" },
          { name: "first_seen", type: "date" },
          { name: "last_seen", type: "date" },
          { name: "request_count", type: "long" },
        ],
        values: [
          ["", "2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z", 10],
          ["  ", "2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z", 5],
        ],
      };
      const rows = parseDeploymentRows(response);
      expect(rows[0]?.version).toBe("unknown");
      expect(rows[1]?.version).toBe("unknown");
    });

    it("handles malformed request_count values with defaults", () => {
      const response: EsqlResponse = {
        columns: [
          { name: "version_key", type: "keyword" },
          { name: "first_seen", type: "date" },
          { name: "last_seen", type: "date" },
          { name: "request_count", type: "long" },
        ],
        values: [["1.0.0", "2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z", "bad"]],
      };
      const rows = parseDeploymentRows(response);
      expect(rows[0]).toEqual({
        version: "1.0.0",
        firstSeen: "2026-01-01T00:00:00Z",
        lastSeen: "2026-01-01T01:00:00Z",
        requestCount: 0,
      });
    });
  });

  describe("parseServiceK8sContext", () => {
    it("parses K8s context rows from ES|QL response", () => {
      const response: EsqlResponse = {
        columns: [
          { name: "pod_count", type: "long" },
          { name: "k8s_namespace", type: "keyword" },
          { name: "k8s_node", type: "keyword" },
          { name: "k8s_pod", type: "keyword" },
        ],
        values: [
          [1, "default", "node-1", "frontend-abc123"],
          [1, "production", "node-2", "frontend-def456"],
        ],
      };

      const rows = parseServiceK8sContext(response);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        namespace: "default",
        node: "node-1",
        pod: "frontend-abc123",
        podCount: 1,
      });
      expect(rows[1]).toEqual({
        namespace: "production",
        node: "node-2",
        pod: "frontend-def456",
        podCount: 1,
      });
    });

    it("handles missing values gracefully", () => {
      const response: EsqlResponse = {
        columns: [
          { name: "pod_count", type: "long" },
          { name: "k8s_namespace", type: "keyword" },
          { name: "k8s_node", type: "keyword" },
          { name: "k8s_pod", type: "keyword" },
        ],
        values: [[1, null, null, "pod-1"]],
      };

      const rows = parseServiceK8sContext(response);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        namespace: "",
        node: "",
        pod: "pod-1",
        podCount: 1,
      });
    });

    it("filters rows with missing or blank pod values", () => {
      const response: EsqlResponse = {
        columns: [
          { name: "pod_count", type: "long" },
          { name: "k8s_namespace", type: "keyword" },
          { name: "k8s_node", type: "keyword" },
          { name: "k8s_pod", type: "keyword" },
        ],
        values: [
          [1, "default", "node-1", null],
          [1, "default", "node-1", "   "],
          [1, "default", "node-1", "pod-1"],
        ],
      };

      const rows = parseServiceK8sContext(response);
      expect(rows).toEqual([
        {
          namespace: "default",
          node: "node-1",
          pod: "pod-1",
          podCount: 1,
        },
      ]);
    });

    it("returns empty array for empty response", () => {
      const response: EsqlResponse = {
        columns: [
          { name: "pod_count", type: "long" },
          { name: "k8s_namespace", type: "keyword" },
          { name: "k8s_node", type: "keyword" },
          { name: "k8s_pod", type: "keyword" },
        ],
        values: [],
      };

      const rows = parseServiceK8sContext(response);
      expect(rows).toEqual([]);
    });

    it("falls back to 0 for malformed pod_count values", () => {
      const response: EsqlResponse = {
        columns: [
          { name: "pod_count", type: "long" },
          { name: "k8s_namespace", type: "keyword" },
          { name: "k8s_node", type: "keyword" },
          { name: "k8s_pod", type: "keyword" },
        ],
        values: [["bad", "default", "node-1", "pod-1"]],
      };

      const rows = parseServiceK8sContext(response);
      expect(rows[0]).toEqual({
        namespace: "default",
        node: "node-1",
        pod: "pod-1",
        podCount: 0,
      });
    });
  });
});
