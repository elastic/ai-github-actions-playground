import { useCallback, useEffect, useRef, useState } from "react";

import type { ElasticsearchConnection, EsqlResponse } from "../../types";
import { useEsqlQuery } from "../../hooks/useEsqlQuery";

import type { RecentEntity } from "./InvestigateSuggestionsPanel";
import type { InvestigateTab } from "./investigateUtils";
import { buildRecentEntitiesQuery } from "./investigateQueryBuilder";
import { parseRecentEntities } from "./investigateParser";

interface TabCache {
  entities: RecentEntity[];
  connectionKey: string | null;
}

const EMPTY_TAB_CACHE: TabCache = { entities: [], connectionKey: null };

function makeEmptyCache(): Record<InvestigateTab, TabCache> {
  return {
    user: { ...EMPTY_TAB_CACHE },
    host: { ...EMPTY_TAB_CACHE },
    ip: { ...EMPTY_TAB_CACHE },
    domain: { ...EMPTY_TAB_CACHE },
    file: { ...EMPTY_TAB_CACHE },
  };
}

function makeLoadedFlags(): Record<InvestigateTab, boolean> {
  return { user: false, host: false, ip: false, domain: false, file: false };
}

interface UseSuggestionsResult {
  visibleRecentEntities: RecentEntity[];
  suggestionsLoading: boolean;
}

export function useSuggestions(
  connection: ElasticsearchConnection | null,
  connectionKey: string | null,
  activeTab: InvestigateTab,
): UseSuggestionsResult {
  const [recentEntitiesByTab, setRecentEntitiesByTab] = useState(makeEmptyCache);
  const suggestionsLoadedRef = useRef(makeLoadedFlags());
  const suggestionsRequestTabRef = useRef<InvestigateTab>("user");
  const suggestionsRequestConnectionKeyRef = useRef<string | null>(null);

  const handleSuggestionsSuccess = useCallback(
    (data: EsqlResponse) => {
      const tab = suggestionsRequestTabRef.current;
      if (suggestionsRequestConnectionKeyRef.current !== connectionKey) return;
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
    if (suggestionsRequestConnectionKeyRef.current !== connectionKey) return;
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
    suggestionsLoadedRef.current = makeLoadedFlags();
  }, [connectionKey]);

  useEffect(() => {
    if (connection && !suggestionsLoading && !suggestionsLoadedRef.current[activeTab]) {
      suggestionsRequestTabRef.current = activeTab;
      suggestionsRequestConnectionKeyRef.current = connectionKey;
      runSuggestionsQuery(buildRecentEntitiesQuery(activeTab));
    }
  }, [connection, connectionKey, activeTab, runSuggestionsQuery, suggestionsLoading]);

  const visibleRecentEntities =
    recentEntitiesByTab[activeTab].connectionKey === connectionKey
      ? recentEntitiesByTab[activeTab].entities
      : [];

  return { visibleRecentEntities, suggestionsLoading };
}
