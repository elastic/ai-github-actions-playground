import { describe, expect, it } from "vitest";

import { buildLogsQuery } from "../../src/components/logs/logsQueryBuilder";

describe("buildLogsQuery", () => {
  it("builds query with structured filters and keep columns", () => {
    const query = buildLogsQuery({
      indexPattern: "logs-*",
      searchText: "",
      filters: [
        { field: "service.name", value: "checkout-service" },
        { field: "log.level", value: "debug", exclude: true },
      ],
      selectedColumns: ["@timestamp", "service.name", "log.level", "message"],
    });

    expect(query).toContain(
      'FROM logs-* | WHERE @timestamp >= NOW() - 1 hour AND service.name == "checkout-service" AND log.level != "debug"',
    );
    expect(query).toContain("KEEP @timestamp, service.name, log.level, message");
  });

  it("uses phrase query when search text is quoted", () => {
    const query = buildLogsQuery({
      indexPattern: "logs-*",
      searchText: '"connection reset"',
      filters: [],
      selectedColumns: ["@timestamp", "message"],
    });

    expect(query).toContain('MATCH_PHRASE(message, "connection reset")');
  });

  it("uses match operator when search text is unquoted", () => {
    const query = buildLogsQuery({
      indexPattern: "logs-*",
      searchText: "connection reset",
      filters: [],
      selectedColumns: ["@timestamp", "message"],
    });

    expect(query).toContain('message : "connection reset"');
  });
});
