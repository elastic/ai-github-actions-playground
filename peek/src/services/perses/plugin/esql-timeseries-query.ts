import type { TimeSeriesData } from "@perses-dev/core";
import type { TimeSeriesQueryPlugin, TimeSeriesQueryContext } from "@perses-dev/plugin-system";

import { buildTimeParams } from "../../datemath";
import type { EsqlQueryParams } from "../../es";
import { toTimeSeriesData } from "../dataTransformers";

import type { ElasticsearchDatasourceClient } from "./elasticsearch-datasource";
import { ELASTICSEARCH_DATASOURCE_KIND } from "./elasticsearch-datasource";

/**
 * Spec for an ES|QL time-series query.
 *
 * The query string may contain `{{variable}}` tokens that are interpolated
 * from the Perses variable state at runtime.
 */
export interface ESQLTimeSeriesQuerySpec {
  /** ES|QL query text (e.g. "FROM metrics-* | STATS avg(value) BY @timestamp"). */
  query: string;
  /** Optional datasource name. Omit to use the default Elasticsearch datasource. */
  datasource?: string;
}

function interpolateVariables(
  query: string,
  variableState: TimeSeriesQueryContext["variableState"],
): string {
  return query.replace(/\{\{([^{}\s]+)\}\}/g, (_token, name: string) => {
    const state = variableState[name];
    if (!state || state.value === undefined || state.value === null) {
      throw new Error(`Missing ES|QL variable: ${name}`);
    }
    const rawValue = state.value;
    const value = Array.isArray(rawValue) ? rawValue.map(String).join(",") : String(rawValue);
    return value.replace(/'/g, "''");
  });
}

/**
 * Perses TimeSeriesQueryPlugin for ES|QL.
 *
 * Executes an ES|QL query via the Elasticsearch datasource client and
 * transforms the columnar response into Perses `TimeSeriesData` using
 * the existing `toTimeSeriesData` transformer.
 */
export const ESQLTimeSeriesQuery: TimeSeriesQueryPlugin<ESQLTimeSeriesQuerySpec> = {
  createInitialOptions: () => ({
    query:
      "FROM metrics-* | STATS avg(value) BY @timestamp = BUCKET(@timestamp, 50, ?_tstart, ?_tend)",
  }),

  async getTimeSeriesData(
    spec: ESQLTimeSeriesQuerySpec,
    ctx: TimeSeriesQueryContext,
    signal?: AbortSignal,
  ): Promise<TimeSeriesData> {
    const client = await ctx.datasourceStore.getDatasourceClient<ElasticsearchDatasourceClient>({
      kind: ELASTICSEARCH_DATASOURCE_KIND,
      name: spec.datasource,
    });

    const interpolated = interpolateVariables(spec.query.trim(), ctx.variableState);

    const request: EsqlQueryParams = { query: interpolated };

    if (ctx.timeRange) {
      const timeRange = {
        from: ctx.timeRange.start.toISOString(),
        to: ctx.timeRange.end.toISOString(),
      };
      request.filter = {
        range: {
          "@timestamp": {
            gte: timeRange.from,
            lte: timeRange.to,
          },
        },
      };
      const params = buildTimeParams(interpolated, timeRange);
      if (Object.keys(params).length > 0) {
        request.params = params;
      }
    }

    const response = await client.query(request, signal);

    return toTimeSeriesData(response);
  },

  dependsOn(spec: ESQLTimeSeriesQuerySpec) {
    const variables = new Set<string>();
    const pattern = /\{\{([^{}\s]+)\}\}/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(spec.query)) !== null) {
      if (match[1]) {
        variables.add(match[1]);
      }
    }
    return { variables: [...variables] };
  },
};

export const ESQL_TIME_SERIES_QUERY_KIND = "ESQLTimeSeriesQuery";
