import type { ElasticsearchClient } from "../es";
import { gracefulSearch } from "../es/searchHelpers";
import { detectTelemetrySignals, type TelemetrySignal } from "../../utils/addDataUtils";

// ---------------------------------------------------------------------------
// Snapshot types
// ---------------------------------------------------------------------------

export interface PerSignalSnapshot {
  signal: TelemetrySignal;
  dataStreamExists: boolean;
  hostCount: number;
  agentCount: number;
  docCount: number;
  maxTimestamp: string | null;
}

export interface IngestionSnapshot {
  signals: PerSignalSnapshot[];
  capturedAt: string;
}

// ---------------------------------------------------------------------------
// Delta types (baseline vs current comparison)
// ---------------------------------------------------------------------------

export interface PerSignalDelta {
  signal: TelemetrySignal;
  /** Tier 1: data stream did not exist at baseline, now it does. */
  dataStreamAppeared: boolean;
  /** Tier 2: current hostCount - baseline hostCount. */
  newHostsDetected: number;
  /** Tier 2: current agentCount - baseline agentCount. */
  newAgentsDetected: number;
  /** Tier 2: current docCount - baseline docCount. */
  docCountDelta: number;
  /** True when docCountDelta > 0. */
  isDataFlowing: boolean;
  /** True when maxTimestamp is within 30 seconds of now. */
  latestTimestampIsRecent: boolean;
  latestTimestamp: string | null;
  currentHostCount: number;
  currentAgentCount: number;
  currentDocCount: number;
}

// ---------------------------------------------------------------------------
// Individual aggregation queries
// ---------------------------------------------------------------------------

async function queryHostAgentCardinality(
  client: ElasticsearchClient,
  signalType: TelemetrySignal,
): Promise<{ hostCount: number; agentCount: number }> {
  const data = await gracefulSearch(client, `${signalType}-*`, {
    size: 0,
    query: { range: { "@timestamp": { gte: "now-15m" } } },
    aggs: {
      host_count: { cardinality: { field: "host.name", precision_threshold: 3000 } },
      agent_count: { cardinality: { field: "agent.id", precision_threshold: 3000 } },
    },
  });
  if (!data?.aggregations) return { hostCount: 0, agentCount: 0 };
  return {
    hostCount: (data.aggregations.host_count as { value?: number })?.value ?? 0,
    agentCount: (data.aggregations.agent_count as { value?: number })?.value ?? 0,
  };
}

async function queryDocCount(
  client: ElasticsearchClient,
  signalType: TelemetrySignal,
): Promise<number> {
  const data = await gracefulSearch(client, `${signalType}-*`, {
    size: 0,
    track_total_hits: true,
    query: { range: { "@timestamp": { gte: "now-5m" } } },
  });
  if (!data?.hits?.total) return 0;
  const total = data.hits.total;
  return typeof total === "number" ? total : (total?.value ?? 0);
}

async function queryLatestTimestamp(
  client: ElasticsearchClient,
  signalType: TelemetrySignal,
): Promise<string | null> {
  const data = await gracefulSearch(client, `${signalType}-*`, {
    size: 0,
    aggs: { latest: { max: { field: "@timestamp" } } },
  });
  if (!data?.aggregations) return null;
  return (data.aggregations.latest as { value_as_string?: string })?.value_as_string ?? null;
}

// ---------------------------------------------------------------------------
// Capture a full snapshot for all expected signals
// ---------------------------------------------------------------------------

export async function captureIngestionSnapshot(
  client: ElasticsearchClient,
  expectedSignals: readonly TelemetrySignal[],
  dataStreamSignals: Set<TelemetrySignal>,
): Promise<IngestionSnapshot> {
  const signals = await Promise.all(
    expectedSignals.map(async (signal): Promise<PerSignalSnapshot> => {
      const [cardinality, docCount, maxTimestamp] = await Promise.all([
        queryHostAgentCardinality(client, signal),
        queryDocCount(client, signal),
        queryLatestTimestamp(client, signal),
      ]);
      return {
        signal,
        dataStreamExists: dataStreamSignals.has(signal),
        hostCount: cardinality.hostCount,
        agentCount: cardinality.agentCount,
        docCount,
        maxTimestamp,
      };
    }),
  );
  return { signals, capturedAt: new Date().toISOString() };
}

/**
 * Convenience wrapper: detects data streams then captures the full snapshot.
 */
export async function captureFullSnapshot(
  client: ElasticsearchClient,
  expectedSignals: readonly TelemetrySignal[],
  signal?: AbortSignal,
): Promise<{ snapshot: IngestionSnapshot; dataStreamSignals: Set<TelemetrySignal> }> {
  const dataStreamSignals = await detectTelemetrySignals(client, signal);
  const snapshot = await captureIngestionSnapshot(client, expectedSignals, dataStreamSignals);
  return { snapshot, dataStreamSignals };
}

// ---------------------------------------------------------------------------
// Compute delta between baseline and current snapshot
// ---------------------------------------------------------------------------

const RECENCY_THRESHOLD_MS = 30_000;

export function computeIngestionDelta(
  baseline: IngestionSnapshot,
  current: IngestionSnapshot,
): PerSignalDelta[] {
  return current.signals.map((curr) => {
    const base = baseline.signals.find((s) => s.signal === curr.signal);
    const baseHosts = base?.hostCount ?? 0;
    const baseAgents = base?.agentCount ?? 0;
    const baseDocs = base?.docCount ?? 0;
    const baseDataStream = base?.dataStreamExists ?? false;

    const latestTimestampIsRecent = curr.maxTimestamp
      ? Date.now() - Date.parse(curr.maxTimestamp) < RECENCY_THRESHOLD_MS
      : false;

    return {
      signal: curr.signal,
      dataStreamAppeared: !baseDataStream && curr.dataStreamExists,
      newHostsDetected: Math.max(0, curr.hostCount - baseHosts),
      newAgentsDetected: Math.max(0, curr.agentCount - baseAgents),
      docCountDelta: Math.max(0, curr.docCount - baseDocs),
      isDataFlowing: curr.docCount > baseDocs,
      latestTimestampIsRecent,
      latestTimestamp: curr.maxTimestamp,
      currentHostCount: curr.hostCount,
      currentAgentCount: curr.agentCount,
      currentDocCount: curr.docCount,
    };
  });
}
