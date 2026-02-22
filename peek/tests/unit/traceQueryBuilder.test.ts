import { describe, it, expect } from "vitest";
import {
  buildTraceSearchQuery,
  buildTraceDetailQuery,
  buildServiceSuggestionsQuery,
  buildOperationSuggestionsQuery,
  EMPTY_FILTERS,
  DEFAULT_FIELD_MAPPING,
} from "../../src/components/traces/traceQueryBuilder";
import type { TraceFilters } from "../../src/components/traces/traceQueryBuilder";

describe("buildTraceSearchQuery", () => {
  it("generates a basic root-span query with empty filters", () => {
    const query = buildTraceSearchQuery(EMPTY_FILTERS);
    expect(query).toBe(
      "FROM traces-* | WHERE parent.id IS NULL | SORT @timestamp DESC | LIMIT 100",
    );
  });

  it("includes service filter", () => {
    const filters: TraceFilters = {
      ...EMPTY_FILTERS,
      services: ["api-gw", "auth-svc"],
    };
    const query = buildTraceSearchQuery(filters);
    expect(query).toContain('service.name IN ("api-gw", "auth-svc")');
  });

  it("includes operation filter", () => {
    const filters: TraceFilters = {
      ...EMPTY_FILTERS,
      operations: ["GET /users"],
    };
    const query = buildTraceSearchQuery(filters);
    expect(query).toContain('name IN ("GET /users")');
  });

  it("includes status code filter", () => {
    const filters: TraceFilters = {
      ...EMPTY_FILTERS,
      statusCodes: ["Error"],
    };
    const query = buildTraceSearchQuery(filters);
    expect(query).toContain('status IN ("Error")');
  });

  it("includes duration filters", () => {
    const filters: TraceFilters = {
      ...EMPTY_FILTERS,
      minDurationMs: 100,
      maxDurationMs: 5000,
    };
    const query = buildTraceSearchQuery(filters);
    expect(query).toContain("duration >= 100000");
    expect(query).toContain("duration <= 5000000");
  });

  it("includes tag filters", () => {
    const filters: TraceFilters = {
      ...EMPTY_FILTERS,
      tags: [
        { key: "http.method", value: "GET" },
        { key: "http.status_code", value: "500", exclude: true },
      ],
    };
    const query = buildTraceSearchQuery(filters);
    expect(query).toContain('http.method == "GET"');
    expect(query).toContain('http.status_code != "500"');
  });

  it("respects custom limit", () => {
    const query = buildTraceSearchQuery(EMPTY_FILTERS, DEFAULT_FIELD_MAPPING, { limit: 50 });
    expect(query).toContain("LIMIT 50");
  });

  it("can disable root-spans-only filter", () => {
    const query = buildTraceSearchQuery(EMPTY_FILTERS, DEFAULT_FIELD_MAPPING, {
      rootSpansOnly: false,
    });
    expect(query).not.toContain("parent.id IS NULL");
  });

  it("combines multiple filters with AND", () => {
    const filters: TraceFilters = {
      services: ["api-gw"],
      operations: ["GET /users"],
      statusCodes: ["Error"],
      minDurationMs: 100,
      maxDurationMs: null,
      tags: [],
    };
    const query = buildTraceSearchQuery(filters);
    expect(query).toContain("AND");
    // Should have root span filter + service + operation + status + duration
    const whereClause = query.split("WHERE ")[1]!.split(" | SORT")[0]!;
    const conditions = whereClause.split(" AND ");
    expect(conditions.length).toBe(5); // parent.id IS NULL, service, operation, status, duration
  });
});

describe("buildTraceDetailQuery", () => {
  it("generates a query to fetch all spans for a trace", () => {
    const query = buildTraceDetailQuery("abc123");
    expect(query).toBe('FROM traces-* | WHERE trace.id == "abc123" | LIMIT 10000');
  });
});

describe("buildServiceSuggestionsQuery", () => {
  it("generates a service suggestions query", () => {
    const query = buildServiceSuggestionsQuery();
    expect(query).toContain("STATS count = COUNT(*) BY service.name");
    expect(query).toContain("LIMIT 50");
  });
});

describe("buildOperationSuggestionsQuery", () => {
  it("generates an operation suggestions query without service filter", () => {
    const query = buildOperationSuggestionsQuery();
    expect(query).toContain("STATS count = COUNT(*) BY name");
    expect(query).not.toContain("WHERE");
  });

  it("generates an operation suggestions query with service filter", () => {
    const query = buildOperationSuggestionsQuery(DEFAULT_FIELD_MAPPING, "api-gw");
    expect(query).toContain('WHERE service.name == "api-gw"');
    expect(query).toContain("STATS count = COUNT(*) BY name");
  });
});
