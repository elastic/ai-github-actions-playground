import type { ElasticsearchConnection } from "../types";

/**
 * Simple DJB2a string hash returning a base-36 string.
 */
function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Derives a stable, hashed fingerprint from an Elasticsearch connection.
 *
 * Covers all auth-relevant fields so that credential or proxy changes
 * are visible to React Query cache keys without leaking raw secrets.
 */
export function getConnectionFingerprint(
  connection: ElasticsearchConnection | null,
): string | null {
  if (!connection) return null;
  return hashString(
    [
      connection.url,
      connection.apiKey ?? "",
      connection.username ?? "",
      connection.password ?? "",
      connection.proxyUrl ?? "",
    ].join("|"),
  );
}
