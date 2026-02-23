# Cluster Overview

Cluster Overview gives a fast health snapshot of your connected Elasticsearch cluster.

Use Refresh to reload cluster identity, version, shard health, and high-level object counts for data streams, indices, aliases, and Fleet agents.

When Fleet indices are present (`.fleet-agents*` or `fleet-agents*`), the page summarizes total agents and recent status trends.

Use the dedicated **Fleet** section in the System navigation for full agent and policy tables, aggregate policy health, and per-agent drill-down with policy/configuration details.

A warning indicates partial data retrieval, usually caused by missing API permissions for one or more metadata endpoints.

Use this page before deeper investigation to confirm cluster state and quickly spot red or yellow health conditions.

## Stack information surfaces

Cluster Overview now combines cluster identity and health with broader stack-level telemetry:

- Cluster totals from `/_cluster/stats` (docs, store size, shards, indices)
- Node inventory from `/_nodes` (roles and topology summary)
- Per-node operational metrics from `/_nodes/stats` (CPU, heap, disk, shard/doc load)

The page keeps partial-load behavior via `Promise.allSettled`, so each section renders independently when permissions vary.

## Permissions and availability notes

Exact data visibility depends on cluster privileges:

- Low-privilege users still get identity/health basics.
- Additional cards and node-level sections appear when stats APIs are permitted.
- Missing permissions are shown as explicit "Unavailable" values, not silent omission.
