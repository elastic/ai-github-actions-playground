import { ElasticsearchClient } from "./es/client";
import type { ElasticsearchConnection } from "./es/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FieldInfo {
  name: string;
  type: string;
}

interface CacheEntry {
  fields: FieldInfo[];
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How long a cached schema is considered fresh. */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Maximum number of index patterns to keep in the cache. */
const MAX_CACHE_SIZE = 20;

/**
 * Maximum number of fields returned per index pattern to bound memory usage
 * and keep completion latency low for high-cardinality indices.
 */
export const MAX_FIELDS = 500;

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

const cache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<FieldInfo[]>>();

function cacheKey(connection: ElasticsearchConnection, indexPattern: string): string {
  return `${connection.url}|${connection.apiKey ?? ""}|${connection.username ?? ""}|${connection.password ?? ""}|${indexPattern}`;
}

function evictOldestIfNeeded(): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the field names and types for the given index pattern, fetching
 * from the cluster when the cache is cold or expired.  Falls back to an
 * empty array when the cluster is unreachable or the pattern returns no data.
 */
export async function getFieldsForIndex(
  connection: ElasticsearchConnection,
  indexPattern: string,
  signal?: AbortSignal,
): Promise<FieldInfo[]> {
  const key = cacheKey(connection, indexPattern);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.fields;
  }

  const pending = inFlightRequests.get(key);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    try {
      const client = new ElasticsearchClient(connection);
      const response = await client.getFieldCaps(indexPattern, undefined, signal);
      const seen = new Set<string>();
      const fields: FieldInfo[] = Object.entries(response.fields ?? {})
        .flatMap(([name, capabilities]) =>
          Object.values(capabilities).map((cap) => ({ name, type: cap.type ?? "unknown" })),
        )
        .filter((f) => {
          if (seen.has(f.name)) return false;
          seen.add(f.name);
          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, MAX_FIELDS);

      evictOldestIfNeeded();
      cache.set(key, { fields, expiresAt: now + CACHE_TTL_MS });
      return fields;
    } catch {
      return [];
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, request);
  return request;
}

/** invalidateSchema intentionally clears all cache/inFlightRequests keys prefixed by connection.url (not a single apiKey/username/password credential variant from cacheKey) so profile- or cluster-wide invalidation stays consistent. */
export function invalidateSchema(connection: ElasticsearchConnection): void {
  const prefix = `${connection.url}|`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
  for (const key of inFlightRequests.keys()) {
    if (key.startsWith(prefix)) {
      inFlightRequests.delete(key);
    }
  }
}

/** Exposed for testing only — clears the entire cache. */
export function _clearCacheForTesting(): void {
  cache.clear();
  inFlightRequests.clear();
}
