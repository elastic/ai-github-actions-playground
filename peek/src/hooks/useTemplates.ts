import { useQuery } from "@tanstack/react-query";

import type {
  GetIndexTemplatesResponse,
  GetComponentTemplatesResponse,
  IndexTemplateRow,
  ComponentTemplateRow,
} from "../services/es";
import type { DataFetchResult } from "../types/query";

import { useEsQuery, useRefetchOnConnectionChange } from "./useEsQuery";

export interface TemplatesData {
  indexTemplates: IndexTemplateRow[];
  componentTemplates: ComponentTemplateRow[];
}

function toTemplatesData(
  results: [GetIndexTemplatesResponse, GetComponentTemplatesResponse],
): TemplatesData {
  const [indexTemplatesResp, componentTemplatesResp] = results;
  const indexTemplatesList = indexTemplatesResp.index_templates ?? [];
  const componentTemplatesList = componentTemplatesResp.component_templates ?? [];

  const indexTemplates: IndexTemplateRow[] = indexTemplatesList.map((it) => ({
    name: it.name,
    indexPatterns: it.index_template.index_patterns ?? [],
    priority: it.index_template.priority ?? 0,
    composedOfCount: it.index_template.composed_of?.length ?? 0,
    composedOf: it.index_template.composed_of ?? [],
    dataStreamEnabled: Boolean(it.index_template.data_stream),
    version: it.index_template.version ?? "—",
    raw: it,
  }));

  // Build a map of component template names -> count of index templates using them
  const usageCount = new Map<string, number>();
  for (const it of indexTemplatesList) {
    for (const comp of it.index_template.composed_of ?? []) {
      usageCount.set(comp, (usageCount.get(comp) ?? 0) + 1);
    }
  }

  const componentTemplates: ComponentTemplateRow[] = componentTemplatesList.map((ct) => ({
    name: ct.name,
    hasMappings: Boolean(
      ct.component_template.template?.mappings &&
      Object.keys(ct.component_template.template.mappings).length > 0,
    ),
    hasSettings: Boolean(
      ct.component_template.template?.settings &&
      Object.keys(ct.component_template.template.settings).length > 0,
    ),
    hasAliases: Boolean(
      ct.component_template.template?.aliases &&
      Object.keys(ct.component_template.template.aliases).length > 0,
    ),
    version: ct.component_template.version ?? "—",
    usedByCount: usageCount.get(ct.name) ?? 0,
  }));

  return { indexTemplates, componentTemplates };
}

export function useTemplates(): DataFetchResult<TemplatesData> & { refresh: () => void } {
  const { connection, createQueryFn } = useEsQuery();
  const query = useQuery({
    queryKey: ["templates", connection?.url],
    queryFn: createQueryFn((client) =>
      Promise.all([client.getIndexTemplates(), client.getComponentTemplates()]),
    ),
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    select: toTemplatesData,
  });
  useRefetchOnConnectionChange(connection, query.refetch);

  const refresh = () => {
    void query.refetch();
  };

  if (!connection) return { status: "idle", refresh };
  if (query.isFetching) return { status: "loading", refresh };
  if (query.isError) return { status: "error", error: query.error.message, refresh };
  if (query.data) return { status: "success", data: query.data, refresh };
  return { status: "idle", refresh };
}
