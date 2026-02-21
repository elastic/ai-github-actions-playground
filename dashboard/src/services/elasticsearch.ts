import type { ElasticsearchConnection, EsqlResponse, EsqlError } from "../types";

export async function executeEsql(
  connection: ElasticsearchConnection,
  query: string,
  signal?: AbortSignal,
): Promise<EsqlResponse> {
  const baseUrl = connection.url.replace(/\/+$/, "");
  const url = `${baseUrl}/_query?format=json`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (connection.apiKey) {
    headers["Authorization"] = `ApiKey ${connection.apiKey}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
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

  return response.json();
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
