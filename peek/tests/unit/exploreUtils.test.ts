import { describe, it, expect } from "vitest";

import {
  parseEncodedFilters,
  encodeFilters,
  parseLegacyFilters,
} from "../../src/components/explore/exploreUtils";

describe("parseEncodedFilters", () => {
  it("returns [] for null input", () => {
    expect(parseEncodedFilters(null)).toEqual([]);
  });

  it("returns [] for empty string", () => {
    expect(parseEncodedFilters("")).toEqual([]);
  });

  it("returns [] for malformed JSON", () => {
    expect(parseEncodedFilters("{bad")).toEqual([]);
  });

  it("returns [] when parsed value is not an array", () => {
    expect(parseEncodedFilters('{"field":"a","op":"==","value":"b"}')).toEqual([]);
  });

  it("parses valid filters", () => {
    const encoded = JSON.stringify([
      { field: "host", op: "==", value: "localhost" },
      { field: "status", op: "!=", value: "error" },
      { field: "name", op: "LIKE", value: "test*" },
    ]);
    expect(parseEncodedFilters(encoded)).toEqual([
      { field: "host", op: "==", value: "localhost" },
      { field: "status", op: "!=", value: "error" },
      { field: "name", op: "LIKE", value: "test*" },
    ]);
  });

  it("skips items with invalid op", () => {
    const encoded = JSON.stringify([
      { field: "host", op: ">", value: "1" },
      { field: "host", op: "==", value: "localhost" },
    ]);
    expect(parseEncodedFilters(encoded)).toEqual([{ field: "host", op: "==", value: "localhost" }]);
  });

  it("skips items with missing fields", () => {
    const encoded = JSON.stringify([
      { op: "==", value: "v" },
      { field: "f", value: "v" },
      { field: "f", op: "==" },
      { field: "host", op: "==", value: "localhost" },
    ]);
    expect(parseEncodedFilters(encoded)).toEqual([{ field: "host", op: "==", value: "localhost" }]);
  });

  it("skips items with non-string field/value", () => {
    const encoded = JSON.stringify([
      { field: 123, op: "==", value: "v" },
      { field: "f", op: "==", value: 456 },
      { field: "host", op: "==", value: "ok" },
    ]);
    expect(parseEncodedFilters(encoded)).toEqual([{ field: "host", op: "==", value: "ok" }]);
  });

  it("trims field and skips empty-after-trim fields", () => {
    const encoded = JSON.stringify([
      { field: "  ", op: "==", value: "v" },
      { field: "  host  ", op: "==", value: "localhost" },
    ]);
    expect(parseEncodedFilters(encoded)).toEqual([{ field: "host", op: "==", value: "localhost" }]);
  });

  it("skips null items in the array", () => {
    const encoded = JSON.stringify([null, { field: "host", op: "==", value: "ok" }]);
    expect(parseEncodedFilters(encoded)).toEqual([{ field: "host", op: "==", value: "ok" }]);
  });

  it("returns [] for an empty array", () => {
    expect(parseEncodedFilters("[]")).toEqual([]);
  });
});

describe("encodeFilters", () => {
  it("encodes valid filters to JSON", () => {
    const filters = [
      { field: "host", op: "==" as const, value: "localhost" },
      { field: "status", op: "!=" as const, value: "error" },
    ];
    expect(encodeFilters(filters)).toBe(JSON.stringify(filters));
  });

  it("trims field before encoding", () => {
    const filters = [{ field: "  host  ", op: "==" as const, value: "localhost" }];
    expect(encodeFilters(filters)).toBe(
      JSON.stringify([{ field: "host", op: "==", value: "localhost" }]),
    );
  });

  it("skips empty-after-trim fields and invalid ops", () => {
    const filters = [
      { field: "   ", op: "==" as const, value: "x" },
      { field: "host", op: ">" as unknown as "==", value: "x" },
      { field: "status", op: "!=" as const, value: "ok" },
    ] as unknown as Parameters<typeof encodeFilters>[0];
    expect(encodeFilters(filters)).toBe(
      JSON.stringify([{ field: "status", op: "!=", value: "ok" }]),
    );
  });
});

describe("parseLegacyFilters", () => {
  it("parses legacy URL filter params", () => {
    const search = "filter.host===:localhost&filter.status=!=:error";
    expect(parseLegacyFilters(search)).toEqual([
      { field: "host", op: "==", value: "localhost" },
      { field: "status", op: "!=", value: "error" },
    ]);
  });

  it("skips invalid legacy filter entries", () => {
    const search = "filter.host=>:localhost&filter. =!=:x&filter.status=!=:error";
    expect(parseLegacyFilters(search)).toEqual([{ field: "status", op: "!=", value: "error" }]);
  });

  it("skips legacy entries with missing colon or missing op", () => {
    const search =
      "filter.hostlocalhost&filter.env=:prod&filter.status=!=:error&filter.space=   :value";
    expect(parseLegacyFilters(search)).toEqual([{ field: "status", op: "!=", value: "error" }]);
  });
});
