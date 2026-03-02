import { resolveToPositionalParams } from "../datemath";
import type { DashboardParameter, TimeRange } from "../../types";

import type { EsqlQueryParams } from "./client";

export interface BuildEsqlRequestOptions {
  timeRange?: TimeRange;
  parameters?: DashboardParameter[];
  includeTimeRangeFilter?: boolean;
}

export function buildEsqlRequest(
  queryText: string,
  options: BuildEsqlRequestOptions = {},
): EsqlQueryParams {
  const { timeRange, parameters, includeTimeRangeFilter = false } = options;
  const body: EsqlQueryParams = { query: queryText };
  if (!timeRange) return body;
  if (includeTimeRangeFilter) {
    body.filter = {
      range: {
        "@timestamp": {
          gte: timeRange.from,
          lte: timeRange.to,
        },
      },
    };
  }
  const { query: resolvedQuery, params } = resolveToPositionalParams(
    queryText,
    timeRange,
    parameters,
  );
  body.query = resolvedQuery;
  if (params.length > 0) body.params = params;
  return body;
}
