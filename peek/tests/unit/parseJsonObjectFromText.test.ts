import { describe, it, expect } from "vitest";

import { parseJsonObjectFromText } from "../../src/utils/parseJsonObjectFromText";

describe("parseJsonObjectFromText", () => {
  it("parses a plain JSON object", () => {
    expect(parseJsonObjectFromText('{"a": 1}')).toEqual({ a: 1 });
  });

  it("parses JSON surrounded by whitespace", () => {
    expect(parseJsonObjectFromText('  \n {"a": 1} \n ')).toEqual({ a: 1 });
  });

  it("strips ```json fences", () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(parseJsonObjectFromText(input)).toEqual({ key: "value" });
  });

  it("strips bare ``` fences (no language tag)", () => {
    const input = '```\n{"key": "value"}\n```';
    expect(parseJsonObjectFromText(input)).toEqual({ key: "value" });
  });

  it("handles extra text before the opening brace", () => {
    const input = 'Here is the JSON: {"key": "value"}';
    expect(parseJsonObjectFromText(input)).toEqual({ key: "value" });
  });

  it("handles extra text after the closing brace", () => {
    const input = '{"key": "value"} — that was the answer';
    expect(parseJsonObjectFromText(input)).toEqual({ key: "value" });
  });

  it("parses nested objects", () => {
    const input = '```json\n{"outer": {"inner": 42}}\n```';
    expect(parseJsonObjectFromText(input)).toEqual({ outer: { inner: 42 } });
  });

  it("throws on invalid JSON", () => {
    expect(() => parseJsonObjectFromText("not json")).toThrow();
  });

  it("throws on empty input", () => {
    expect(() => parseJsonObjectFromText("")).toThrow();
  });
});
