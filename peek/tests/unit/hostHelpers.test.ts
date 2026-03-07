import { describe, it, expect } from "vitest";

import { parseHostInventory } from "../../src/components/hosts/hostHelpers";
import type { EsqlResponse } from "../../src/types";

describe("parseHostInventory", () => {
  it("parses a standard inventory response", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "host.id", type: "keyword" },
        { name: "host_name", type: "keyword" },
        { name: "os_type", type: "keyword" },
        { name: "os_name", type: "keyword" },
        { name: "os_version", type: "keyword" },
        { name: "last_seen", type: "date" },
        { name: "cpu_utilization", type: "double" },
        { name: "memory_utilization", type: "double" },
        { name: "disk_utilization", type: "double" },
        { name: "process_count", type: "long" },
      ],
      values: [
        [
          "host-1",
          "web-server-1",
          "linux",
          "Ubuntu",
          "22.04",
          "2026-01-01T00:00:00Z",
          0.45,
          0.72,
          0.31,
          120,
        ],
        [
          "host-2",
          "win-dc-1",
          "windows",
          "Windows Server",
          "2022",
          "2026-01-01T00:01:00Z",
          0.2,
          0.55,
          0.45,
          250,
        ],
      ],
    };

    const rows = parseHostInventory(data);
    expect(rows).toHaveLength(2);

    expect(rows[0].hostId).toBe("host-1");
    expect(rows[0].hostName).toBe("web-server-1");
    expect(rows[0].osType).toBe("linux");
    expect(rows[0].osName).toBe("Ubuntu");
    expect(rows[0].cpuUtilization).toBe(0.45);
    expect(rows[0].memoryUtilization).toBe(0.72);
    expect(rows[0].processCount).toBe(120);

    expect(rows[1].hostId).toBe("host-2");
    expect(rows[1].osType).toBe("windows");
    expect(rows[1].processCount).toBe(250);
  });

  it("handles darwin as macos", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "host.id", type: "keyword" },
        { name: "host_name", type: "keyword" },
        { name: "os_type", type: "keyword" },
        { name: "os_name", type: "keyword" },
        { name: "os_version", type: "keyword" },
        { name: "last_seen", type: "date" },
        { name: "cpu_utilization", type: "double" },
        { name: "memory_utilization", type: "double" },
        { name: "disk_utilization", type: "double" },
        { name: "process_count", type: "long" },
      ],
      values: [
        ["mac-1", "dev-mac", "darwin", "macOS", "14.1", "2026-01-01T00:00:00Z", 0.3, 0.5, 0.2, 80],
      ],
    };

    const rows = parseHostInventory(data);
    expect(rows[0].osType).toBe("macos");
  });

  it("returns empty array for empty response", () => {
    const data: EsqlResponse = { columns: [], values: [] };
    expect(parseHostInventory(data)).toEqual([]);
  });

  it("handles missing optional metric columns gracefully", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "host.id", type: "keyword" },
        { name: "host_name", type: "keyword" },
        { name: "os_type", type: "keyword" },
        { name: "os_name", type: "keyword" },
        { name: "os_version", type: "keyword" },
        { name: "last_seen", type: "date" },
      ],
      values: [["h1", "host-one", "linux", "Ubuntu", "22.04", "2026-01-01T00:00:00Z"]],
    };

    const rows = parseHostInventory(data);
    expect(rows).toHaveLength(1);
    expect(rows[0].cpuUtilization).toBeNull();
    expect(rows[0].memoryUtilization).toBeNull();
    expect(rows[0].diskUtilization).toBeNull();
    expect(rows[0].processCount).toBeNull();
  });

  it("falls back to host_key when host.id is missing", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "host_key", type: "keyword" },
        { name: "host_name", type: "keyword" },
        { name: "os_type", type: "keyword" },
        { name: "os_name", type: "keyword" },
        { name: "os_version", type: "keyword" },
        { name: "last_seen", type: "date" },
        { name: "cpu_utilization", type: "double" },
        { name: "memory_utilization", type: "double" },
        { name: "disk_utilization", type: "double" },
        { name: "process_count", type: "long" },
      ],
      values: [
        [
          "web-1::linux",
          "web-1",
          "linux",
          "Debian",
          "12",
          "2026-01-01T00:00:00Z",
          0.1,
          0.3,
          0.2,
          50,
        ],
      ],
    };

    const rows = parseHostInventory(data);
    expect(rows[0].hostId).toBe("web-1::linux");
  });
});
