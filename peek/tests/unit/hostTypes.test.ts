import { describe, it, expect } from "vitest";

import { normalizeOsType, toHostRef, osLabel } from "../../src/components/hosts/hostTypes";

describe("normalizeOsType", () => {
  it("maps 'linux' to linux", () => {
    expect(normalizeOsType("linux")).toBe("linux");
  });

  it("maps 'Linux' (case-insensitive) to linux", () => {
    expect(normalizeOsType("Linux")).toBe("linux");
  });

  it("maps 'windows' to windows", () => {
    expect(normalizeOsType("windows")).toBe("windows");
  });

  it("maps 'darwin' to macos", () => {
    expect(normalizeOsType("darwin")).toBe("macos");
  });

  it("maps 'macos' to macos", () => {
    expect(normalizeOsType("macos")).toBe("macos");
  });

  it("returns unknown for null", () => {
    expect(normalizeOsType(null)).toBe("unknown");
  });

  it("returns unknown for undefined", () => {
    expect(normalizeOsType(undefined)).toBe("unknown");
  });

  it("returns unknown for unrecognized string", () => {
    expect(normalizeOsType("freebsd")).toBe("unknown");
  });

  it("trims whitespace", () => {
    expect(normalizeOsType("  linux  ")).toBe("linux");
  });
});

describe("toHostRef", () => {
  it("uses host.id as primary identifier when available", () => {
    const ref = toHostRef("host-123", "my-host", "linux");
    expect(ref.hostId).toBe("host-123");
    expect(ref.displayName).toBe("my-host");
    expect(ref.osType).toBe("linux");
  });

  it("falls back to host.name with os disambiguator when host.id is null", () => {
    const ref = toHostRef(null, "my-host", "windows");
    expect(ref.hostId).toBe("my-host::windows");
    expect(ref.displayName).toBe("my-host");
  });

  it("falls back to host.name with normalized os disambiguator when host.id is empty", () => {
    const ref = toHostRef("", "my-host", "darwin");
    expect(ref.hostId).toBe("my-host::macos");
    expect(ref.displayName).toBe("my-host");
    expect(ref.osType).toBe("macos");
  });

  it("uses host.id for displayName when host.name is missing", () => {
    const ref = toHostRef("host-123", null, "linux");
    expect(ref.hostId).toBe("host-123");
    expect(ref.displayName).toBe("host-123");
  });

  it("defaults to 'unknown' when both are missing", () => {
    const ref = toHostRef(null, null, null);
    expect(ref.hostId).toBe("unknown");
    expect(ref.displayName).toBe("unknown");
    expect(ref.osType).toBe("unknown");
  });

  it("trims whitespace from ids", () => {
    const ref = toHostRef("  host-1  ", "  my-host  ", "linux");
    expect(ref.hostId).toBe("host-1");
    expect(ref.displayName).toBe("my-host");
  });
});

describe("osLabel", () => {
  it("returns Linux for linux", () => {
    expect(osLabel("linux")).toBe("Linux");
  });

  it("returns Windows for windows", () => {
    expect(osLabel("windows")).toBe("Windows");
  });

  it("returns macOS for macos", () => {
    expect(osLabel("macos")).toBe("macOS");
  });

  it("returns Unknown for unknown", () => {
    expect(osLabel("unknown")).toBe("Unknown");
  });
});
