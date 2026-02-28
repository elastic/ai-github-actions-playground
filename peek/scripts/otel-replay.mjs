/**
 * otel-replay.mjs
 *
 * Reads captured OTLP JSON Lines fixture files, rewrites all timestamps to be
 * relative to "now", and sends them via OTLP/HTTP to a running collector.
 *
 * This lets us replay realistic OTel data (traces, metrics, logs) captured
 * from the live tracegen/otelgen stack into a fresh Elasticsearch, without
 * running the generators again.
 *
 * Usage:
 *   node scripts/otel-replay.mjs
 *   node scripts/otel-replay.mjs --endpoint http://localhost:4318
 *   node scripts/otel-replay.mjs --fixtures-dir fixtures/otlp
 */

import { readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    endpoint: process.env.OTEL_ENDPOINT ?? "http://localhost:4318",
    fixturesDir: join(import.meta.dirname, "..", "fixtures", "otlp"),
    waitForReady: true,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--endpoint" && argv[i + 1]) opts.endpoint = argv[++i];
    if (argv[i] === "--fixtures-dir" && argv[i + 1])
      opts.fixturesDir = resolve(argv[++i]);
    if (argv[i] === "--no-wait") opts.waitForReady = false;
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Timestamp rewriting
//
// OTLP JSON uses nanosecond-precision timestamps as strings:
//   "timeUnixNano": "1719000000000000000"
//   "startTimeUnixNano": "1719000000000000000"
//   "observedTimeUnixNano": "1719000000000000000"
//
// We find the max timestamp across all files, compute an offset to shift it
// to "now - 5 minutes", then apply that offset to every timestamp field.
// ---------------------------------------------------------------------------

const TIMESTAMP_KEYS = new Set([
  "timeUnixNano",
  "startTimeUnixNano",
  "endTimeUnixNano",
  "observedTimeUnixNano",
  "time_unix_nano",
  "start_time_unix_nano",
  "end_time_unix_nano",
  "observed_time_unix_nano",
]);

/** Recursively find all timestamp values in an OTLP JSON object. */
function collectTimestamps(obj, out = []) {
  if (obj === null || typeof obj !== "object") return out;
  if (Array.isArray(obj)) {
    for (const item of obj) collectTimestamps(item, out);
    return out;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (TIMESTAMP_KEYS.has(key) && value != null && value !== "") {
      out.push(BigInt(value));
    } else {
      collectTimestamps(value, out);
    }
  }
  return out;
}

/** Recursively shift all timestamp values by offsetNs. */
function shiftTimestamps(obj, offsetNs) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    for (const item of obj) shiftTimestamps(item, offsetNs);
    return obj;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (TIMESTAMP_KEYS.has(key) && value != null && value !== "") {
      obj[key] = String(BigInt(value) + offsetNs);
    } else {
      shiftTimestamps(value, offsetNs);
    }
  }
  return obj;
}

/** Read a .jsonl or .jsonl.gz file and return parsed JSON objects. */
function readJsonLines(filePath) {
  // Try .gz first, then uncompressed
  const gzPath = filePath + ".gz";
  let content;
  if (existsSync(gzPath)) {
    content = gunzipSync(readFileSync(gzPath)).toString("utf-8");
  } else if (existsSync(filePath)) {
    content = readFileSync(filePath, "utf-8");
  } else {
    return [];
  }
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

// ---------------------------------------------------------------------------
// Wait for collector
// ---------------------------------------------------------------------------

async function waitForCollector(endpoint, maxWaitMs = 60_000) {
  // Try sending a small test request to the OTLP endpoint itself
  const testUrl = `${endpoint}/v1/traces`;
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(testUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceSpans: [] }),
      });
      if (res.ok) {
        console.log("  Collector is ready.");
        return;
      }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error(`Collector at ${endpoint} did not become ready within ${maxWaitMs / 1000}s`);
}

// ---------------------------------------------------------------------------
// Send via OTLP/HTTP
// ---------------------------------------------------------------------------

async function sendOtlp(endpoint, signal, payload) {
  const url = `${endpoint}/v1/${signal}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OTLP ${signal} POST failed (${res.status}): ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`Replaying OTLP fixtures from ${opts.fixturesDir}`);
  console.log(`  → Collector: ${opts.endpoint}`);

  // Read all fixture files
  const fixtures = {
    traces: readJsonLines(join(opts.fixturesDir, "traces.jsonl")),
    metrics: readJsonLines(join(opts.fixturesDir, "metrics.jsonl")),
    logs: readJsonLines(join(opts.fixturesDir, "logs.jsonl")),
  };

  const totalRecords =
    fixtures.traces.length + fixtures.metrics.length + fixtures.logs.length;
  console.log(
    `  Found: ${fixtures.traces.length} trace batches, ` +
      `${fixtures.metrics.length} metric batches, ` +
      `${fixtures.logs.length} log batches`
  );

  if (totalRecords === 0) {
    console.error(
      "No fixture files found. Run `make otel-capture` to generate them."
    );
    process.exit(1);
  }

  // Find the max timestamp across all fixtures to compute offset
  const allTimestamps = [];
  for (const records of Object.values(fixtures)) {
    for (const record of records) {
      collectTimestamps(record, allTimestamps);
    }
  }

  if (allTimestamps.length === 0) {
    console.error("No timestamps found in fixture files.");
    process.exit(1);
  }

  const maxTs = allTimestamps.reduce((a, b) => (a > b ? a : b));
  const nowNs = BigInt(Date.now()) * 1_000_000n;
  // Shift so the newest data point is 5 minutes ago (gives a realistic window)
  const targetNs = nowNs - 5n * 60n * 1_000_000_000n;
  const offsetNs = targetNs - maxTs;

  const offsetMinutes = Number(offsetNs / 1_000_000_000n / 60n);
  console.log(`  Shifting timestamps by ${offsetMinutes} minutes`);

  // Apply timestamp shift to all records
  for (const records of Object.values(fixtures)) {
    for (const record of records) {
      shiftTimestamps(record, offsetNs);
    }
  }

  // Wait for collector
  if (opts.waitForReady) {
    console.log("  Waiting for collector...");
    await waitForCollector(opts.endpoint);
  }

  // Send traces
  if (fixtures.traces.length > 0) {
    console.log(`  Sending ${fixtures.traces.length} trace batches...`);
    for (const batch of fixtures.traces) {
      await sendOtlp(opts.endpoint, "traces", batch);
    }
    console.log("  Traces sent.");
  }

  // Send metrics
  if (fixtures.metrics.length > 0) {
    console.log(`  Sending ${fixtures.metrics.length} metric batches...`);
    for (const batch of fixtures.metrics) {
      await sendOtlp(opts.endpoint, "metrics", batch);
    }
    console.log("  Metrics sent.");
  }

  // Send logs
  if (fixtures.logs.length > 0) {
    console.log(`  Sending ${fixtures.logs.length} log batches...`);
    for (const batch of fixtures.logs) {
      await sendOtlp(opts.endpoint, "logs", batch);
    }
    console.log("  Logs sent.");
  }

  console.log("\nReplay complete.");
}

run().catch((err) => {
  console.error("Replay failed:", err.message ?? err);
  process.exit(1);
});
