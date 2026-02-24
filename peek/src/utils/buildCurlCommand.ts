import type { ElasticsearchConnection } from "../services/es";

/** Escapes a value for safe use inside single-quoted shell arguments. */
function shellEscapeSingleQuote(value: string): string {
  return value.replace(/'/g, "'\\''");
}

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
  const baseUrl = (connection.proxyUrl || connection.url).replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  const parts: string[] = [`curl -X ${method} '${shellEscapeSingleQuote(url)}'`];

  parts.push(`-H 'Content-Type: application/json'`);

  if (connection.apiKey) {
    parts.push(`-H 'Authorization: ApiKey ${shellEscapeSingleQuote(connection.apiKey)}'`);
  } else if (connection.username && connection.password) {
    const user = shellEscapeSingleQuote(connection.username);
    const pass = shellEscapeSingleQuote(connection.password);
    parts.push(`-u '${user}:${pass}'`);
  }
  if (connection.proxyUrl) {
    parts.push(
      `-H 'X-Elastic-Peek-Proxy-Host: ${shellEscapeSingleQuote(connection.proxyHost || connection.url)}'`,
    );
    if (connection.proxyApiKey) {
      parts.push(
        `-H 'X-Elastic-Peek-Proxy-Api-Key: ${shellEscapeSingleQuote(connection.proxyApiKey)}'`,
      );
    }
  }

  if (body.trim()) {
    parts.push(`-d '${shellEscapeSingleQuote(body.trim())}'`);
  }

  return parts.join(" \\\n  ");
}
