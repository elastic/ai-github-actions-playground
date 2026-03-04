import {
  ElasticsearchClient,
  isElasticsearchError,
  type ElasticsearchConnection,
} from "../services/es";

/**
 * Shared helper that centralizes `ElasticsearchClient` construction and error
 * normalization for connection-bound page loaders.
 *
 * Returns `{ data: null, error: null }` when no connection is active,
 * `{ data: T, error: null }` on success, or `{ data: null, error: string }`
 * when the request throws.
 */
export async function runConnectionRequest<T>({
  connection,
  run,
}: {
  connection: ElasticsearchConnection | null | undefined;
  run: (client: ElasticsearchClient) => Promise<T>;
}): Promise<
  { data: T; error: null } | { data: null; error: string } | { data: null; error: null }
> {
  if (!connection) return { data: null, error: null };
  try {
    const client = new ElasticsearchClient(connection);
    return { data: await run(client), error: null };
  } catch (err: unknown) {
    return { data: null, error: isElasticsearchError(err) ? err.message : String(err) };
  }
}
