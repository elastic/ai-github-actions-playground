import { describe, it, expect } from "vitest";

import { getConnectionFingerprint } from "../../src/utils/connectionFingerprint";

describe("getConnectionFingerprint", () => {
  it("returns null for a null connection", () => {
    expect(getConnectionFingerprint(null)).toBeNull();
  });

  it("returns a non-empty string for a valid connection", () => {
    const fp = getConnectionFingerprint({ url: "http://localhost:9200" });
    expect(typeof fp).toBe("string");
    expect(fp!.length).toBeGreaterThan(0);
  });

  it("returns a stable fingerprint for the same input", () => {
    const conn = { url: "http://localhost:9200", apiKey: "abc" };
    expect(getConnectionFingerprint(conn)).toBe(getConnectionFingerprint(conn));
  });

  it("produces different fingerprints when credentials differ", () => {
    const a = getConnectionFingerprint({ url: "http://localhost:9200", apiKey: "key-a" });
    const b = getConnectionFingerprint({ url: "http://localhost:9200", apiKey: "key-b" });
    expect(a).not.toBe(b);
  });

  it("produces different fingerprints when proxy differs", () => {
    const a = getConnectionFingerprint({ url: "http://localhost:9200" });
    const b = getConnectionFingerprint({ url: "http://localhost:9200", proxyUrl: "http://proxy" });
    expect(a).not.toBe(b);
  });

  it("does not contain raw credential values", () => {
    const fp = getConnectionFingerprint({
      url: "http://localhost:9200",
      apiKey: "super-secret-key",
      password: "hunter2",
    });
    expect(fp).not.toContain("super-secret-key");
    expect(fp).not.toContain("hunter2");
    expect(fp).not.toContain("localhost");
  });
});
