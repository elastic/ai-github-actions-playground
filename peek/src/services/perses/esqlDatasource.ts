import { ElasticsearchClient } from "../es";
import type { ElasticsearchConnection, EsqlQueryParams, EsqlQueryResponse } from "../es";
import { buildQueryParams } from "../datemath";
import type { DashboardParameter, TimeRange } from "../../types";

export interface PersesEsqlDatasource {
  execute(
    request: EsqlQueryParams,
    signal?: AbortSignal,
  ): Promise<EsqlQueryResponse & { executionTimeMs: number }>;
}

export interface PersesVariableDefinition {
  name: string;
  label: string;
  kind: "string" | "number" | "boolean" | "datetime";
  value: string | number | boolean;
}

function variableKindForType(type: DashboardParameter["type"]): PersesVariableDefinition["kind"] {
  switch (type) {
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "date":
      return "datetime";
    case "keyword":
    default:
      return "string";
  }
}

function normalizeVariableValue(parameter: DashboardParameter): string | number | boolean {
  if (parameter.type !== "date") {
    return parameter.value;
  }
  const parsed = Date.parse(String(parameter.value));
  return Number.isNaN(parsed) ? String(parameter.value) : new Date(parsed).toISOString();
}

export function mapDashboardVariablesToPerses(
  parameters: DashboardParameter[] | undefined,
): PersesVariableDefinition[] {
  if (!parameters || parameters.length === 0) {
    return [];
  }
  return parameters.map((parameter) => ({
    name: parameter.name,
    label: parameter.label,
    kind: variableKindForType(parameter.type),
    value: normalizeVariableValue(parameter),
  }));
}

export function interpolatePersesVariableTokens(
  queryText: string,
  variables: PersesVariableDefinition[],
): string {
  if (!variables.length) {
    return queryText;
  }
  const values = new Map(variables.map((variable) => [variable.name, String(variable.value)]));
  return queryText.replace(/\{\{(\w+)\}\}/g, (token, name: string) => {
    const value = values.get(name);
    if (value === undefined) {
      return token;
    }
    // Escape single quotes by doubling them for ES|QL string literals
    return value.replace(/'/g, "''");
  });
}

export function buildPersesEsqlRequest(
  queryText: string,
  options: {
    timeRange?: TimeRange;
    parameters?: DashboardParameter[];
  },
): EsqlQueryParams {
  const variables = mapDashboardVariablesToPerses(options.parameters);
  const query = interpolatePersesVariableTokens(queryText.trim(), variables);
  const request: EsqlQueryParams = { query };
  if (!options.timeRange) {
    return request;
  }
  request.filter = {
    range: {
      "@timestamp": {
        gte: options.timeRange.from,
        lte: options.timeRange.to,
      },
    },
  };
  const params = buildQueryParams(query, options.timeRange, options.parameters);
  if (params.length > 0) {
    request.params = params;
  }
  return request;
}

export function createPersesEsqlDatasource(
  connection: ElasticsearchConnection,
): PersesEsqlDatasource {
  const client = new ElasticsearchClient(connection);
  return {
    execute: (request, signal) => client.query(request, signal),
  };
}
