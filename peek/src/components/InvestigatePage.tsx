import { useCallback, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import PolicyIcon from "@mui/icons-material/Policy";

import { useConnectionStore } from "../store/useConnectionStore";
import { useEsqlQuery } from "../hooks/useEsqlQuery";
import type { EsqlResponse } from "../types";
import { COMPONENT_HEIGHTS } from "../types/tokens";

import EmptyState from "./EmptyState";
import PageHeader from "./PageHeader";
import InvestigateEventTimeline from "./investigate/InvestigateEventTimeline";
import InvestigateQueryBar from "./investigate/InvestigateQueryBar";
import InvestigateSummaryPanel from "./investigate/InvestigateSummaryPanel";
import InvestigateSuggestionsPanel from "./investigate/InvestigateSuggestionsPanel";
import InvestigateTimelineTable from "./investigate/InvestigateTimelineTable";
import { useSuggestions } from "./investigate/useSuggestions";
import { useTimelineMarkers } from "./investigate/useTimelineMarkers";
import type { InvestigateTab, TimelineEvent } from "./investigate/investigateUtils";
import { buildInvestigateQuery } from "./investigate/investigateQueryBuilder";
import { parseTimelineEvents } from "./investigate/investigateParser";

const TAB_LABELS: Record<
  InvestigateTab,
  { label: string; placeholder: string; ariaLabel: string }
> = {
  user: { label: "User", placeholder: "Enter user name…", ariaLabel: "User name" },
  host: { label: "Host", placeholder: "Enter host name…", ariaLabel: "Host name" },
  ip: { label: "IP Address", placeholder: "Enter IP address…", ariaLabel: "IP address" },
  domain: { label: "Domain", placeholder: "Enter domain name…", ariaLabel: "Domain name" },
  file: { label: "File", placeholder: "Enter file name or hash…", ariaLabel: "File name" },
};

export default function InvestigatePage() {
  const connection = useConnectionStore((s) => s.connection);
  const [activeTab, setActiveTab] = useState<InvestigateTab>("user");
  const [entityInput, setEntityInput] = useState("");
  const [searchedEntity, setSearchedEntity] = useState<string | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const connectionKey = connection ? JSON.stringify(connection) : null;

  const { visibleRecentEntities, suggestionsLoading } = useSuggestions(
    connection,
    connectionKey,
    activeTab,
  );

  const handleSuccess = useCallback((data: EsqlResponse) => {
    const parsed = parseTimelineEvents(data);
    setEvents(parsed);
  }, []);

  const handleFailure = useCallback(() => {
    setEvents([]);
  }, []);

  const { runQuery, loading, error } = useEsqlQuery({
    connection,
    onSuccess: handleSuccess,
    onFailure: handleFailure,
  });

  const currentQuery = useMemo(
    () => (searchedEntity ? buildInvestigateQuery(activeTab, searchedEntity) : null),
    [activeTab, searchedEntity],
  );

  const handleSearch = useCallback(() => {
    const trimmed = entityInput.trim();
    if (!trimmed) return;
    setSearchedEntity(trimmed);
    setEvents([]);
    runQuery(buildInvestigateQuery(activeTab, trimmed));
  }, [entityInput, activeTab, runQuery]);

  const handleEntityClick = useCallback(
    (name: string) => {
      setEntityInput(name);
      setSearchedEntity(name);
      setEvents([]);
      runQuery(buildInvestigateQuery(activeTab, name));
    },
    [activeTab, runQuery],
  );

  const handleTabChange = useCallback((_: React.SyntheticEvent, value: InvestigateTab) => {
    setActiveTab(value);
    setEvents([]);
    setSearchedEntity(null);
  }, []);

  const { markers, loading: markersLoading } = useTimelineMarkers({
    events,
    activeTab,
    searchedEntity: searchedEntity ?? "",
  });

  const tabConfig = TAB_LABELS[activeTab];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Investigate"
          description="Search for a user, host, IP address, domain, or file to view their recent security event timeline."
        />
      </Paper>
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: COMPONENT_HEIGHTS.tab,
          "& .MuiTab-root": { minHeight: COMPONENT_HEIGHTS.tab, py: 0.5 },
        }}
      >
        <Tab value="user" label="User" />
        <Tab value="host" label="Host" />
        <Tab value="ip" label="IP Address" />
        <Tab value="domain" label="Domain" />
        <Tab value="file" label="File" />
      </Tabs>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            size="small"
            fullWidth
            placeholder={tabConfig.placeholder}
            value={entityInput}
            onChange={(e) => setEntityInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            inputProps={{ "aria-label": tabConfig.ariaLabel }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleSearch}
            disabled={loading || !entityInput.trim()}
          >
            <Box component="span" sx={{ display: "inline-flex", gap: 0.5, alignItems: "center" }}>
              {loading && <CircularProgress size={14} color="inherit" />}
              Search
            </Box>
          </Button>
        </Box>
      </Paper>
      {currentQuery && <InvestigateQueryBar query={currentQuery} />}
      {error && <Alert severity="error">{error}</Alert>}
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {searchedEntity && !loading && events.length === 0 && !error ? (
          <EmptyState
            icon={<PolicyIcon sx={{ fontSize: 32 }} />}
            heading={`No events found for ${tabConfig.label.toLowerCase()} "${searchedEntity}"`}
            description={`No matching events were found in logs-*, filebeat-*, auditbeat-*, or winlogbeat-* indices. Make sure the ${tabConfig.label.toLowerCase()} is correct and that security event data is being ingested.`}
          />
        ) : events.length > 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <InvestigateSummaryPanel
              events={events}
              activeTab={activeTab}
              searchedEntity={searchedEntity!}
            />
            <InvestigateEventTimeline
              events={events}
              markers={markers}
              markersLoading={markersLoading}
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
                heading={`Investigate a ${tabConfig.label.toLowerCase()}`}
                description={`Enter a ${tabConfig.label.toLowerCase()} above and search to see their recent security event timeline.`}
              />
            )}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
