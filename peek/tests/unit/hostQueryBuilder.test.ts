import { describe, it, expect } from "vitest";

import {
  buildHostInventoryQuery,
  buildHostDetailQuery,
  buildHostTimeSeriesQuery,
  buildHostLoadAverageTimeSeriesQuery,
  buildHostDetailTimeSeriesQuery,
  buildHostDetailLoadAverageQuery,
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
    expect(query).toContain("load_avg_1m");
    expect(query).toContain("host_arch");
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
    expect(query).toContain("CONCAT(COALESCE(host.name, TO_STRING(host.ip)");
    expect(query).toContain("LIMIT 1");
    expect(query).toContain("load_avg_1m");
    expect(query).toContain("host_arch");
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

describe("TS time-series query builders", () => {
  const filters = { timeFrom: "NOW() - 1 hour", timeTo: "NOW()" };

  it("uses TS source command", () => {
    const q = buildHostTimeSeriesQuery("system.cpu.utilization", filters);
    expect(q).toContain("TS metrics-hostmetricsreceiver*");
  });

  it("uses AVG_OVER_TIME for gauge metrics", () => {
    const q = buildHostTimeSeriesQuery("system.cpu.utilization", filters);
    expect(q).toContain("AVG_OVER_TIME(system.cpu.utilization)");
    expect(q).not.toContain("RATE(");
  });

  it("uses RATE for counter metrics", () => {
    const q = buildHostTimeSeriesQuery("system.disk.io", filters);
    expect(q).toContain("RATE(system.disk.io)");
    expect(q).not.toContain("AVG_OVER_TIME(");
  });

  it("uses dynamic 4-param BUCKET", () => {
    const q = buildHostTimeSeriesQuery("system.cpu.utilization", filters);
    expect(q).toContain("BUCKET(@timestamp, 20, NOW() - 1 hour, NOW())");
    expect(q).not.toContain("DATE_TRUNC");
  });

  it("backtick-quotes load average field names", () => {
    const q = buildHostLoadAverageTimeSeriesQuery(filters);
    expect(q).toContain("`system.cpu.load_average.1m`");
    expect(q).toContain("`system.cpu.load_average.5m`");
    expect(q).toContain("`system.cpu.load_average.15m`");
  });

  it("filters per-host for detail time series", () => {
    const q = buildHostDetailTimeSeriesQuery("web-01::linux", "system.memory.utilization", filters);
    expect(q).toContain("TS metrics-hostmetricsreceiver*");
    expect(q).toContain('"web-01::linux"');
    expect(q).toContain("AVG_OVER_TIME(system.memory.utilization)");
  });

  it("per-host load average uses TS", () => {
    const q = buildHostDetailLoadAverageQuery("web-01::linux", filters);
    expect(q).toContain("TS metrics-hostmetricsreceiver*");
    expect(q).toContain("load_1m");
    expect(q).toContain("load_15m");
  });
});

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
    expect(query).toContain("CONCAT(COALESCE(host.name, TO_STRING(host.ip)");
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
