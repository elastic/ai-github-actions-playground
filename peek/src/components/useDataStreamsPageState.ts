import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useConnectionStore } from "../store/useConnectionStore";
import { useApiConsoleStore } from "../store/useApiConsoleStore";
import { usePageContextStore } from "../store/usePageContextStore";
import { PAGE_MANIFEST } from "../routes/manifest";
import { useDataStreams } from "../hooks/useDataStreams";
import { useFieldCaps } from "../hooks/useFieldCaps";
import { useOpenInDiscover } from "../hooks/useOpenInDiscover";
import { INSIGHT_GUARDRAIL } from "../hooks/insightPromptUtils";
import { usePageSlotInsights } from "../hooks/usePageSlotInsights";
import { useSearchParam } from "../hooks/useSearchParam";

import { DATA_STREAMS_INSIGHT_SLOTS } from "./dataStreamsInsightSlots";
import type { StreamSortField, StreamSortDirection } from "./dataStreamsUtils";
import { toFieldRows, compareStreams } from "./dataStreamsUtils";

export function useDataStreamsPageState() {
  const connection = useConnectionStore((s) => s.connection);
  const openInDiscover = useOpenInDiscover();
  const setConsoleDraft = useApiConsoleStore((s) => s.setConsoleDraft);
  const navigate = useNavigate();

  const [search, setSearch] = useSearchParam();
  const [fieldSearch, setFieldSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const deferredFieldSearch = useDeferredValue(fieldSearch);
  const [showSystemStreams, setShowSystemStreams] = useState(false);
  const [streamSortField, setStreamSortField] = useState<StreamSortField>("name");
  const [streamSortDirection, setStreamSortDirection] = useState<StreamSortDirection>("asc");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<{ name: string; type: string } | null>(null);

  const streamsResult = useDataStreams();
  const fieldCapsResult = useFieldCaps(selectedName);

  const loadingStreams = streamsResult.status === "loading";
  const streamsData = streamsResult.status === "success" ? streamsResult.data : undefined;
  const dataStreams = useMemo(() => streamsData ?? [], [streamsData]);
  const fieldCaps = fieldCapsResult.status === "success" ? fieldCapsResult.data : null;
  const loadingFields = fieldCapsResult.status === "loading";
  const error =
    streamsResult.status === "error"
      ? streamsResult.error
      : fieldCapsResult.status === "error"
        ? fieldCapsResult.error
        : null;

  const selectedDataStream = useMemo(
    () => dataStreams.find((stream) => stream.name === selectedName) ?? null,
    [dataStreams, selectedName],
  );

  // Auto-select the first visible stream when data loads.
  // Runs on every fetch cycle via the hook's stable data identity.
  useEffect(() => {
    if (!streamsData) return;
    const nextStreams = streamsData;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- conditional update: only fires when current selection is invalid or missing after a data fetch
    setSelectedName((current) => {
      if (
        current &&
        nextStreams.some((stream) => stream.name === current) &&
        (showSystemStreams || !current.startsWith("."))
      ) {
        return current;
      }
      const firstVisible = showSystemStreams
        ? nextStreams[0]
        : nextStreams.find((stream) => !stream.name.startsWith("."));
      return firstVisible?.name ?? null;
    });
  }, [streamsData, showSystemStreams]);

  // When system streams are hidden, ensure the selected stream is not a hidden system stream.
  useEffect(() => {
    if (showSystemStreams) return;
    if (!selectedName?.startsWith(".")) return;
    const firstVisible = dataStreams.find((s) => !s.name.startsWith("."));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- guarded: only updates when a system stream is selected while system streams are hidden
    setSelectedName(firstVisible?.name ?? null);
  }, [showSystemStreams, selectedName, dataStreams]);

  // Clear selected field when the active stream changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing field selection when stream changes to prevent stale field data
    setSelectedField(null);
  }, [selectedName]);

  const filteredStreams = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const filtered = dataStreams.filter((stream) => {
      if (!showSystemStreams && stream.name.startsWith(".")) return false;
      if (term && !stream.name.toLowerCase().includes(term)) return false;
      return true;
    });
    return [...filtered].sort((a, b) => compareStreams(a, b, streamSortField, streamSortDirection));
  }, [dataStreams, deferredSearch, showSystemStreams, streamSortField, streamSortDirection]);

  const streamMetrics = useMemo(
    () =>
      dataStreams.reduce(
        (acc, stream) => {
          const status = stream.status.toUpperCase();
          if (status === "GREEN") acc.green += 1;
          else if (status === "YELLOW") acc.yellow += 1;
          else if (status === "RED") acc.red += 1;
          acc.totalIndices += stream.indices.length;
          acc.total += 1;
          return acc;
        },
        { total: 0, green: 0, yellow: 0, red: 0, totalIndices: 0 },
      ),
    [dataStreams],
  );

  const handleStreamSort = useCallback(
    (field: StreamSortField) => {
      setStreamSortDirection((prev) =>
        streamSortField === field && prev === "asc" ? "desc" : "asc",
      );
      setStreamSortField(field);
    },
    [streamSortField],
  );

  // When filtered results don't include the selected stream (e.g. search
  // excludes it), hide the detail panel while keeping the selection so it
  // restores when the search is cleared.
  const displayedName = filteredStreams.some((s) => s.name === selectedName) ? selectedName : null;
  const displayedDataStream = displayedName ? selectedDataStream : null;

  // Publish screen context for AI chat
  const setPageSection = usePageContextStore((s) => s.setPageSection);
  useEffect(() => {
    if (!streamsData) return;
    setPageSection("dataStreams", {
      selectedStream: selectedName,
      totalStreams: streamsData.length,
    });
    return () => setPageSection("dataStreams", undefined);
  }, [streamsData, selectedName, setPageSection]);

  const fieldRows = useMemo(() => {
    const rows = fieldCaps ? toFieldRows(fieldCaps) : [];
    const term = deferredFieldSearch.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(term));
  }, [fieldCaps, deferredFieldSearch]);

  const handleOpenInDiscover = useCallback(() => {
    if (!selectedName) return;
    openInDiscover(`FROM ${selectedName} | SORT @timestamp DESC | LIMIT 50`);
  }, [selectedName, openInDiscover]);

  const handleInspectInConsole = useCallback(() => {
    if (!selectedName) return;
    setConsoleDraft({ method: "GET", path: `/_data_stream/${selectedName}` });
    navigate(PAGE_MANIFEST.console.path);
  }, [selectedName, navigate, setConsoleDraft]);

  const handleFieldStatsQuery = useCallback(
    (query: string) => {
      openInDiscover(query);
    },
    [openInDiscover],
  );

  const insightContext = useMemo(
    () =>
      streamsData
        ? JSON.stringify({
            totalStreams: streamMetrics.total,
            healthy: streamMetrics.green,
            degraded: streamMetrics.yellow,
            unhealthy: streamMetrics.red,
            totalBackingIndices: streamMetrics.totalIndices,
            selectedStream: displayedName,
            filteredCount: filteredStreams.length,
          })
        : "",
    [streamsData, streamMetrics, displayedName, filteredStreams.length],
  );

  const slotInsights = usePageSlotInsights({
    context: insightContext,
    systemPrompt:
      "You are an Elasticsearch data stream analyst. " +
      "Generate one concise, high-signal insight per slot. " +
      "Focus on operational health, capacity, and actionable recommendations. " +
      "Use only facts from provided context; do not invent data. " +
      "When streams are degraded or unhealthy, suggest investigation steps. " +
      INSIGHT_GUARDRAIL,
    cacheKey: `data-streams-slots::${streamMetrics.total}::${streamMetrics.green}::${streamMetrics.yellow}::${streamMetrics.red}::${streamMetrics.totalIndices}::${filteredStreams.length}::${displayedName ?? ""}`,
    slots: DATA_STREAMS_INSIGHT_SLOTS,
    enabled: dataStreams.length > 0,
  });

  return {
    connection,
    loadingStreams,
    dataStreams,
    error,
    refreshStreams: streamsResult.refresh,
    selectedName,
    setSelectedName,
    displayedName,
    displayedDataStream,
    search,
    setSearch,
    showSystemStreams,
    setShowSystemStreams,
    streamSortField,
    streamSortDirection,
    handleStreamSort,
    filteredStreams,
    streamMetrics,
    fieldSearch,
    setFieldSearch,
    fieldRows,
    loadingFields,
    selectedField,
    setSelectedField,
    handleOpenInDiscover,
    handleInspectInConsole,
    handleFieldStatsQuery,
    slotInsights,
  };
}
