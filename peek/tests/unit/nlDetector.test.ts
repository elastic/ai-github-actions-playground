import { describe, it, expect } from "vitest";

import { detectNaturalLanguage } from "../../src/components/nlDetector";

describe("detectNaturalLanguage", () => {
  it("detects NL after a pipe", () => {
    const doc = "FROM logs-* | count events by host";
    const result = detectNaturalLanguage(doc, doc.length);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("count events by host");
    expect(doc.slice(result!.from, result!.to)).toBe("count events by host");
  });

  it("returns null for ES|QL keywords", () => {
    expect(detectNaturalLanguage("FROM logs-* | WHERE x > 5", 26)).toBeNull();
    expect(detectNaturalLanguage("FROM logs-* | STATS count", 26)).toBeNull();
    expect(detectNaturalLanguage("FROM logs-* | EVAL x = 1", 25)).toBeNull();
    expect(detectNaturalLanguage("FROM logs-* | SORT x", 21)).toBeNull();
    expect(detectNaturalLanguage("FROM logs-* | LIMIT 10", 23)).toBeNull();
    expect(detectNaturalLanguage("FROM logs-* | KEEP x", 21)).toBeNull();
    expect(detectNaturalLanguage("FROM logs-* | DROP x", 21)).toBeNull();
    expect(detectNaturalLanguage("FROM logs-* | RENAME x", 23)).toBeNull();
  });

  it("returns null for single-word chunks", () => {
    expect(detectNaturalLanguage("FROM logs-* | something", 24)).toBeNull();
  });

  it("returns null for short chunks (< 5 chars)", () => {
    expect(detectNaturalLanguage("FROM logs-* | hi a", 18)).toBeNull();
  });

  it("returns null for dotted field paths", () => {
    expect(detectNaturalLanguage("FROM logs-* | service.name.field", 32)).toBeNull();
  });

  it("handles no pipe (start of line)", () => {
    const doc = "count events by host";
    const result = detectNaturalLanguage(doc, doc.length);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("count events by host");
    expect(result!.from).toBe(0);
    expect(result!.to).toBe(doc.length);
  });

  it("scopes to cursor line in multi-line queries", () => {
    const doc = "FROM logs-*\n| count events by host";
    const cursor = doc.length;
    const result = detectNaturalLanguage(doc, cursor);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("count events by host");
    // Should start after "| " on the second line
    expect(doc.slice(result!.from, result!.to)).toBe("count events by host");
  });

  it("returns null when cursor is at start of empty line", () => {
    const doc = "FROM logs-*\n";
    expect(detectNaturalLanguage(doc, doc.length)).toBeNull();
  });

  it("computes correct absolute positions in multi-line docs", () => {
    const doc = "FROM logs-*\n| WHERE x > 5\n| count events by host";
    const cursor = doc.length;
    const result = detectNaturalLanguage(doc, cursor);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("count events by host");
    expect(doc.slice(result!.from, result!.to)).toBe("count events by host");
  });

  it("trims leading whitespace but returns correct positions", () => {
    const doc = "FROM logs-* |   count events by host";
    const result = detectNaturalLanguage(doc, doc.length);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("count events by host");
    expect(doc.slice(result!.from, result!.to)).toBe("count events by host");
  });

  it("returns null for FROM keyword at line start", () => {
    expect(detectNaturalLanguage("FROM logs-*", 11)).toBeNull();
  });

  it("detects NL with case insensitive keyword check", () => {
    // "where" should be treated as a keyword
    expect(detectNaturalLanguage("FROM logs-* | where x > 5", 26)).toBeNull();
    // But "show me errors" should be NL (even though SHOW is a keyword,
    // "show me errors" is multi-word and starts differently)
    const doc = "FROM logs-* | show me the errors";
    const result = detectNaturalLanguage(doc, doc.length);
    // "show" starts with SHOW keyword, so this should be null
    expect(result).toBeNull();
  });

  it("handles trailing whitespace in NL chunk", () => {
    const doc = "FROM logs-* | count events by host   ";
    const cursor = doc.length;
    const result = detectNaturalLanguage(doc, cursor);
    expect(result).not.toBeNull();
    // The chunk is trimmed, but to position is at cursor
    expect(result!.text).toBe("count events by host");
  });
});
