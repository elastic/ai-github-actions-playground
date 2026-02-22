import type { ElasticsearchConnection, EsqlResponse, EsqlError, TimeRange } from "../types";
import { resolveDateTime } from "./datemath";

export async function executeEsql(
  connection: ElasticsearchConnection,
  query: string,
  signal?: AbortSignal,
  timeRange?: TimeRange,
): Promise<EsqlResponse & { executionTimeMs: number }> {
  const baseUrl = connection.url.replace(/\/+$/, "");
  const url = `${baseUrl}/_query?format=json`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (connection.username && connection.password) {
    const bytes = new TextEncoder().encode(`${connection.username}:${connection.password}`);
    const credentials = btoa(String.fromCharCode(...bytes));
    headers["Authorization"] = `Basic ${credentials}`;
  } else if (connection.apiKey) {
    headers["Authorization"] = `ApiKey ${connection.apiKey}`;
  }

  const body: Record<string, unknown> = { query };
  if (timeRange) {
    body.filter = {
      range: {
        "@timestamp": {
          gte: timeRange.from,
          lte: timeRange.to,
        },
      },
    };

    // Populate ?_tstart / ?_tend named parameters that Kibana normally provides.
    const params = buildTimeParams(query, timeRange);
    if (params.length > 0) {
      body.params = params;
    }
  }

  const start = Date.now();
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const esqlError: EsqlError = {
      status: response.status,
      message:
        body?.error?.reason ??
        body?.error?.root_cause?.[0]?.reason ??
        body?.message ??
        response.statusText,
      cause: body?.error?.caused_by?.reason,
    };
    throw esqlError;
  }

  const data = (await response.json()) as EsqlResponse;
  return { ...data, executionTimeMs: Date.now() - start };
}

/**
 * Test the connection by running a minimal ES|QL query.
 * Returns the cluster version info on success.
 */
export async function testConnection(
  connection: ElasticsearchConnection,
): Promise<{ ok: true; indices: string[] } | { ok: false; error: string }> {
  try {
    const result = await executeEsql(connection, "SHOW INFO");
    return {
      ok: true,
      indices: result.values.map((row) => String(row[0])),
    };
  } catch (err: unknown) {
    const message = isEsqlError(err) ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export function isEsqlError(err: unknown): err is EsqlError {
  return typeof err === "object" && err !== null && "status" in err && "message" in err;
}

/**
 * Build ES|QL named-parameter entries for `_tstart` / `_tend` when the
 * query references them.  Returns an empty array when neither placeholder
 * is present.
 */
export function buildTimeParams(
  query: string,
  timeRange: TimeRange,
): Array<Record<string, string>> {
  const needs_tstart = query.includes("?_tstart");
  const needs_tend = query.includes("?_tend");
  if (!needs_tstart && !needs_tend) return [];

  const now = new Date();
  const params: Array<Record<string, string>> = [];

  if (needs_tstart) {
    const resolved = resolveDateTime(timeRange.from, now);
    if (resolved) params.push({ _tstart: resolved.toISOString() });
  }
  if (needs_tend) {
    const resolved = resolveDateTime(timeRange.to, now);
    if (resolved) params.push({ _tend: resolved.toISOString() });
  }

  return params;
}
