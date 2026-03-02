import type { components, operations } from "./types.generated";

// ---------------------------------------------------------------------------
// ES|QL types derived from the generated OpenAPI spec
// ---------------------------------------------------------------------------

export type EsqlColumn = components["schemas"]["esql._types.EsqlColumnInfo"];
export type EsqlResult = components["schemas"]["esql._types.EsqlResult"];
export type AsyncEsqlResult = components["schemas"]["esql._types.AsyncEsqlResult"];

/** Request body for POST /_query */
export type EsqlQueryRequest =
  operations["esql-query"]["requestBody"]["content"]["application/json"];

/**
 * Practical query params — the OpenAPI-generated filter type requires fields
 * like `boost` that Elasticsearch treats as optional. This relaxed type lets
 * callers pass plain query-DSL objects for the filter while keeping the rest
 * of the request fully typed.
 */
export type EsqlQueryParams = Omit<EsqlQueryRequest, "filter" | "params"> & {
  filter?: Record<string, unknown>;
  params?: Record<string, string | number | boolean> | EsqlQueryRequest["params"];
};

/** Response from POST /_query */
export type EsqlQueryResponse =
  operations["esql-query"]["responses"][200]["content"]["application/json"];

/**
 * Backward-compatible alias — matches the shape components were already using.
 * `EsqlResult` has `columns` and `values` which is what `EsqlResponse` was.
 */
export type EsqlResponse = EsqlResult;
