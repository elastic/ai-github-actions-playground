// ---------------------------------------------------------------------------
// Zod schemas for runtime validation of Elasticsearch API responses.
//
// These schemas cover the response shapes the app actively transforms — NOT
// the full ES API surface.  They are intentionally permissive (`.passthrough()`
// on objects, `.optional()` on fields that may be absent) so that extra fields
// returned by newer ES versions pass through without error while the fields we
// depend on are validated.
// ---------------------------------------------------------------------------

import { z } from "zod";

// ── ES|QL query response ──────────────────────────────────────────────────

export const esqlColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
});

export const esqlQueryResponseSchema = z
  .object({
    columns: z.array(esqlColumnSchema),
    values: z.array(z.array(z.unknown())),
  })
  .passthrough();

// ── Cluster health ────────────────────────────────────────────────────────

export const clusterHealthResponseSchema = z
  .object({
    cluster_name: z.string().optional(),
    status: z.enum(["green", "yellow", "red"]).optional(),
    timed_out: z.boolean().optional(),
    number_of_nodes: z.number().optional(),
    number_of_data_nodes: z.number().optional(),
    active_primary_shards: z.number().optional(),
    active_shards: z.number().optional(),
    initializing_shards: z.number().optional(),
    relocating_shards: z.number().optional(),
    delayed_unassigned_shards: z.number().optional(),
    unassigned_shards: z.number().optional(),
    number_of_in_flight_fetch: z.number().optional(),
    active_shards_percent_as_number: z.number().optional(),
  })
  .passthrough();

// ── Nodes info ────────────────────────────────────────────────────────────

const nodesInfoNodeSchema = z
  .object({
    name: z.string().optional(),
    roles: z.array(z.string()).optional(),
    version: z.string().optional(),
  })
  .passthrough();

export const nodesInfoResponseSchema = z
  .object({
    nodes: z.record(z.string(), nodesInfoNodeSchema).optional(),
  })
  .passthrough();

// ── Nodes stats ───────────────────────────────────────────────────────────

const nodeStatsNodeSchema = z
  .object({
    name: z.string().optional(),
  })
  .passthrough();

export const nodesStatsResponseSchema = z
  .object({
    nodes: z.record(z.string(), nodeStatsNodeSchema).optional(),
  })
  .passthrough();

// ── Cluster stats ─────────────────────────────────────────────────────────

export const clusterStatsResponseSchema = z
  .object({
    indices: z
      .object({
        count: z.number().optional(),
        shards: z.object({ total: z.number().optional() }).passthrough().optional(),
        docs: z.object({ count: z.number().optional() }).passthrough().optional(),
        store: z.object({ size_in_bytes: z.number().optional() }).passthrough().optional(),
      })
      .passthrough()
      .optional(),
    nodes: z
      .object({
        count: z.object({ total: z.number().optional() }).passthrough().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// ── Cat indices ───────────────────────────────────────────────────────────

export const catIndexRecordSchema = z
  .object({
    index: z.string(),
    health: z.string(),
    status: z.string(),
    pri: z.string(),
    rep: z.string(),
    "docs.count": z.string().nullable(),
    "docs.deleted": z.string().nullable(),
    "store.size": z.string().nullable(),
    "pri.store.size": z.string().nullable(),
  })
  .passthrough();

export const catIndicesResponseSchema = z.array(catIndexRecordSchema);

// ── Ingest pipelines ──────────────────────────────────────────────────────

const ingestPipelineSchema = z
  .object({
    description: z.string().optional(),
    version: z.number().optional(),
    processors: z.array(z.record(z.string(), z.unknown())).optional(),
    on_failure: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();

export const getIngestPipelinesResponseSchema = z.record(z.string(), ingestPipelineSchema);

// ── Field caps ────────────────────────────────────────────────────────────

export const fieldCapsResponseSchema = z
  .object({
    fields: z.record(z.string(), z.record(z.string(), z.unknown())),
  })
  .passthrough();

// ── Data streams ──────────────────────────────────────────────────────────

export const getDataStreamsResponseSchema = z
  .object({
    data_streams: z.array(z.object({}).passthrough()),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

/**
 * Validates `data` against the given zod schema.  On success returns the
 * parsed value (which includes any `.passthrough()` fields).  On failure
 * throws an `ElasticsearchError`-shaped object so that callers receive a
 * clear diagnostic instead of a cryptic render-time crash.
 */
export function validateResponse<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw {
    status: 0,
    message: `Unexpected ${label} response shape: ${issues}`,
  };
}
