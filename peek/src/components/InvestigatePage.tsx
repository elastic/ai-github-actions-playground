import { useCallback, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import PolicyIcon from "@mui/icons-material/Policy";

import { useConnectionStore } from "../store/useConnectionStore";
import { useEsqlQuery } from "../hooks/useEsqlQuery";
import type { EsqlResponse } from "../types";

import EmptyState from "./EmptyState";
import PageHeader from "./PageHeader";
import InvestigateSummaryPanel from "./investigate/InvestigateSummaryPanel";
import InvestigateSuggestionsPanel from "./investigate/InvestigateSuggestionsPanel";
import InvestigateTimelineTable from "./investigate/InvestigateTimelineTable";
import { useSuggestions } from "./investigate/useSuggestions";
import {
  type InvestigateTab,
  type TimelineEvent,
  buildSummaryPrompt,
} from "./investigate/investigateUtils";
import { buildInvestigateQuery } from "./investigate/investigateQueryBuilder";
import { parseTimelineEvents } from "./investigate/investigateParser";

export default function InvestigatePage() {
  const connection = useConnectionStore((s) => s.connection);
  const [activeTab, setActiveTab] = useState<InvestigateTab>("user");
  const [entityInput, setEntityInput] = useState("");
  const [searchedEntity, setSearchedEntity] = useState<string | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [summaryPrompt, setSummaryPrompt] = useState<string | null>(null);
  const connectionKey = connection ? JSON.stringify(connection) : null;

  const { visibleRecentEntities, suggestionsLoading } = useSuggestions(
    connection,
    connectionKey,
    activeTab,
  );

  const handleSuccess = useCallback(
    (data: EsqlResponse) => {
      const parsed = parseTimelineEvents(data);
      setEvents(parsed);
      setSummaryPrompt(
        parsed.length > 0 ? buildSummaryPrompt(parsed, activeTab, entityInput) : null,
      );
    },
    [activeTab, entityInput],
  );

  const handleFailure = useCallback(() => {
    setEvents([]);
    setSummaryPrompt(null);
  }, []);

  const { runQuery, loading, error } = useEsqlQuery({
    connection,
    onSuccess: handleSuccess,
    onFailure: handleFailure,
  });

  const handleSearch = useCallback(() => {
    const trimmed = entityInput.trim();
    if (!trimmed) return;
    setSearchedEntity(trimmed);
    setEvents([]);
    setSummaryPrompt(null);
    runQuery(buildInvestigateQuery(activeTab, trimmed));
  }, [entityInput, activeTab, runQuery]);

  const handleEntityClick = useCallback(
    (name: string) => {
      setEntityInput(name);
      setSearchedEntity(name);
      setEvents([]);
      setSummaryPrompt(null);
      runQuery(buildInvestigateQuery(activeTab, name));
    },
    [activeTab, runQuery],
  );

  const handleTabChange = useCallback((_: React.SyntheticEvent, value: InvestigateTab) => {
    setActiveTab(value);
    setEvents([]);
    setSearchedEntity(null);
    setSummaryPrompt(null);
  }, []);

  const handleCopySummaryPrompt = useCallback(async () => {
    if (!summaryPrompt) return;
    try {
      await navigator.clipboard?.writeText(summaryPrompt);
    } catch {
      /* clipboard may not be available */
    }
  }, [summaryPrompt]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Investigate"
          description="Search for a user or host to view their recent security event timeline."
        />
      </Paper>
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0.5 } }}
      >
        <Tab value="user" label="User" />
        <Tab value="host" label="Host" />
      </Tabs>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            size="small"
            fullWidth
            placeholder={activeTab === "user" ? "Enter user name…" : "Enter host name…"}
            value={entityInput}
            onChange={(e) => setEntityInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            inputProps={{ "aria-label": activeTab === "user" ? "User name" : "Host name" }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleSearch}
            disabled={loading || !entityInput.trim()}
          >
            {loading ? <LinearProgress sx={{ width: 48 }} /> : "Search"}
          </Button>
        </Box>
      </Paper>
      {error && <Alert severity="error">{error}</Alert>}
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {searchedEntity && !loading && events.length === 0 && !error ? (
          <EmptyState
            icon={<PolicyIcon sx={{ fontSize: 32 }} />}
            heading={`No events found for ${activeTab} "${searchedEntity}"`}
            description={`No matching events were found in logs-*, filebeat-*, auditbeat-*, or winlogbeat-* indices. Make sure the ${activeTab} name is correct and that security event data is being ingested.`}
          />
        ) : events.length > 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <InvestigateSummaryPanel
              events={events}
              activeTab={activeTab}
              searchedEntity={searchedEntity!}
              summaryPrompt={summaryPrompt}
              onCopyPrompt={handleCopySummaryPrompt}
            />
            <InvestigateTimelineTable events={events} activeTab={activeTab} />
          </Box>
        ) : !searchedEntity && !loading ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, height: "100%" }}>
            <InvestigateSuggestionsPanel
              activeTab={activeTab}
              entities={visibleRecentEntities}
              loading={suggestionsLoading}
              onEntityClick={handleEntityClick}
            />
            {!suggestionsLoading && visibleRecentEntities.length === 0 && (
              <EmptyState
                icon={<PolicyIcon sx={{ fontSize: 32 }} />}
                heading={`Investigate a ${activeTab}`}
                description={`Enter a ${activeTab} name above and search to see their recent security event timeline.`}
              />
            )}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
