import { describe, it, expect } from "vitest";

import { encodeFields, decodeFields } from "../../src/components/useDiscoverUrlSync";

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
});

describe("encodeFields + decodeFields roundtrip", () => {
  it("roundtrips a field set", () => {
    const fields = new Set(["@timestamp", "message", "host.name", "log.level"]);
    const encoded = encodeFields(fields);
    const decoded = decodeFields(encoded);
    expect(decoded).toEqual(fields);
  });
});
