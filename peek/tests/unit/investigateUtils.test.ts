import { describe, it, expect } from "vitest";

import {
  buildInvestigateQuery,
  buildRecentEntitiesQuery,
  parseRecentEntities,
  parseTimelineEvents,
  formatTimestamp,
  buildSummaryPrompt,
} from "../../src/components/investigate/investigateUtils";
import type { EsqlResponse } from "../../src/types";

describe("buildInvestigateQuery", () => {
  it("builds a user query with double-quoted string literal", () => {
    const query = buildInvestigateQuery("user", "alice");
    expect(query).toContain('user.name == "alice"');
    expect(query).not.toContain("'");
  });

  it("builds a host query with double-quoted string literal", () => {
    const query = buildInvestigateQuery("host", "web-server-01");
    expect(query).toContain('host.name == "web-server-01"');
  });

  it("escapes double quotes in entity names", () => {
    const query = buildInvestigateQuery("user", 'o"brien');
    expect(query).toContain('user.name == "o\\"brien"');
  });

  it("escapes backslashes in entity names", () => {
    const query = buildInvestigateQuery("user", "DOMAIN\\user");
    expect(query).toContain('user.name == "DOMAIN\\\\user"');
  });

  it("includes FROM, WHERE, SORT, KEEP, and LIMIT clauses", () => {
    const query = buildInvestigateQuery("user", "alice");
    expect(query).toContain("FROM logs-*");
    expect(query).toContain("| WHERE");
    expect(query).toContain("| SORT @timestamp DESC");
    expect(query).toContain("| KEEP");
    expect(query).toContain("| LIMIT 200");
  });
});

describe("buildRecentEntitiesQuery", () => {
  it("builds a user discovery query", () => {
    const query = buildRecentEntitiesQuery("user");
    expect(query).toContain("user.name IS NOT NULL");
    expect(query).toContain("STATS event_count = COUNT(*)");
    expect(query).toContain("BY user.name");
    expect(query).toContain("SORT last_seen DESC");
    expect(query).toContain("LIMIT 10");
  });

  it("builds a host discovery query", () => {
    const query = buildRecentEntitiesQuery("host");
    expect(query).toContain("host.name IS NOT NULL");
    expect(query).toContain("BY host.name");
  });
});

describe("parseRecentEntities", () => {
  it("parses user entities from ES|QL response", () => {
    const response: EsqlResponse = {
      columns: [
        { name: "event_count", type: "long" },
        { name: "last_seen", type: "date" },
        { name: "user.name", type: "keyword" },
      ],
      values: [
        [42, "2024-01-15T10:30:00Z", "alice"],
        [18, "2024-01-15T09:00:00Z", "bob"],
      ],
    };
    const result = parseRecentEntities(response, "user");
    expect(result).toEqual([
      { name: "alice", eventCount: 42, lastSeen: "2024-01-15T10:30:00Z" },
      { name: "bob", eventCount: 18, lastSeen: "2024-01-15T09:00:00Z" },
    ]);
  });

  it("parses host entities from ES|QL response", () => {
    const response: EsqlResponse = {
      columns: [
        { name: "event_count", type: "long" },
        { name: "last_seen", type: "date" },
        { name: "host.name", type: "keyword" },
      ],
      values: [[100, "2024-01-15T12:00:00Z", "web-01"]],
    };
    const result = parseRecentEntities(response, "host");
    expect(result).toEqual([{ name: "web-01", eventCount: 100, lastSeen: "2024-01-15T12:00:00Z" }]);
  });

  it("filters out rows with null or empty names", () => {
    const response: EsqlResponse = {
      columns: [
        { name: "event_count", type: "long" },
        { name: "last_seen", type: "date" },
        { name: "user.name", type: "keyword" },
      ],
      values: [
        [10, "2024-01-15T10:00:00Z", "alice"],
        [5, "2024-01-15T09:00:00Z", null],
        [3, "2024-01-15T08:00:00Z", ""],
      ],
    };
    const result = parseRecentEntities(response, "user");
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("alice");
  });

  it("returns empty array when field column is missing", () => {
    const response: EsqlResponse = {
      columns: [{ name: "event_count", type: "long" }],
      values: [[10]],
    };
    const result = parseRecentEntities(response, "user");
    expect(result).toEqual([]);
  });

  it("handles array-valued name fields", () => {
    const response: EsqlResponse = {
      columns: [
        { name: "event_count", type: "long" },
        { name: "last_seen", type: "date" },
        { name: "user.name", type: "keyword" },
      ],
      values: [[10, "2024-01-15T10:00:00Z", ["alice"]]],
    };
    const result = parseRecentEntities(response, "user");
    expect(result[0]!.name).toBe("alice");
  });
});

describe("parseTimelineEvents", () => {
  it("parses events from an ES|QL response", () => {
    const response: EsqlResponse = {
      columns: [
        { name: "@timestamp", type: "date" },
        { name: "event.category", type: "keyword" },
        { name: "event.action", type: "keyword" },
        { name: "event.outcome", type: "keyword" },
        { name: "user.name", type: "keyword" },
        { name: "host.name", type: "keyword" },
        { name: "source.ip", type: "ip" },
        { name: "message", type: "text" },
        { name: "_index", type: "keyword" },
      ],
      values: [
        [
          "2024-01-15T10:30:00Z",
          "authentication",
          "logon",
          "success",
          "alice",
          "web-01",
          "10.0.0.1",
          "User logged in",
          "logs-security",
        ],
      ],
    };
    const result = parseTimelineEvents(response);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      timestamp: "2024-01-15T10:30:00Z",
      category: "authentication",
      action: "logon",
      outcome: "success",
      userName: "alice",
      hostName: "web-01",
      sourceIp: "10.0.0.1",
      message: "User logged in",
      dataSource: "logs-security",
    });
  });

  it("handles missing columns gracefully", () => {
    const response: EsqlResponse = {
      columns: [{ name: "@timestamp", type: "date" }],
      values: [["2024-01-15T10:30:00Z"]],
    };
    const result = parseTimelineEvents(response);
    expect(result[0]!.category).toBe("");
    expect(result[0]!.userName).toBe("");
  });
});

describe("formatTimestamp", () => {
  it("formats a valid ISO timestamp", () => {
    const result = formatTimestamp("2024-01-15T10:30:00Z");
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns empty string for empty input", () => {
    expect(formatTimestamp("")).toBe("");
  });

  it("returns a fallback for invalid dates", () => {
    const result = formatTimestamp("not-a-date");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("buildSummaryPrompt", () => {
  it("includes entity label and event count", () => {
    const events = [
      {
        timestamp: "2024-01-15T10:30:00Z",
        category: "authentication",
        action: "logon",
        outcome: "success",
        userName: "alice",
        hostName: "web-01",
        sourceIp: "10.0.0.1",
        message: "Login",
        dataSource: "logs-security",
      },
    ];
    const prompt = buildSummaryPrompt(events, "user", "alice");
    expect(prompt).toContain('user "alice"');
    expect(prompt).toContain("1 security-related events");
  });
});
