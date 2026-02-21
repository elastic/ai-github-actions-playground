#!/usr/bin/env node

/**
 * Downloads the official Elasticsearch OpenAPI spec and filters it to only
 * the endpoints and schemas used by Elastic Peek.
 *
 * Usage:  node scripts/filter-es-openapi.mjs
 * Output: src/services/es/elasticsearch-esql.openapi.json
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SPEC_URL =
  "https://raw.githubusercontent.com/elastic/elasticsearch-specification/main/output/openapi/elasticsearch-openapi.json";

/** Paths we want to keep (OpenAPI path format). */
const KEEP_PATHS = [
  "/_query",
  "/_query/async",
  "/_query/async/{id}",
  "/_query/async/{id}/stop",
  "/_resolve/index/{name}",
  "/{index}",
  "/{index}/_mapping",
  "/_data_stream",
  "/_data_stream/{name}",
  "/{index}/_field_caps",
  "/",
];

/**
 * Recursively walk a value and collect all `$ref` strings.
 */
function collectRefs(value, refs = new Set()) {
  if (value === null || value === undefined) return refs;
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      for (const item of value) collectRefs(item, refs);
    } else {
      for (const [key, val] of Object.entries(value)) {
        if (key === "$ref" && typeof val === "string") {
          refs.add(val);
        } else {
          collectRefs(val, refs);
        }
      }
    }
  }
  return refs;
}

/**
 * Resolve a JSON pointer like "#/components/schemas/Foo" against the spec.
 */
function resolvePointer(spec, ref) {
  if (!ref.startsWith("#/")) return undefined;
  const parts = ref.slice(2).split("/").map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let current = spec;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Starting from initial $refs, walk the entire reference graph and return
 * all visited $ref strings.
 */
function resolveAllRefs(spec, initialRefs) {
  const visited = new Set();
  const queue = [...initialRefs];

  while (queue.length > 0) {
    const ref = queue.pop();
    if (visited.has(ref)) continue;
    visited.add(ref);

    const target = resolvePointer(spec, ref);
    if (!target) continue;

    const nestedRefs = collectRefs(target);
    for (const nested of nestedRefs) {
      if (!visited.has(nested)) queue.push(nested);
    }
  }

  return visited;
}

/**
 * Pick keys from an object that match a set of $ref prefixes.
 */
function pickByRefs(obj, refs, prefix) {
  if (!obj) return {};
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const ref = `#/${prefix}/${key}`;
    if (refs.has(ref)) {
      result[key] = value;
    }
  }
  return result;
}

async function main() {
  console.log("Downloading Elasticsearch OpenAPI spec...");
  const response = await fetch(SPEC_URL);
  if (!response.ok) {
    throw new Error(`Failed to download spec: ${response.status} ${response.statusText}`);
  }
  const spec = await response.json();
  console.log(`Downloaded spec with ${Object.keys(spec.paths ?? {}).length} paths`);

  // Filter paths
  const filteredPaths = {};
  for (const pattern of KEEP_PATHS) {
    if (spec.paths[pattern]) {
      filteredPaths[pattern] = spec.paths[pattern];
    } else {
      console.warn(`  ⚠ Path not found in spec: ${pattern}`);
    }
  }

  console.log(`Kept ${Object.keys(filteredPaths).length} paths`);

  // Collect all $refs from kept paths and walk the full reference graph
  const pathRefs = collectRefs(filteredPaths);
  const allRefs = resolveAllRefs(spec, pathRefs);

  // Filter each components section to only referenced items
  const filteredSchemas = pickByRefs(spec.components?.schemas, allRefs, "components/schemas");
  const filteredParams = pickByRefs(spec.components?.parameters, allRefs, "components/parameters");
  const filteredResponses = pickByRefs(spec.components?.responses, allRefs, "components/responses");
  const filteredRequestBodies = pickByRefs(
    spec.components?.requestBodies,
    allRefs,
    "components/requestBodies",
  );

  console.log(
    `Kept ${Object.keys(filteredSchemas).length} schemas, ` +
      `${Object.keys(filteredParams).length} parameters, ` +
      `${Object.keys(filteredResponses).length} responses, ` +
      `${Object.keys(filteredRequestBodies).length} request bodies`,
  );

  // Build the filtered spec
  const filtered = {
    openapi: spec.openapi,
    info: spec.info,
    paths: filteredPaths,
    components: {
      schemas: filteredSchemas,
      parameters: filteredParams,
      responses: filteredResponses,
      requestBodies: filteredRequestBodies,
    },
  };

  const outPath = resolve(__dirname, "../src/services/es/elasticsearch-esql.openapi.json");
  writeFileSync(outPath, JSON.stringify(filtered, null, 2) + "\n");
  console.log(`Wrote filtered spec to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
