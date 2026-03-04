import { tool } from "ai";
import type { ToolSet } from "ai";
import { z } from "zod";

import { useQueryStore } from "../store/useQueryStore";
import { useDashboardStore } from "../store/useDashboardStore";
import { PAGE_MANIFEST, type PageId } from "../routes/manifest";
import { openInDiscover } from "../hooks/useOpenInDiscover";
import type { ElasticsearchConnection } from "../types";

import type { EsqlQueryParams } from "./es";
import { ElasticsearchClient } from "./es";
import { buildDetailedScreenContext } from "./screenContext";
import {
  MAX_TOOL_ROW_LIMIT,
  MAX_TOOL_ROWS_RETURNED,
  MAX_TOOL_COLUMNS_RETURNED,
  MAX_RAW_RESPONSE_LENGTH,
  ensureQueryLimit,
  clampToolRowLimit,
  truncateCellValue,
  runWithToolTimeout,
} from "./chatPromptUtils";

const ALLOWED_RAW_METHODS = ["GET"] as const;

export function getLocalChatTools(connection: ElasticsearchConnection | null): ToolSet {
  if (!connection) return {};

  return {
    run_esql_query: tool({
      description:
        "Run an ES|QL query against the active Elasticsearch connection and return bounded results.",
      inputSchema: z.object({
        query: z.string().min(1),
        profile: z.boolean().optional(),
        rowLimit: z.number().int().min(1).max(MAX_TOOL_ROW_LIMIT).optional(),
      }),
      execute: async ({ query, profile, rowLimit }) => {
        const trimmedQuery = query.trim();
        const normalizedQuery = trimmedQuery.replace(/\s*;\s*$/, "");
        if (!normalizedQuery) {
          throw new Error("Query must not be empty");
        }
        const boundedQuery = ensureQueryLimit(trimmedQuery, clampToolRowLimit(rowLimit));
        const client = new ElasticsearchClient(connection);
        const request: EsqlQueryParams = { query: boundedQuery };
        if (profile) request.profile = true;
        return runWithToolTimeout(async (signal) => {
          const response = await client.query(request, signal);
          let truncated =
            response.values.length > MAX_TOOL_ROWS_RETURNED ||
            response.columns.length > MAX_TOOL_COLUMNS_RETURNED ||
            response.values.some((row) => row.length > MAX_TOOL_COLUMNS_RETURNED);

          const columns = response.columns.slice(0, MAX_TOOL_COLUMNS_RETURNED);
          const values = response.values.slice(0, MAX_TOOL_ROWS_RETURNED).map((row) =>
            row.slice(0, MAX_TOOL_COLUMNS_RETURNED).map((cell) => {
              const next = truncateCellValue(cell);
              if (next.truncated) truncated = true;
              return next.value;
            }),
          );

          return {
            query: boundedQuery,
            columns,
            values,
            rowCount: response.values.length,
            executionTimeMs: response.executionTimeMs,
            truncated,
          };
        });
      },
    }),

    get_cluster_health: tool({
      description:
        "Get current cluster health status, node count, shard allocation summary, and pending tasks.",
      inputSchema: z.object({
        include_node_stats: z
          .boolean()
          .optional()
          .describe("When true, includes cluster-wide node statistics."),
      }),
      execute: async ({ include_node_stats }) => {
        const client = new ElasticsearchClient(connection);
        return runWithToolTimeout(async (signal) => {
          const health = await client.getClusterHealth("cluster", signal);
          if (include_node_stats) {
            const stats = await client.getClusterStats(signal);
            return { health, stats };
          }
          return { health };
        });
      },
    }),

    get_index_info: tool({
      description: "Get details about a specific index: mappings, settings, stats, and health.",
      inputSchema: z.object({
        index: z.string().min(1).describe("Name of the index to inspect."),
      }),
      execute: async ({ index }) => {
        const normalizedIndex = index.trim();
        if (!normalizedIndex) {
          throw new Error("Index must not be empty");
        }
        const client = new ElasticsearchClient(connection);
        return runWithToolTimeout(async (signal) => {
          const [mappings, settings, stats, health] = await Promise.all([
            client.getIndexMappings(normalizedIndex, signal),
            client.getIndexSettings(normalizedIndex, signal),
            client.getIndexStats(normalizedIndex, signal),
            client.rawRequest(
              "GET",
              `/_cluster/health/${encodeURIComponent(normalizedIndex)}`,
              undefined,
              signal,
            ),
          ]);
          return { index: normalizedIndex, mappings, settings, stats, health: health.body };
        });
      },
    }),

    run_raw_es_request: tool({
      description:
        "Execute a read-only Elasticsearch REST API request (GET only). Use for read APIs not covered by other tools.",
      inputSchema: z.object({
        method: z.enum(ALLOWED_RAW_METHODS),
        path: z.string().min(1).describe("REST API path (e.g. '/_cat/nodes?v')."),
        body: z.string().optional().describe("Optional JSON request body."),
      }),
      execute: async ({ method, path, body }) => {
        const trimmedPath = path.trim();
        if (!trimmedPath) {
          throw new Error("Path must not be empty");
        }
        const normalizedPath = trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`;
        const client = new ElasticsearchClient(connection);
        return runWithToolTimeout(async (signal) => {
          const result = await client.rawRequest(method, normalizedPath, body, signal);
          let serialized: string;
          if (typeof result.body === "string") {
            serialized = result.body;
          } else {
            try {
              serialized = JSON.stringify(result.body ?? null);
            } catch {
              serialized = String(result.body);
            }
          }
          if (serialized.length > MAX_RAW_RESPONSE_LENGTH) {
            return {
              status: result.status,
              body: `${serialized.slice(0, MAX_RAW_RESPONSE_LENGTH)}…`,
              truncated: true,
            };
          }
          return result;
        });
      },
    }),

    explain_ingest_pipeline: tool({
      description:
        "Get the definition of a named ingest pipeline and optionally simulate it with a sample document.",
      inputSchema: z.object({
        pipeline_name: z.string().min(1).describe("Name of the ingest pipeline to inspect."),
        sample_doc: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Optional sample document to simulate through the pipeline."),
      }),
      execute: async ({ pipeline_name, sample_doc }) => {
        const normalizedPipelineName = pipeline_name.trim();
        if (!normalizedPipelineName) {
          throw new Error("Pipeline name must not be empty");
        }
        const client = new ElasticsearchClient(connection);
        return runWithToolTimeout(async (signal) => {
          const pipelines = await client.getIngestPipelines(signal);
          const definition = pipelines[normalizedPipelineName];
          if (!definition) {
            return { error: `Pipeline '${normalizedPipelineName}' not found` };
          }
          if (sample_doc) {
            const simulation = await client.simulateIngestPipeline(
              normalizedPipelineName,
              [{ _source: sample_doc }],
              { verbose: true },
              signal,
            );
            return { pipeline_name: normalizedPipelineName, definition, simulation };
          }
          return { pipeline_name: normalizedPipelineName, definition };
        });
      },
    }),
  };
}

/** Page keys that the LLM can navigate to (excludes detail routes with params). */
const NAVIGABLE_PAGES = Object.entries(PAGE_MANIFEST)
  .filter(([, config]) => !config.path.includes(":"))
  .map(([key]) => key) as [PageId, ...PageId[]];

function normalizeNonEmptyQuery(query: string): string {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("Query must not be empty");
  }
  return trimmedQuery;
}

export function getScreenContextTool(getPathname: () => string): ToolSet {
  return {
    get_screen_context: tool({
      description:
        "Get a snapshot of what the user currently sees — page, panels, queries, time range, filters, and visible data summaries.",
      inputSchema: z.object({
        include_data: z
          .boolean()
          .optional()
          .describe("When true, includes panel queries and result summaries."),
      }),
      execute: async ({ include_data }) => buildDetailedScreenContext(getPathname(), include_data),
    }),
  };
}

export function getBrowserControlTools(navigate?: (path: string) => void): ToolSet {
  if (!navigate) return {};

  return {
    navigate_to_page: tool({
      description:
        "Navigate to a page in the Elastic Peek app. Use this when the user asks to go to a specific page.",
      inputSchema: z.object({
        page: z.enum(NAVIGABLE_PAGES).describe("Page identifier to navigate to."),
      }),
      execute: async ({ page }) => {
        const config = PAGE_MANIFEST[page];
        navigate(config.path);
        return { navigated: page, path: config.path, label: config.nav.label };
      },
    }),

    set_query_lab_query: tool({
      description:
        "Set an ES|QL query in the Query Lab editor. This sets the draft query but does not run it — the user can review and execute it.",
      inputSchema: z.object({
        query: z.string().min(1).describe("The ES|QL query to set in the Query Lab editor."),
      }),
      execute: async ({ query }) => {
        const trimmedQuery = normalizeNonEmptyQuery(query);
        openInDiscover(navigate, trimmedQuery);
        return { set: true, navigatedTo: "discover" };
      },
    }),

    set_time_range: tool({
      description:
        "Set the active time range on the current dashboard. Uses date-math expressions (e.g. 'now-15m', 'now-1h', 'now').",
      inputSchema: z.object({
        from: z
          .string()
          .regex(
            /^now([/+-]\w+)*$|^\d{4}-\d{2}-\d{2}/,
            "Must be a date-math expression (e.g. 'now-1h', 'now/d') or ISO date.",
          )
          .describe("Start of the time range (e.g. 'now-1h')."),
        to: z
          .string()
          .regex(
            /^now([/+-]\w+)*$|^\d{4}-\d{2}-\d{2}/,
            "Must be a date-math expression (e.g. 'now', 'now+1d') or ISO date.",
          )
          .describe("End of the time range (e.g. 'now')."),
      }),
      execute: async ({ from, to }) => {
        useDashboardStore.getState().setTimeRange({ from, to });
        return { set: true, from, to };
      },
    }),

    generate_esql_query: tool({
      description:
        "Draft an ES|QL query in the Query Lab editor. Accepts a fully-formed ES|QL query string and optionally navigates to Query Lab for the user to review and execute.",
      inputSchema: z.object({
        query: z.string().min(1).describe("The ES|QL query to set in the Query Lab editor."),
        navigate_to_query_lab: z
          .boolean()
          .optional()
          .describe("When true, navigate to the Query Lab page after setting the query."),
      }),
      execute: async ({ query, navigate_to_query_lab }) => {
        const trimmedQuery = normalizeNonEmptyQuery(query);
        if (navigate_to_query_lab) {
          openInDiscover(navigate, trimmedQuery);
        } else {
          useQueryStore.getState().setDiscoverQueryDraft(trimmedQuery);
        }
        return { set: true, navigatedTo: navigate_to_query_lab ? "discover" : undefined };
      },
    }),
  };
}
