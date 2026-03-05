import type { ElasticsearchClient } from "../es";
import { gracefulSearch } from "../es/searchHelpers";
import { detectTelemetrySignals, type TelemetrySignal } from "../../utils/addDataUtils";

// ---------------------------------------------------------------------------
// Snapshot types
// ---------------------------------------------------------------------------

export interface PerSignalSnapshot {
  signal: TelemetrySignal;
  dataStreamExists: boolean;
  hostNames: string[];
  serviceNames: string[];
  hostCount: number;
  agentCount: number;
  serviceCount: number;
  docCount: number;
  docsPerSecond: number;
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
  /** Whether the signal's data stream existed at baseline capture time. */
  baselineDataStreamExists: boolean;
  /** Tier 1: data stream did not exist at baseline, now it does. */
  dataStreamAppeared: boolean;
  /** Tier 2: current hostCount - baseline hostCount. */
  newHostsDetected: number;
  /** Sample host names seen since baseline (best effort). */
  newHostNames: string[];
  /** Tier 2 (traces-focused): current serviceCount - baseline serviceCount. */
  newServicesDetected: number;
  /** Sample service names seen since baseline (best effort). */
  newServiceNames: string[];
  /** Tier 2: current agentCount - baseline agentCount. */
  newAgentsDetected: number;
  /** Tier 2: current docCount - baseline docCount. */
  docCountDelta: number;
  /** Tier 2: current docs/sec - baseline docs/sec. */
  docsPerSecondDelta: number;
  /** True when there is a meaningful increase in recent document volume. */
  isDataFlowing: boolean;
  /** Whether this signal is considered verified for onboarding progression. */
  signalDetected: boolean;
  /** True when maxTimestamp is within 30 seconds of now. */
  latestTimestampIsRecent: boolean;
  latestTimestamp: string | null;
  currentHostCount: number;
  currentServiceCount: number;
  currentAgentCount: number;
  currentDocCount: number;
  currentDocsPerSecond: number;
}

// ---------------------------------------------------------------------------
// Individual aggregation queries
// ---------------------------------------------------------------------------
const HOST_SERVICE_LOOKBACK_GTE = "now-120m";
const DOC_FLOW_LOOKBACK_GTE = "now-5m";
const DOC_RATE_LOOKBACK_GTE = "now-60s";

async function queryHostAgentCardinality(
  client: ElasticsearchClient,
  signalType: TelemetrySignal,
  signal?: AbortSignal,
): Promise<{ hostCount: number; serviceCount: number; agentCount: number }> {
  const data = await gracefulSearch(
    client,
    `${signalType}-*`,
    {
      size: 0,
      // Use a longer window for infra cardinality to avoid short-lived host churn.
      query: { range: { "@timestamp": { gte: HOST_SERVICE_LOOKBACK_GTE } } },
      aggs: {
        host_count: { cardinality: { field: "host.name", precision_threshold: 3000 } },
        service_count: { cardinality: { field: "service.name", precision_threshold: 3000 } },
        agent_count: { cardinality: { field: "agent.id", precision_threshold: 3000 } },
      },
    },
    signal,
  );
  if (!data?.aggregations) return { hostCount: 0, serviceCount: 0, agentCount: 0 };
  return {
    hostCount: (data.aggregations.host_count as { value?: number })?.value ?? 0,
    serviceCount: (data.aggregations.service_count as { value?: number })?.value ?? 0,
    agentCount: (data.aggregations.agent_count as { value?: number })?.value ?? 0,
  };
}

async function queryRecentEntityNames(
  client: ElasticsearchClient,
  signalType: TelemetrySignal,
  signal?: AbortSignal,
): Promise<{ hostNames: string[]; serviceNames: string[] }> {
  const data = await gracefulSearch(
    client,
    `${signalType}-*`,
    {
      size: 0,
      query: { range: { "@timestamp": { gte: HOST_SERVICE_LOOKBACK_GTE } } },
      aggs: {
        host_names: { terms: { field: "host.name", size: 50 } },
        service_names: { terms: { field: "service.name", size: 50 } },
      },
    },
    signal,
  );
  if (!data?.aggregations) return { hostNames: [], serviceNames: [] };
  const hostBuckets =
    (data.aggregations.host_names as { buckets?: Array<{ key?: string }> })?.buckets ?? [];
  const serviceBuckets =
    (data.aggregations.service_names as { buckets?: Array<{ key?: string }> })?.buckets ?? [];
  return {
    hostNames: hostBuckets.map((b) => b.key).filter((v): v is string => Boolean(v)),
    serviceNames: serviceBuckets.map((b) => b.key).filter((v): v is string => Boolean(v)),
  };
}

async function queryDocCount(
  client: ElasticsearchClient,
  signalType: TelemetrySignal,
  signal?: AbortSignal,
): Promise<number> {
  const data = await gracefulSearch(
    client,
    `${signalType}-*`,
    {
      size: 0,
      track_total_hits: true,
      query: { range: { "@timestamp": { gte: DOC_FLOW_LOOKBACK_GTE } } },
    },
    signal,
  );
  if (!data?.hits?.total) return 0;
  const total = data.hits.total;
  return typeof total === "number" ? total : (total?.value ?? 0);
}

async function queryDocsPerSecond(
  client: ElasticsearchClient,
  signalType: TelemetrySignal,
  signal?: AbortSignal,
): Promise<number> {
  const data = await gracefulSearch(
    client,
    `${signalType}-*`,
    {
      size: 0,
      track_total_hits: true,
      query: { range: { "@timestamp": { gte: DOC_RATE_LOOKBACK_GTE } } },
    },
    signal,
  );
  if (!data?.hits?.total) return 0;
  const total = data.hits.total;
  const count = typeof total === "number" ? total : (total?.value ?? 0);
  return count / 60;
}

async function queryLatestTimestamp(
  client: ElasticsearchClient,
  signalType: TelemetrySignal,
  signal?: AbortSignal,
): Promise<string | null> {
  const data = await gracefulSearch(
    client,
    `${signalType}-*`,
    {
      size: 0,
      aggs: { latest: { max: { field: "@timestamp" } } },
    },
    signal,
  );
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
  signal?: AbortSignal,
): Promise<IngestionSnapshot> {
  const signals = await Promise.all(
    expectedSignals.map(async (signalType): Promise<PerSignalSnapshot> => {
      const [cardinality, entityNames, docCount, docsPerSecond, maxTimestamp] = await Promise.all([
        queryHostAgentCardinality(client, signalType, signal),
        queryRecentEntityNames(client, signalType, signal),
        queryDocCount(client, signalType, signal),
        queryDocsPerSecond(client, signalType, signal),
        queryLatestTimestamp(client, signalType, signal),
      ]);
      return {
        signal: signalType,
        dataStreamExists: dataStreamSignals.has(signalType),
        hostNames: entityNames.hostNames,
        serviceNames: entityNames.serviceNames,
        hostCount: cardinality.hostCount,
        serviceCount: cardinality.serviceCount,
        agentCount: cardinality.agentCount,
        docCount,
        docsPerSecond,
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
  const snapshot = await captureIngestionSnapshot(
    client,
    expectedSignals,
    dataStreamSignals,
    signal,
  );
  return { snapshot, dataStreamSignals };
}

// ---------------------------------------------------------------------------
// Compute delta between baseline and current snapshot
// ---------------------------------------------------------------------------

const RECENCY_THRESHOLD_MS = 30_000;
const MIN_SIGNIFICANT_RATE_DELTA = 0.5;
const MIN_SIGNIFICANT_RATE_RATIO = 0.2;

export function computeIngestionDelta(
  baseline: IngestionSnapshot,
  current: IngestionSnapshot,
): PerSignalDelta[] {
  return current.signals.map((curr) => {
    const base = baseline.signals.find((s) => s.signal === curr.signal);
    const baseHosts = base?.hostCount ?? 0;
    const baseHostNames = new Set(base?.hostNames ?? []);
    const baseServices = base?.serviceCount ?? 0;
    const baseServiceNames = new Set(base?.serviceNames ?? []);
    const baseAgents = base?.agentCount ?? 0;
    const baseDocs = base?.docCount ?? 0;
    const baseRate = base?.docsPerSecond ?? 0;
    const baseDataStream = base?.dataStreamExists ?? false;

    const latestTimestampMs = curr.maxTimestamp ? Date.parse(curr.maxTimestamp) : NaN;
    const baselineCapturedAtMs = Date.parse(baseline.capturedAt);
    const ageMs = Number.isNaN(latestTimestampMs) ? Infinity : Date.now() - latestTimestampMs;
    const latestTimestampIsRecent = ageMs >= 0 && ageMs < RECENCY_THRESHOLD_MS;
    const docCountDelta = Math.max(0, curr.docCount - baseDocs);
    const docsPerSecondDelta = Math.max(0, curr.docsPerSecond - baseRate);
    const rawNewHosts = Math.max(0, curr.hostCount - baseHosts);
    const rawNewServices = Math.max(0, curr.serviceCount - baseServices);
    const rawNewAgents = Math.max(0, curr.agentCount - baseAgents);
    const newHostsDetected = latestTimestampIsRecent ? rawNewHosts : 0;
    const newServicesDetected = latestTimestampIsRecent ? rawNewServices : 0;
    const newAgentsDetected = latestTimestampIsRecent ? rawNewAgents : 0;
    const newHostNames = latestTimestampIsRecent
      ? curr.hostNames.filter((name) => !baseHostNames.has(name)).slice(0, 5)
      : [];
    const newServiceNames = latestTimestampIsRecent
      ? curr.serviceNames.filter((name) => !baseServiceNames.has(name)).slice(0, 5)
      : [];
    const relativeRateIncrease = baseRate > 0 ? docsPerSecondDelta / baseRate : 0;
    const significantVolumeChange =
      docsPerSecondDelta >= MIN_SIGNIFICANT_RATE_DELTA ||
      relativeRateIncrease >= MIN_SIGNIFICANT_RATE_RATIO;
    const dataArrivedSinceBaseline =
      !Number.isNaN(latestTimestampMs) &&
      !Number.isNaN(baselineCapturedAtMs) &&
      latestTimestampMs >= baselineCapturedAtMs;
    // Only count stream appearance as onboarding evidence when data arrived since baseline capture.
    const dataStreamAppeared = !baseDataStream && curr.dataStreamExists && dataArrivedSinceBaseline;
    const isDataFlowing = baseDataStream && significantVolumeChange && latestTimestampIsRecent;
    const stableInfraGrowth =
      baseDataStream &&
      latestTimestampIsRecent &&
      docsPerSecondDelta > 0 &&
      (newHostsDetected > 0 || newServicesDetected > 0);
    const signalDetected = dataStreamAppeared || isDataFlowing || stableInfraGrowth;

    return {
      signal: curr.signal,
      baselineDataStreamExists: baseDataStream,
      dataStreamAppeared,
      newHostsDetected,
      newHostNames,
      newServicesDetected,
      newServiceNames,
      newAgentsDetected,
      docCountDelta,
      docsPerSecondDelta,
      isDataFlowing,
      signalDetected,
      latestTimestampIsRecent,
      latestTimestamp: curr.maxTimestamp,
      currentHostCount: curr.hostCount,
      currentServiceCount: curr.serviceCount,
      currentAgentCount: curr.agentCount,
      currentDocCount: curr.docCount,
      currentDocsPerSecond: curr.docsPerSecond,
    };
  });
}
