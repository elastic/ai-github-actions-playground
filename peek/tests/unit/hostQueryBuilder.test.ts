import { describe, it, expect } from "vitest";

import {
  buildHostInventoryQuery,
  buildHostDetailQuery,
} from "../../src/components/hosts/hostQueryBuilder";

describe("buildHostInventoryQuery", () => {
  it("generates a query with time range", () => {
    const query = buildHostInventoryQuery({
      timeFrom: "NOW() - 5 minutes",
      timeTo: "NOW()",
    });
    expect(query).toContain("FROM metrics-hostmetricsreceiver*");
    expect(query).toContain("NOW() - 5 minutes");
    expect(query).toContain("NOW()");
    expect(query).toContain("STATS");
    expect(query).toContain("BY host_key");
  });

  it("adds OS filter for linux", () => {
    const query = buildHostInventoryQuery({
      timeFrom: "NOW() - 5 minutes",
      timeTo: "NOW()",
      osType: "linux",
    });
    expect(query).toContain('os.type == "linux"');
  });

  it("maps macos to darwin in the filter", () => {
    const query = buildHostInventoryQuery({
      timeFrom: "NOW() - 5 minutes",
      timeTo: "NOW()",
      osType: "macos",
    });
    expect(query).toContain('os.type == "darwin"');
  });

  it("adds search filter", () => {
    const query = buildHostInventoryQuery({
      timeFrom: "NOW() - 5 minutes",
      timeTo: "NOW()",
      search: "web-server",
    });
    expect(query).toContain('host.name LIKE "*web-server*"');
  });

  it("escapes special characters in search filter", () => {
    const query = buildHostInventoryQuery({
      timeFrom: "NOW() - 5 minutes",
      timeTo: "NOW()",
      search: 'host"name\\test*?',
    });
    expect(query).toContain('\\"');
    expect(query).toContain("\\\\test");
    expect(query).toContain("\\*");
    expect(query).toContain("\\?");
  });

  it("omits OS filter for unknown", () => {
    const query = buildHostInventoryQuery({
      timeFrom: "NOW() - 5 minutes",
      timeTo: "NOW()",
      osType: "unknown",
    });
    expect(query).not.toContain("os.type ==");
  });
});

describe("buildHostDetailQuery", () => {
  it("generates a single-host query", () => {
    const query = buildHostDetailQuery("host-123", {
      timeFrom: "NOW() - 5 minutes",
      timeTo: "NOW()",
    });
    expect(query).toContain("FROM metrics-hostmetricsreceiver*");
    expect(query).toContain('== "host-123"');
    expect(query).toContain("CONCAT(COALESCE(host.name");
    expect(query).toContain("LIMIT 1");
  });

  it("escapes double quotes in hostId", () => {
    const query = buildHostDetailQuery('host"evil', {
      timeFrom: "NOW() - 5 minutes",
      timeTo: "NOW()",
    });
    expect(query).toContain('== "host\\"evil"');
  });

  it("escapes backslashes in hostId", () => {
    const query = buildHostDetailQuery("host\\path", {
      timeFrom: "NOW() - 5 minutes",
      timeTo: "NOW()",
    });
    expect(query).toContain('== "host\\\\path"');
  });
});
