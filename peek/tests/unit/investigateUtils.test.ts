import { describe, it, expect } from "vitest";

import {
  buildTimelineContext,
  TIMELINE_SYSTEM_PROMPT,
} from "../../src/components/investigate/investigateUtils";
import {
  buildInvestigateQuery,
  buildRecentEntitiesQuery,
  investigateField,
} from "../../src/components/investigate/investigateQueryBuilder";
import {
  parseRecentEntities,
  parseTimelineEvents,
} from "../../src/components/investigate/investigateParser";
import type { EsqlResponse } from "../../src/types";

describe("investigateField", () => {
  it("maps user to user.name", () => {
    expect(investigateField("user")).toBe("user.name");
  });
  it("maps host to host.name", () => {
    expect(investigateField("host")).toBe("host.name");
  });
  it("maps ip to source.ip", () => {
    expect(investigateField("ip")).toBe("source.ip");
  });
  it("maps domain to url.domain", () => {
    expect(investigateField("domain")).toBe("url.domain");
  });
  it("maps file to file.name", () => {
    expect(investigateField("file")).toBe("file.name");
  });
});

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

  it("includes METADATA _index in the FROM clause", () => {
    const query = buildInvestigateQuery("user", "alice");
    expect(query).toContain("METADATA _index");
  });

  it("includes KEEP with event.category and _index fields", () => {
    const query = buildInvestigateQuery("user", "alice");
    expect(query).toContain("event.category");
    expect(query).toContain("_index");
  });

  it("builds an IP address query", () => {
    const query = buildInvestigateQuery("ip", "10.0.0.1");
    expect(query).toContain('source.ip == "10.0.0.1"');
    expect(query).toContain("METADATA _index");
  });

  it("builds a domain query", () => {
    const query = buildInvestigateQuery("domain", "example.com");
    expect(query).toContain('url.domain == "example.com"');
  });

  it("builds a file query", () => {
    const query = buildInvestigateQuery("file", "malware.exe");
    expect(query).toContain('file.name == "malware.exe"');
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

  it("builds an IP discovery query", () => {
    const query = buildRecentEntitiesQuery("ip");
    expect(query).toContain("source.ip IS NOT NULL");
    expect(query).toContain("BY source.ip");
  });

  it("builds a domain discovery query", () => {
    const query = buildRecentEntitiesQuery("domain");
    expect(query).toContain("url.domain IS NOT NULL");
    expect(query).toContain("BY url.domain");
  });

  it("builds a file discovery query", () => {
    const query = buildRecentEntitiesQuery("file");
    expect(query).toContain("file.name IS NOT NULL");
    expect(query).toContain("BY file.name");
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

  it("parses IP entities from ES|QL response", () => {
    const response: EsqlResponse = {
      columns: [
        { name: "event_count", type: "long" },
        { name: "last_seen", type: "date" },
        { name: "source.ip", type: "ip" },
      ],
      values: [[50, "2024-01-15T11:00:00Z", "10.0.0.1"]],
    };
    const result = parseRecentEntities(response, "ip");
    expect(result).toEqual([
      { name: "10.0.0.1", eventCount: 50, lastSeen: "2024-01-15T11:00:00Z" },
    ]);
  });

  it("parses domain entities from ES|QL response", () => {
    const response: EsqlResponse = {
      columns: [
        { name: "event_count", type: "long" },
        { name: "last_seen", type: "date" },
        { name: "url.domain", type: "keyword" },
      ],
      values: [[30, "2024-01-15T11:00:00Z", "example.com"]],
    };
    const result = parseRecentEntities(response, "domain");
    expect(result).toEqual([
      { name: "example.com", eventCount: 30, lastSeen: "2024-01-15T11:00:00Z" },
    ]);
  });

  it("parses file entities from ES|QL response", () => {
    const response: EsqlResponse = {
      columns: [
        { name: "event_count", type: "long" },
        { name: "last_seen", type: "date" },
        { name: "file.name", type: "keyword" },
      ],
      values: [[15, "2024-01-15T11:00:00Z", "payload.exe"]],
    };
    const result = parseRecentEntities(response, "file");
    expect(result).toEqual([
      { name: "payload.exe", eventCount: 15, lastSeen: "2024-01-15T11:00:00Z" },
    ]);
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

describe("buildTimelineContext", () => {
  const sampleEvent = {
    timestamp: "2024-01-15T10:30:00Z",
    category: "authentication",
    action: "logon",
    outcome: "success",
    userName: "alice",
    hostName: "web-01",
    sourceIp: "10.0.0.1",
    message: "Login",
    dataSource: "logs-security",
  };

  it("includes entity label and event count", () => {
    const context = buildTimelineContext([sampleEvent], "user", "alice");
    expect(context).toContain('user "alice"');
    expect(context).toContain("1 security-related events");
  });

  it("uses IP address label for ip tab", () => {
    const context = buildTimelineContext([sampleEvent], "ip", "10.0.0.1");
    expect(context).toContain('IP address "10.0.0.1"');
  });

  it("uses domain label for domain tab", () => {
    const context = buildTimelineContext([sampleEvent], "domain", "example.com");
    expect(context).toContain('domain "example.com"');
  });

  it("uses file label for file tab", () => {
    const context = buildTimelineContext([sampleEvent], "file", "malware.exe");
    expect(context).toContain('file "malware.exe"');
  });
});

describe("TIMELINE_SYSTEM_PROMPT", () => {
  it("is a non-empty string with security analysis instructions", () => {
    expect(TIMELINE_SYSTEM_PROMPT).toBeTruthy();
    expect(TIMELINE_SYSTEM_PROMPT).toContain("security");
  });
});
