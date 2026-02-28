# Indices

Open Indices from the sidebar to browse, search, and inspect individual Elasticsearch indices without writing API calls manually.

Search indices by name, optionally toggle system indices (those starting with a dot), and select an index to view its details across five tabs.

## Overview

The Overview tab shows health status, open/close state, primary and replica shard counts, document counts (including deleted), and store size at a glance.

## Mappings

The Mappings tab lists every field in the index with its type. Nested object properties are flattened into dot-separated paths and sorted alphabetically so you can quickly locate a field.

## Settings

The Settings tab displays all index-level settings as flattened key-value pairs, including shard counts, refresh intervals, and ILM policies.

## Stats

The Stats tab surfaces operational counters: total and deleted documents, disk usage for total and primary shards, segment count, indexing operations, search queries, merges, refreshes, and flushes.

## Disk Usage

Click **Analyze disk usage** to run a field-level disk analysis. This calls `POST /{index}/_disk_usage` which is resource intensive, so it is triggered on demand. Once complete it shows total analyzed size and a per-field breakdown sorted by size.

Click **Open in Query Lab** to seed an ES|QL query for the selected index and continue analysis with full query control.

If indices fail to load, refresh the page and verify that your role has access to the `_cat/indices`, `_mapping`, `_settings`, and `_stats` APIs.
