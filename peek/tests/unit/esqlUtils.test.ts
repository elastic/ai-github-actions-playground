import { describe, it, expect } from "vitest";

import {
  escapeEsqlString,
  escapeEsqlIdentifier,
  validateEsqlIdentifier,
} from "../../src/services/es/esqlUtils";

describe("escapeEsqlString", () => {
  it("returns plain strings unchanged", () => {
    expect(escapeEsqlString("hello")).toBe("hello");
  });

  it("escapes double quotes", () => {
    expect(escapeEsqlString('say "hello"')).toBe('say \\"hello\\"');
  });

  it("escapes backslashes", () => {
    expect(escapeEsqlString("back\\slash")).toBe("back\\\\slash");
  });

  it("escapes backslash before double quote", () => {
    expect(escapeEsqlString('a\\"b')).toBe('a\\\\\\"b');
  });
});

describe("escapeEsqlIdentifier", () => {
  it("wraps identifier in backticks", () => {
    expect(escapeEsqlIdentifier("my_field")).toBe("`my_field`");
  });

  it("escapes backticks inside the identifier", () => {
    expect(escapeEsqlIdentifier("my`field")).toBe("`my``field`");
  });

  it("handles @-prefixed field names", () => {
    expect(escapeEsqlIdentifier("@timestamp")).toBe("`@timestamp`");
  });
});

describe("validateEsqlIdentifier", () => {
  it("returns valid identifiers unchanged", () => {
    expect(validateEsqlIdentifier("service.name")).toBe("service.name");
    expect(validateEsqlIdentifier("@timestamp")).toBe("@timestamp");
    expect(validateEsqlIdentifier("_field")).toBe("_field");
  });

  it("throws on invalid identifiers", () => {
    expect(() => validateEsqlIdentifier("bad field")).toThrow("Invalid field name: bad field");
    expect(() => validateEsqlIdentifier("1start")).toThrow("Invalid field name: 1start");
    expect(() => validateEsqlIdentifier("field;drop")).toThrow("Invalid field name: field;drop");
  });
});
