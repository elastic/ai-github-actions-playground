import { describe, it, expect } from "vitest";

import {
  buildDiscoverShareUrl,
  encodeFields,
  decodeFields,
} from "../../src/components/useDiscoverUrlSync";
import { DEFAULT_DISCOVER_QUERY } from "../../src/store/useQueryStore";

describe("encodeFields", () => {
  it("returns null for an empty set", () => {
    expect(encodeFields(new Set())).toBeNull();
  });

  it("encodes a single field", () => {
    expect(encodeFields(new Set(["@timestamp"]))).toBe("@timestamp");
  });

  it("encodes multiple fields as comma-separated string", () => {
    const fields = new Set(["@timestamp", "message", "host.name"]);
    const encoded = encodeFields(fields);
    // Set iteration order is insertion order
    expect(encoded).toBe("@timestamp,message,host.name");
  });
});

describe("decodeFields", () => {
  it("returns an empty set for null", () => {
    expect(decodeFields(null)).toEqual(new Set());
  });

  it("returns an empty set for empty string", () => {
    expect(decodeFields("")).toEqual(new Set());
  });

  it("decodes a single field", () => {
    expect(decodeFields("@timestamp")).toEqual(new Set(["@timestamp"]));
  });

  it("decodes comma-separated fields", () => {
    expect(decodeFields("@timestamp,message,host.name")).toEqual(
      new Set(["@timestamp", "message", "host.name"]),
    );
  });

  it("filters out empty segments from trailing commas", () => {
    expect(decodeFields("a,,b,")).toEqual(new Set(["a", "b"]));
  });

  it("trims field tokens and removes whitespace-only entries", () => {
    expect(decodeFields("message, field4 ,   ,\t,host.name")).toEqual(
      new Set(["message", "field4", "host.name"]),
    );
  });
});

describe("encodeFields + decodeFields roundtrip", () => {
  it("roundtrips a field set", () => {
    const fields = new Set(["@timestamp", "message", "host.name", "log.level"]);
    const encoded = encodeFields(fields);
    const decoded = decodeFields(encoded);
    expect(decoded).toEqual(fields);
  });
});

describe("buildDiscoverShareUrl", () => {
  it("builds a share URL from current in-memory state", () => {
    const href = buildDiscoverShareUrl("https://peek.dev/discover?foo=bar", {
      query: "FROM logs-* | LIMIT 25",
      selectedFields: new Set(["@timestamp", "message"]),
      timeRange: { from: "now-15m", to: "now" },
    });
    expect(href).toBe(
      "https://peek.dev/discover?foo=bar&q=FROM+logs-*+%7C+LIMIT+25&fields=%40timestamp%2Cmessage&from=now-15m&to=now",
    );
  });

  it("removes q/fields when at default query with no selected fields", () => {
    const href = buildDiscoverShareUrl(
      "https://peek.dev/discover?q=old&fields=message&from=now-1h&to=now",
      {
        query: DEFAULT_DISCOVER_QUERY,
        selectedFields: new Set(),
        timeRange: { from: "now-30m", to: "now" },
      },
    );
    expect(href).toBe("https://peek.dev/discover?from=now-30m&to=now");
  });

  it("removes q when query is whitespace-only", () => {
    const href = buildDiscoverShareUrl("https://peek.dev/discover?q=old&from=now-1h&to=now", {
      query: "   ",
      selectedFields: new Set(["message"]),
      timeRange: { from: "now-15m", to: "now" },
    });
    expect(href).toBe("https://peek.dev/discover?from=now-15m&to=now&fields=message");
  });
});
