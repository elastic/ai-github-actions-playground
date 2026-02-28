# OTLP Fixture Data

Compressed OTLP JSON Lines files captured from the live OTel stack for offline replay.

## What's here

| File | Signal | Source | Typical size |
|------|--------|--------|-------------|
| `traces.jsonl.gz` | Traces | `tracegen.py` — 9-service distributed traces | ~130KB |
| `metrics.jsonl.gz` | Metrics | `hostmetrics` receiver — CPU, memory, disk, network | ~100KB |
| `logs.jsonl.gz` | Logs | `otelgen` — synthetic log records | ~20KB |

## How they were generated

1. Start the OTel stack with the capture overlay:
   ```bash
   make otel-capture
   ```
   This runs the standard EDOT collector + tracegen + otelgen-logs, but adds
   `file/traces`, `file/metrics`, and `file/logs` exporters that write OTLP
   JSON Lines to `peek/fixtures/otlp/`.

2. Let it run ~30 seconds for a good sample, then stop:
   ```bash
   make otel-capture-down
   ```
   This stops the stack and gzips the captured files.

3. Commit the `.jsonl.gz` files.

## How they're replayed

The replay script reads these files, rewrites all timestamps to be relative
to "now", and sends them via OTLP/HTTP to a running EDOT collector:

```bash
make otel-replay-up    # Start ES + EDOT collector in replay mode
make otel-replay       # Replay fixtures + seed non-OTLP data (web_logs, orders, pipelines)
make test-e2e-live     # Run Playwright tests against the replayed data
make otel-replay-down  # Stop everything
```

The timestamp rewriting ensures data always appears fresh — the newest data
point is shifted to 5 minutes ago, and all other timestamps are shifted by
the same offset.

## When to regenerate

Re-capture if:
- `tracegen.py` changes its service definitions or span attributes
- The collector config changes exporters/processors
- You want more or different data coverage

Then commit the updated `.jsonl.gz` files.

## Data flow

```
Capture:  tracegen.py ──OTLP/gRPC──▶ EDOT collector ──file exporter──▶ *.jsonl.gz

Replay:   *.jsonl.gz ──otel-replay.mjs──OTLP/HTTP──▶ EDOT collector ──ES exporter──▶ Elasticsearch
```

## Indices created on replay

| Data stream | Signal | Source |
|------------|--------|--------|
| `traces-generic.otel-default` | Traces | tracegen spans |
| `metrics-hostmetricsreceiver.otel-default` | Metrics | host metrics |
| `logs-generic.otel-default` | Logs | synthetic logs |
