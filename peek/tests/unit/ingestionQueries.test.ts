import { describe, it, expect } from "vitest";

import {
  computeIngestionDelta,
  type IngestionSnapshot,
  type PerSignalSnapshot,
} from "../../src/services/addData/ingestionQueries";

function makeSnapshot(
  signals: PerSignalSnapshot[],
  capturedAt = "2024-01-01T00:00:00.000Z",
): IngestionSnapshot {
  return { signals, capturedAt };
}

function makeSignal(
  overrides: Partial<PerSignalSnapshot> & { signal: PerSignalSnapshot["signal"] },
): PerSignalSnapshot {
  return {
    dataStreamExists: false,
    hostNames: [],
    serviceNames: [],
    hostCount: 0,
    agentCount: 0,
    serviceCount: 0,
    docCount: 0,
    docsPerSecond: 0,
    maxTimestamp: null,
    ...overrides,
  };
}

describe("computeIngestionDelta", () => {
  it("detects a new data stream appearing (Tier 1)", () => {
    const recentTimestamp = new Date(Date.now() - 5_000).toISOString();
    const baseline = makeSnapshot([makeSignal({ signal: "metrics" })]);
    const current = makeSnapshot([
      makeSignal({ signal: "metrics", dataStreamExists: true, maxTimestamp: recentTimestamp }),
    ]);

    const deltas = computeIngestionDelta(baseline, current);
    expect(deltas).toHaveLength(1);
    expect(deltas[0].signal).toBe("metrics");
    expect(deltas[0].dataStreamAppeared).toBe(true);
  });

  it("does not flag dataStreamAppeared when it already existed at baseline", () => {
    const baseline = makeSnapshot([makeSignal({ signal: "logs", dataStreamExists: true })]);
    const current = makeSnapshot([makeSignal({ signal: "logs", dataStreamExists: true })]);

    const deltas = computeIngestionDelta(baseline, current);
    expect(deltas[0].dataStreamAppeared).toBe(false);
  });

  it("detects new hosts (Tier 2)", () => {
    const recentTimestamp = new Date(Date.now() - 5_000).toISOString();
    const baseline = makeSnapshot([
      makeSignal({ signal: "metrics", dataStreamExists: true, hostCount: 3 }),
    ]);
    const current = makeSnapshot([
      makeSignal({
        signal: "metrics",
        dataStreamExists: true,
        hostCount: 5,
        maxTimestamp: recentTimestamp,
      }),
    ]);

    const deltas = computeIngestionDelta(baseline, current);
    expect(deltas[0].newHostsDetected).toBe(2);
    expect(deltas[0].currentHostCount).toBe(5);
  });

  it("tracks sample new host and service names since baseline", () => {
    const recentTimestamp = new Date(Date.now() - 5_000).toISOString();
    const baseline = makeSnapshot([
      makeSignal({
        signal: "traces",
        dataStreamExists: true,
        hostNames: ["host-a"],
        serviceNames: ["svc-a"],
      }),
    ]);
    const current = makeSnapshot([
      makeSignal({
        signal: "traces",
        dataStreamExists: true,
        hostNames: ["host-a", "host-b"],
        serviceNames: ["svc-a", "svc-b"],
        maxTimestamp: recentTimestamp,
      }),
    ]);

    const deltas = computeIngestionDelta(baseline, current);
    expect(deltas[0].newHostNames).toEqual(["host-b"]);
    expect(deltas[0].newServiceNames).toEqual(["svc-b"]);
  });

  it("detects new agents (Tier 2)", () => {
    const recentTimestamp = new Date(Date.now() - 5_000).toISOString();
    const baseline = makeSnapshot([
      makeSignal({ signal: "logs", dataStreamExists: true, agentCount: 1 }),
    ]);
    const current = makeSnapshot([
      makeSignal({
        signal: "logs",
        dataStreamExists: true,
        agentCount: 4,
        maxTimestamp: recentTimestamp,
      }),
    ]);

    const deltas = computeIngestionDelta(baseline, current);
    expect(deltas[0].newAgentsDetected).toBe(3);
    expect(deltas[0].currentAgentCount).toBe(4);
  });

  it("detects document count growth", () => {
    const recentTimestamp = new Date(Date.now() - 5_000).toISOString();
    const baseline = makeSnapshot([
      makeSignal({ signal: "traces", dataStreamExists: true, docCount: 100, docsPerSecond: 1 }),
    ]);
    const current = makeSnapshot([
      makeSignal({
        signal: "traces",
        dataStreamExists: true,
        docCount: 250,
        docsPerSecond: 3,
        maxTimestamp: recentTimestamp,
      }),
    ]);

    const deltas = computeIngestionDelta(baseline, current);
    expect(deltas[0].docCountDelta).toBe(150);
    expect(deltas[0].docsPerSecondDelta).toBe(2);
    expect(deltas[0].isDataFlowing).toBe(true);
    expect(deltas[0].currentDocCount).toBe(250);
    expect(deltas[0].currentDocsPerSecond).toBe(3);
  });

  it("clamps negative deltas to zero", () => {
    const baseline = makeSnapshot([
      makeSignal({
        signal: "metrics",
        dataStreamExists: true,
        hostCount: 5,
        agentCount: 3,
        docCount: 1000,
      }),
    ]);
    const current = makeSnapshot([
      makeSignal({
        signal: "metrics",
        dataStreamExists: true,
        hostCount: 4,
        agentCount: 2,
        docCount: 800,
      }),
    ]);

    const deltas = computeIngestionDelta(baseline, current);
    expect(deltas[0].newHostsDetected).toBe(0);
    expect(deltas[0].newAgentsDetected).toBe(0);
    expect(deltas[0].docCountDelta).toBe(0);
    expect(deltas[0].isDataFlowing).toBe(false);
  });

  it("handles multiple signals independently", () => {
    const recentTimestamp = new Date(Date.now() - 5_000).toISOString();
    const baseline = makeSnapshot([
      makeSignal({ signal: "logs", dataStreamExists: true, docCount: 10, docsPerSecond: 0.5 }),
      makeSignal({ signal: "metrics", dataStreamExists: true, hostCount: 2 }),
      makeSignal({ signal: "traces" }),
    ]);
    const current = makeSnapshot([
      makeSignal({
        signal: "logs",
        dataStreamExists: true,
        docCount: 50,
        docsPerSecond: 1.5,
        maxTimestamp: recentTimestamp,
      }),
      makeSignal({ signal: "metrics", dataStreamExists: true, hostCount: 2 }),
      makeSignal({ signal: "traces", dataStreamExists: true, maxTimestamp: recentTimestamp }),
    ]);

    const deltas = computeIngestionDelta(baseline, current);
    expect(deltas).toHaveLength(3);

    // logs: doc count growth
    expect(deltas[0].signal).toBe("logs");
    expect(deltas[0].docCountDelta).toBe(40);
    expect(deltas[0].docsPerSecondDelta).toBe(1);
    expect(deltas[0].isDataFlowing).toBe(true);
    expect(deltas[0].dataStreamAppeared).toBe(false);

    // metrics: no change
    expect(deltas[1].signal).toBe("metrics");
    expect(deltas[1].newHostsDetected).toBe(0);
    expect(deltas[1].dataStreamAppeared).toBe(false);

    // traces: new data stream
    expect(deltas[2].signal).toBe("traces");
    expect(deltas[2].dataStreamAppeared).toBe(true);
  });

  it("marks timestamp as recent when within 30 seconds", () => {
    const recentTimestamp = new Date(Date.now() - 5_000).toISOString();
    const baseline = makeSnapshot([makeSignal({ signal: "logs" })]);
    const current = makeSnapshot([makeSignal({ signal: "logs", maxTimestamp: recentTimestamp })]);

    const deltas = computeIngestionDelta(baseline, current);
    expect(deltas[0].latestTimestampIsRecent).toBe(true);
    expect(deltas[0].latestTimestamp).toBe(recentTimestamp);
  });

  it("marks timestamp as not recent when older than 30 seconds", () => {
    const oldTimestamp = new Date(Date.now() - 60_000).toISOString();
    const baseline = makeSnapshot([makeSignal({ signal: "logs" })]);
    const current = makeSnapshot([makeSignal({ signal: "logs", maxTimestamp: oldTimestamp })]);

    const deltas = computeIngestionDelta(baseline, current);
    expect(deltas[0].latestTimestampIsRecent).toBe(false);
  });

  it("marks future timestamps as not recent", () => {
    const futureTimestamp = new Date(Date.now() + 60_000).toISOString();
    const baseline = makeSnapshot([makeSignal({ signal: "logs" })]);
    const current = makeSnapshot([makeSignal({ signal: "logs", maxTimestamp: futureTimestamp })]);

    const deltas = computeIngestionDelta(baseline, current);
    expect(deltas[0].latestTimestampIsRecent).toBe(false);
    expect(deltas[0].latestTimestamp).toBe(futureTimestamp);
  });

  it("handles missing baseline signal gracefully", () => {
    const recentTimestamp = new Date(Date.now() - 5_000).toISOString();
    const baseline = makeSnapshot([]);
    const current = makeSnapshot([
      makeSignal({
        signal: "metrics",
        dataStreamExists: true,
        hostCount: 3,
        docCount: 500,
        maxTimestamp: recentTimestamp,
      }),
    ]);

    const deltas = computeIngestionDelta(baseline, current);
    expect(deltas).toHaveLength(1);
    expect(deltas[0].dataStreamAppeared).toBe(true);
    expect(deltas[0].newHostsDetected).toBe(3);
    expect(deltas[0].docCountDelta).toBe(500);
  });
});
