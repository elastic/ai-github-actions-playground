import { useCallback, useEffect, useRef, useState } from "react";

import type { ElasticsearchConnection, EsqlResponse } from "../../types";
import { useEsqlQuery } from "../../hooks/useEsqlQuery";

import type { RecentEntity } from "./InvestigateSuggestionsPanel";
import {
  type InvestigateTab,
  buildRecentEntitiesQuery,
  parseRecentEntities,
} from "./investigateUtils";

interface UseSuggestionsResult {
  visibleRecentEntities: RecentEntity[];
  suggestionsLoading: boolean;
}

export function useSuggestions(
  connection: ElasticsearchConnection | null,
  connectionKey: string | null,
  activeTab: InvestigateTab,
): UseSuggestionsResult {
  const [recentEntitiesByTab, setRecentEntitiesByTab] = useState<{
    user: { entities: RecentEntity[]; connectionKey: string | null };
    host: { entities: RecentEntity[]; connectionKey: string | null };
  }>({
    user: { entities: [], connectionKey: null },
    host: { entities: [], connectionKey: null },
  });
  const suggestionsLoadedRef = useRef<{ user: boolean; host: boolean }>({
    user: false,
    host: false,
  });
  const suggestionsRequestTabRef = useRef<InvestigateTab>("user");

  const handleSuggestionsSuccess = useCallback(
    (data: EsqlResponse) => {
      const tab = suggestionsRequestTabRef.current;
      setRecentEntitiesByTab((previous) => ({
        ...previous,
        [tab]: { entities: parseRecentEntities(data, tab), connectionKey },
      }));
      suggestionsLoadedRef.current[tab] = true;
    },
    [connectionKey],
  );

  const handleSuggestionsFailure = useCallback(() => {
    const tab = suggestionsRequestTabRef.current;
    setRecentEntitiesByTab((previous) => ({
      ...previous,
      [tab]: { entities: [], connectionKey },
    }));
    suggestionsLoadedRef.current[tab] = true;
  }, [connectionKey]);

  const { runQuery: runSuggestionsQuery, loading: suggestionsLoading } = useEsqlQuery({
    connection,
    onSuccess: handleSuggestionsSuccess,
    onFailure: handleSuggestionsFailure,
  });

  useEffect(() => {
    suggestionsLoadedRef.current = { user: false, host: false };
  }, [connectionKey]);

  useEffect(() => {
    if (connection && !suggestionsLoading && !suggestionsLoadedRef.current[activeTab]) {
      suggestionsRequestTabRef.current = activeTab;
      runSuggestionsQuery(buildRecentEntitiesQuery(activeTab));
    }
  }, [connection, activeTab, runSuggestionsQuery, suggestionsLoading]);

  const visibleRecentEntities =
    recentEntitiesByTab[activeTab].connectionKey === connectionKey
      ? recentEntitiesByTab[activeTab].entities
      : [];

  return { visibleRecentEntities, suggestionsLoading };
}
