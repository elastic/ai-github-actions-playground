import { describe, it, expect } from "vitest";

import type { SnapshotRow, SlmPolicyRow, RepositoryRow } from "../../src/hooks/useSnapshotData";
import {
  compareSnapshots,
  comparePolicies,
  compareRepositories,
} from "../../src/components/snapshotSortUtils";
import { snapshotChecks } from "../../src/health-checks/checks/snapshots";
import { evaluateHealthChecks } from "../../src/health-checks/engine";
import type { HealthSnapshot } from "../../src/health-checks";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeSnapshot = (overrides: Partial<SnapshotRow> & { name: string }): SnapshotRow => ({
  repository: "my-repo",
  state: "SUCCESS",
  indexCount: 5,
  dataStreamCount: 0,
  startTime: "2026-03-07T02:00:00.000Z",
  startTimeMs: 1772946000000,
  endTime: "2026-03-07T02:15:30.000Z",
  duration: 930000,
  indices: [],
  dataStreams: [],
  ...overrides,
});

const makePolicy = (overrides: Partial<SlmPolicyRow> & { name: string }): SlmPolicyRow => ({
  repository: "my-repo",
  schedule: "0 30 2 * * ?",
  nextExecutionMs: 1773032400000,
  snapshotsTaken: 100,
  snapshotsFailed: 0,
  snapshotsDeleted: 50,
  deletionFailures: 0,
  lastSuccessTime: 1772946930000,
  lastSuccessName: "snap-latest",
  lastFailureTime: 0,
  lastFailureDetails: "",
  expireAfter: "30d",
  minCount: 5,
  maxCount: 50,
  indices: ["*"],
  isFailing: false,
  ...overrides,
});

const makeRepo = (overrides: Partial<RepositoryRow> & { name: string }): RepositoryRow => ({
  type: "s3",
  settings: { bucket: "my-backups" },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Snapshot sorting
// ---------------------------------------------------------------------------

describe("snapshot sorting", () => {
  const snapshots: SnapshotRow[] = [
    makeSnapshot({ name: "daily-2026-03-07", state: "SUCCESS", startTimeMs: 3, duration: 100 }),
    makeSnapshot({ name: "daily-2026-03-06", state: "FAILED", startTimeMs: 1, duration: 300 }),
    makeSnapshot({ name: "daily-2026-03-05", state: "PARTIAL", startTimeMs: 2, duration: 200 }),
  ];

  it("sorts by name ascending", () => {
    const sorted = [...snapshots].sort((a, b) => compareSnapshots(a, b, "name", "asc"));
    expect(sorted.map((s) => s.name)).toEqual([
      "daily-2026-03-05",
      "daily-2026-03-06",
      "daily-2026-03-07",
    ]);
  });

  it("sorts by name descending", () => {
    const sorted = [...snapshots].sort((a, b) => compareSnapshots(a, b, "name", "desc"));
    expect(sorted.map((s) => s.name)).toEqual([
      "daily-2026-03-07",
      "daily-2026-03-06",
      "daily-2026-03-05",
    ]);
  });

  it("sorts by state ascending", () => {
    const sorted = [...snapshots].sort((a, b) => compareSnapshots(a, b, "state", "asc"));
    expect(sorted.map((s) => s.state)).toEqual(["FAILED", "PARTIAL", "SUCCESS"]);
  });

  it("sorts by startTime ascending", () => {
    const sorted = [...snapshots].sort((a, b) => compareSnapshots(a, b, "startTime", "asc"));
    expect(sorted.map((s) => s.startTimeMs)).toEqual([1, 2, 3]);
  });

  it("sorts by duration descending", () => {
    const sorted = [...snapshots].sort((a, b) => compareSnapshots(a, b, "duration", "desc"));
    expect(sorted.map((s) => s.duration)).toEqual([300, 200, 100]);
  });

  it("sorts by repository ascending", () => {
    const items = [
      makeSnapshot({ name: "a", repository: "z-repo" }),
      makeSnapshot({ name: "b", repository: "a-repo" }),
    ];
    const sorted = [...items].sort((a, b) => compareSnapshots(a, b, "repository", "asc"));
    expect(sorted.map((s) => s.repository)).toEqual(["a-repo", "z-repo"]);
  });

  it("sorts by indexCount ascending", () => {
    const items = [
      makeSnapshot({ name: "a", indexCount: 10 }),
      makeSnapshot({ name: "b", indexCount: 3 }),
      makeSnapshot({ name: "c", indexCount: 7 }),
    ];
    const sorted = [...items].sort((a, b) => compareSnapshots(a, b, "indexCount", "asc"));
    expect(sorted.map((s) => s.indexCount)).toEqual([3, 7, 10]);
  });
});

// ---------------------------------------------------------------------------
// Policy sorting
// ---------------------------------------------------------------------------

describe("policy sorting", () => {
  const policies: SlmPolicyRow[] = [
    makePolicy({ name: "daily-snapshots", snapshotsTaken: 142, snapshotsFailed: 3 }),
    makePolicy({ name: "hourly-snapshots", snapshotsTaken: 1000, snapshotsFailed: 0 }),
    makePolicy({ name: "weekly-snapshots", snapshotsTaken: 20, snapshotsFailed: 1 }),
  ];

  it("sorts by name ascending", () => {
    const sorted = [...policies].sort((a, b) => comparePolicies(a, b, "name", "asc"));
    expect(sorted.map((p) => p.name)).toEqual([
      "daily-snapshots",
      "hourly-snapshots",
      "weekly-snapshots",
    ]);
  });

  it("sorts by taken descending", () => {
    const sorted = [...policies].sort((a, b) => comparePolicies(a, b, "taken", "desc"));
    expect(sorted.map((p) => p.snapshotsTaken)).toEqual([1000, 142, 20]);
  });

  it("sorts by failed descending", () => {
    const sorted = [...policies].sort((a, b) => comparePolicies(a, b, "failed", "desc"));
    expect(sorted.map((p) => p.snapshotsFailed)).toEqual([3, 1, 0]);
  });

  it("sorts by nextRun ascending", () => {
    const items = [
      makePolicy({ name: "a", nextExecutionMs: 300 }),
      makePolicy({ name: "b", nextExecutionMs: 100 }),
      makePolicy({ name: "c", nextExecutionMs: 200 }),
    ];
    const sorted = [...items].sort((a, b) => comparePolicies(a, b, "nextRun", "asc"));
    expect(sorted.map((p) => p.nextExecutionMs)).toEqual([100, 200, 300]);
  });

  it("sorts by lastSuccess descending", () => {
    const items = [
      makePolicy({ name: "a", lastSuccessTime: 100 }),
      makePolicy({ name: "b", lastSuccessTime: 300 }),
      makePolicy({ name: "c", lastSuccessTime: 200 }),
    ];
    const sorted = [...items].sort((a, b) => comparePolicies(a, b, "lastSuccess", "desc"));
    expect(sorted.map((p) => p.lastSuccessTime)).toEqual([300, 200, 100]);
  });

  it("sorts by lastFailure ascending", () => {
    const items = [
      makePolicy({ name: "a", lastFailureTime: 300 }),
      makePolicy({ name: "b", lastFailureTime: 100 }),
      makePolicy({ name: "c", lastFailureTime: 200 }),
    ];
    const sorted = [...items].sort((a, b) => comparePolicies(a, b, "lastFailure", "asc"));
    expect(sorted.map((p) => p.lastFailureTime)).toEqual([100, 200, 300]);
  });
});

// ---------------------------------------------------------------------------
// Repository sorting
// ---------------------------------------------------------------------------

describe("repository sorting", () => {
  const repos: RepositoryRow[] = [
    makeRepo({ name: "z-repo", type: "s3" }),
    makeRepo({ name: "a-repo", type: "fs" }),
    makeRepo({ name: "m-repo", type: "gcs" }),
  ];

  it("sorts by name ascending", () => {
    const sorted = [...repos].sort((a, b) => compareRepositories(a, b, "name", "asc"));
    expect(sorted.map((r) => r.name)).toEqual(["a-repo", "m-repo", "z-repo"]);
  });

  it("sorts by name descending", () => {
    const sorted = [...repos].sort((a, b) => compareRepositories(a, b, "name", "desc"));
    expect(sorted.map((r) => r.name)).toEqual(["z-repo", "m-repo", "a-repo"]);
  });

  it("sorts by type ascending", () => {
    const sorted = [...repos].sort((a, b) => compareRepositories(a, b, "type", "asc"));
    expect(sorted.map((r) => r.type)).toEqual(["fs", "gcs", "s3"]);
  });
});

// ---------------------------------------------------------------------------
// Snapshot health checks
// ---------------------------------------------------------------------------

describe("snapshot health checks", () => {
  function makeHealthSnapshot(
    overrides: Partial<NonNullable<HealthSnapshot["data"]["snapshotsCore"]>> = {},
  ): HealthSnapshot {
    return {
      fetchedAt: new Date().toISOString(),
      data: {
        snapshotsCore: {
          snapshots: [],
          policies: {},
          slmStats: {},
          ...overrides,
        },
      },
      errors: {},
    };
  }

  it("snapshots.failed.recent — warns on FAILED snapshots", () => {
    const snapshot = makeHealthSnapshot({
      snapshots: [
        { snapshot: "snap-1", state: "FAILED" },
        { snapshot: "snap-2", state: "SUCCESS" },
      ],
    });
    const results = evaluateHealthChecks(snapshotChecks, snapshot);
    const check = results.find((r) => r.id === "snapshots.failed.recent");
    expect(check?.status).toBe("warn");
  });

  it("snapshots.failed.recent — passes with no failures", () => {
    const snapshot = makeHealthSnapshot({
      snapshots: [{ snapshot: "snap-1", state: "SUCCESS" }],
    });
    const results = evaluateHealthChecks(snapshotChecks, snapshot);
    const check = results.find((r) => r.id === "snapshots.failed.recent");
    expect(check?.status).toBe("pass");
  });

  it("snapshots.partial.recent — warns on PARTIAL snapshots", () => {
    const snapshot = makeHealthSnapshot({
      snapshots: [{ snapshot: "snap-1", state: "PARTIAL" }],
    });
    const results = evaluateHealthChecks(snapshotChecks, snapshot);
    const check = results.find((r) => r.id === "snapshots.partial.recent");
    expect(check?.status).toBe("warn");
  });

  it("slm.policy.failing — fails when last_failure > last_success", () => {
    const snapshot = makeHealthSnapshot({
      policies: {
        "daily-snapshots": {
          last_success: { time: 1000 },
          last_failure: { time: 2000, details: "repo error" },
        },
      },
    });
    const results = evaluateHealthChecks(snapshotChecks, snapshot);
    const check = results.find((r) => r.id === "slm.policy.failing");
    expect(check?.status).toBe("fail");
  });

  it("slm.policy.failing — passes when last_success > last_failure", () => {
    const snapshot = makeHealthSnapshot({
      policies: {
        "daily-snapshots": {
          last_success: { time: 3000 },
          last_failure: { time: 1000 },
        },
      },
    });
    const results = evaluateHealthChecks(snapshotChecks, snapshot);
    const check = results.find((r) => r.id === "slm.policy.failing");
    expect(check?.status).toBe("pass");
  });

  it("slm.retention.failures — warns on deletion failures", () => {
    const snapshot = makeHealthSnapshot({
      slmStats: { total_snapshot_deletion_failures: 5 },
    });
    const results = evaluateHealthChecks(snapshotChecks, snapshot);
    const check = results.find((r) => r.id === "slm.retention.failures");
    expect(check?.status).toBe("warn");
  });

  it("slm.retention.failures — passes with no deletion failures", () => {
    const snapshot = makeHealthSnapshot({
      slmStats: { total_snapshot_deletion_failures: 0 },
    });
    const results = evaluateHealthChecks(snapshotChecks, snapshot);
    const check = results.find((r) => r.id === "slm.retention.failures");
    expect(check?.status).toBe("pass");
  });
});
