import { isElasticsearchError, type ElasticsearchClient, type ElasticsearchError } from ".";

// ---------------------------------------------------------------------------
// Graceful search helper — returns null on 404 / index-not-found
// ---------------------------------------------------------------------------

export interface SearchResponse {
  hits?: {
    total?: { value?: number } | number;
    hits?: Array<{ _id?: string; _source?: Record<string, unknown> }>;
  };
  aggregations?: Record<string, unknown>;
}

export function extractSearchErrorMessage(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null) {
    const error = (body as Record<string, unknown>).error;
    if (typeof error === "object" && error !== null) {
      const reason = (error as Record<string, unknown>).reason;
      if (typeof reason === "string" && reason.length > 0) return reason;
      const rootCause = (error as Record<string, unknown>).root_cause;
      if (Array.isArray(rootCause) && rootCause.length > 0) {
        const firstReason = (rootCause[0] as Record<string, unknown>)?.reason;
        if (typeof firstReason === "string" && firstReason.length > 0) return firstReason;
      }
      const type = (error as Record<string, unknown>).type;
      if (typeof type === "string" && type.length > 0) return type;
    }
    const message = (body as Record<string, unknown>).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return `Elasticsearch search failed with status ${status}`;
}

export function isMissingIndexError(
  error: Pick<ElasticsearchError, "status" | "message" | "cause">,
): boolean {
  if (error.status !== 404) return false;
  const normalized = `${error.message} ${error.cause ?? ""}`.toLowerCase();
  return (
    normalized.includes("index_not_found_exception") ||
    normalized.includes("resource_not_found_exception") ||
    normalized.includes("no such index")
  );
}

export async function gracefulSearch(
  client: ElasticsearchClient,
  index: string,
  body: Record<string, unknown>,
): Promise<SearchResponse | null> {
  try {
    const response = await client.rawRequest(
      "POST",
      `/${index}/_search?ignore_unavailable=true&allow_no_indices=true`,
      JSON.stringify(body),
    );
    if (response.status >= 400) {
      const error = {
        status: response.status,
        message: extractSearchErrorMessage(response.body, response.status),
      } satisfies ElasticsearchError;
      if (isMissingIndexError(error)) return null;
      throw error;
    }
    return response.body as SearchResponse;
  } catch (error) {
    if (isElasticsearchError(error) && isMissingIndexError(error)) {
      return null;
    }
    throw error;
  }
}

export function extractHits(
  data: SearchResponse | null,
): Array<{ _id?: string; _source: Record<string, unknown> }> {
  if (!data?.hits?.hits) return [];
  return data.hits.hits.map((h) => ({ _id: h._id, _source: h._source ?? {} }));
}

export function extractTotal(data: SearchResponse | null): number {
  if (!data?.hits) return 0;
  const total = data.hits.total;
  if (typeof total === "number") return total;
  if (typeof total?.value === "number") return total.value;
  return data.hits.hits?.length ?? 0;
}
