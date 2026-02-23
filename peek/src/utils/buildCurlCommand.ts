import type { ElasticsearchConnection } from "../services/es";

/**
 * Builds a runnable cURL command from the current API Console request and the
 * active Elasticsearch connection (including auth headers).
 */
export function buildCurlCommand(
  connection: ElasticsearchConnection,
  method: string,
  path: string,
  body: string,
): string {
  const baseUrl = connection.url.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  const parts: string[] = [`curl -X ${method} '${url}'`];

  parts.push(`-H 'Content-Type: application/json'`);

  if (connection.apiKey) {
    parts.push(`-H 'Authorization: ApiKey ${connection.apiKey}'`);
  } else if (connection.username && connection.password) {
    parts.push(`-u '${connection.username}:${connection.password}'`);
  }

  if (body.trim()) {
    parts.push(`-d '${body.trim()}'`);
  }

  return parts.join(" \\\n  ");
}
