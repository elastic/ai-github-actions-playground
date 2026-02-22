import type { EsqlResponse } from "../../src/services/es";

/** 6 rows — @timestamp, method, status, bytes */
export const MOCK_WEB_LOGS: EsqlResponse = {
  columns: [
    { name: "@timestamp", type: "date" },
    { name: "method", type: "keyword" },
    { name: "status", type: "integer" },
    { name: "bytes", type: "long" },
  ],
  values: [
    ["2025-01-01T00:00:00Z", "GET", 200, 1024],
    ["2025-01-01T00:01:00Z", "POST", 201, 2048],
    ["2025-01-01T00:02:00Z", "GET", 404, 0],
    ["2025-01-01T00:03:00Z", "DELETE", 204, 0],
    ["2025-01-01T00:04:00Z", "PUT", 200, 512],
    ["2025-01-01T00:05:00Z", "GET", 500, 0],
  ],
};

/** 8 rows — order_id, category, amount */
export const MOCK_ORDERS: EsqlResponse = {
  columns: [
    { name: "order_id", type: "keyword" },
    { name: "category", type: "keyword" },
    { name: "amount", type: "double" },
  ],
  values: [
    ["ORD-001", "electronics", 299.99],
    ["ORD-002", "books", 12.5],
    ["ORD-003", "electronics", 799.0],
    ["ORD-004", "clothing", 45.0],
    ["ORD-005", "books", 25.0],
    ["ORD-006", "clothing", 120.0],
    ["ORD-007", "electronics", 149.99],
    ["ORD-008", "books", 8.99],
  ],
};

/** Aggregation result — method + count */
export const MOCK_STATS_BY_METHOD: EsqlResponse = {
  columns: [
    { name: "method", type: "keyword" },
    { name: "count", type: "long" },
  ],
  values: [
    ["GET", 3],
    ["POST", 1],
    ["PUT", 1],
    ["DELETE", 1],
  ],
};

/** 0 rows with columns defined */
export const MOCK_EMPTY: EsqlResponse = {
  columns: [
    { name: "@timestamp", type: "date" },
    { name: "message", type: "text" },
    { name: "level", type: "keyword" },
  ],
  values: [],
};
