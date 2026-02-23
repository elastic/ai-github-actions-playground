# Cluster Overview

Cluster Overview gives a fast health snapshot of your connected Elasticsearch cluster.

Use Refresh to reload cluster identity, version, shard health, and high-level object counts for data streams, indices, and aliases.

A warning indicates partial data retrieval, usually caused by missing API permissions for one or more metadata endpoints.

Use this page before deeper investigation to confirm cluster state and quickly spot red or yellow health conditions.

## UX review: current state

Today the page is optimized for a quick "is the cluster okay?" check:

- Identity and version (`/`)
- Health and shard risk (`/_cluster/health`)
- Surface-level scale signals (`/_data_stream`, `/_resolve/index/*`)

This is effective as a first screen, but it does not yet answer common operator follow-up questions such as:

- Which node roles are present and how balanced are they?
- Are CPU, heap, and disk pressure concentrated on specific nodes?
- What are cluster-wide document/store/shard totals beyond health color?

## Comprehensive stack information plan

Expand Cluster Overview in phased, read-only steps so the page remains fast and resilient even with partial permissions.

### Phase 1: Add richer stack data endpoints

Planned API sources:

| Endpoint | UX value |
| --- | --- |
| `/_cluster/stats` | Cluster-wide totals (docs, store size, nodes, shards, indices). |
| `/_nodes` | Node inventory (name, roles, version, transport/http addresses). |
| `/_nodes/stats` | Per-node operational metrics (CPU, JVM heap, FS usage, index pressure). |

### Phase 2: Add compact information architecture

Proposed layout additions:

1. **Cluster Stats** cards for docs count, store size, total shards, and total indices.
2. **Node Role Summary** chips grouped by role with counts (for quick topology validation).
3. **Nodes Table** with high-signal columns: node name, roles, CPU %, heap %, disk used %, shard/doc counts.

### Phase 3: Preserve graceful degradation

Keep `Promise.allSettled` loading semantics so each section can render independently:

- Show available sections even if one endpoint fails.
- Keep a partial-data warning that names unavailable sections.
- Reserve hard error state for total failure across all overview sources.

## Permissions and availability notes

Exact data visibility depends on cluster privileges. The overview should continue to work as a progressive disclosure screen:

- Low-privilege users still get identity/health basics.
- Additional cards/tables appear when cluster and node stats APIs are permitted.
- Missing permissions should produce explicit "Unavailable" UI, not silent omission.
