import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import CloseIcon from "@mui/icons-material/Close";
import StorageIcon from "@mui/icons-material/Storage";
import { useSearchParam } from "../hooks/useSearchParam";

import type { DataStreamInfo } from "../services/es";
import { useApiConsoleStore } from "../store/useApiConsoleStore";
import { usePageContextStore } from "../store/usePageContextStore";
import { PAGE_MANIFEST } from "../routes/manifest";
import { useDataStreams } from "../hooks/useDataStreams";
import { useFieldCaps } from "../hooks/useFieldCaps";
import { useIndices } from "../hooks/useIndices";
import { useOpenInDiscover } from "../hooks/useOpenInDiscover";
import { INSIGHT_GUARDRAIL } from "../hooks/insightPromptUtils";
import { usePageSlotInsights } from "../hooks/usePageSlotInsights";
import { COMPACT_CHIP_SX } from "../types/tokens";
import { formatBytes } from "../utils/formatBytes";

import ContentSkeleton from "./ContentSkeleton";
import EmptyState from "./EmptyState";
import PageHeader from "./PageHeader";
import AskAiButton from "./AskAiButton";
import PageInsightBanner from "./PageInsightBanner";
import InsightSlot from "./InsightSlot";
import { InsightSlotProvider } from "./InsightSlotContext";
import { OverviewInfoCard } from "./OverviewInfoCard";
import {
  DATA_STREAMS_INSIGHT_SLOT_IDS,
  DATA_STREAMS_INSIGHT_SLOTS,
} from "./dataStreamsInsightSlots";
import { getStatusChipColor, STREAM_STATUS_ORDER, toFieldRows } from "./dataStreamsUtils";

// ---------------------------------------------------------------------------
// Sorting helpers
// ---------------------------------------------------------------------------

type StreamSortField = "name" | "status" | "indices" | "docs" | "size";
type StreamSortDirection = "asc" | "desc";

const DATA_STREAM_INDEX_PREFIX = ".ds-";

interface StreamStats {
  docs: number;
  sizeBytes: number;
}

interface GroupedStreamRow {
  kind: "group" | "stream";
  key: string;
  depth: number;
  name: string;
  stream?: DataStreamInfo & { docs: number; sizeBytes: number };
}

function compareStreams(
  a: { name: string; status: string; indices: unknown[]; docs: number; sizeBytes: number },
  b: { name: string; status: string; indices: unknown[]; docs: number; sizeBytes: number },
  field: StreamSortField,
  dir: StreamSortDirection,
): number {
  let cmp: number;
  switch (field) {
    case "name":
      cmp = a.name.localeCompare(b.name);
      break;
    case "status":
      cmp =
        (STREAM_STATUS_ORDER[a.status.toUpperCase()] ?? 99) -
        (STREAM_STATUS_ORDER[b.status.toUpperCase()] ?? 99);
      break;
    case "indices":
      cmp = a.indices.length - b.indices.length;
      break;
    case "docs":
      cmp = a.docs - b.docs;
      break;
    case "size":
      cmp = a.sizeBytes - b.sizeBytes;
      break;
    default:
      cmp = 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

function streamGroupName(streamName: string): string | null {
  const [head, ...rest] = streamName.split("-");
  return rest.length > 0 && head ? head : null;
}

function parseCount(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

export default function DataStreamsPage() {
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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<{ name: string; type: string } | null>(null);

  const streamsResult = useDataStreams();
  const indicesResult = useIndices();
  const fieldCapsResult = useFieldCaps(selectedName);

  const loadingStreams = streamsResult.status === "loading";
  const streamsData = streamsResult.status === "success" ? streamsResult.data : undefined;
  const dataStreams = useMemo(() => streamsData ?? [], [streamsData]);
  const indexRows = indicesResult.status === "success" ? indicesResult.data : [];
  const indicesMetricsError = indicesResult.status === "error" ? indicesResult.error : null;
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

  const streamStatsByName = useMemo(() => {
    const indexByName = new Map(indexRows.map((r) => [r.index, r]));
    const stats = new Map<string, StreamStats>();
    for (const stream of dataStreams) {
      let docs = 0;
      let sizeBytes = 0;
      for (const idx of stream.indices ?? []) {
        const backingIndexName = (idx as { index_name?: string }).index_name;
        if (!backingIndexName) continue;
        const row = indexByName.get(backingIndexName);
        if (!row) continue;
        docs += parseCount(row["docs.count"]);
        sizeBytes += parseCount(row["store.size"]);
      }
      stats.set(stream.name, { docs, sizeBytes });
    }
    return stats;
  }, [dataStreams, indexRows]);

  // Clear selection when the selected stream disappears from fetched results.
  useEffect(() => {
    if (!streamsData) return;
    if (!selectedName) return;
    if (streamsData.some((stream) => stream.name === selectedName)) return;
    void setSelectedName(null);
  }, [streamsData, selectedName, setSelectedName]);

  // When system streams are hidden, ensure the selected stream is not a hidden system stream.
  useEffect(() => {
    if (showSystemStreams) return;
    if (!selectedName?.startsWith(".")) return;
    void setSelectedName(null);
  }, [showSystemStreams, selectedName, setSelectedName]);

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
    const enriched = filtered.map((stream) => {
      const stats = streamStatsByName.get(stream.name) ?? { docs: 0, sizeBytes: 0 };
      return { ...stream, docs: stats.docs, sizeBytes: stats.sizeBytes };
    });
    return [...enriched].sort((a, b) => compareStreams(a, b, streamSortField, streamSortDirection));
  }, [
    dataStreams,
    deferredSearch,
    showSystemStreams,
    streamSortField,
    streamSortDirection,
    streamStatsByName,
  ]);

  const groupedRows = useMemo(() => {
    if (streamSortField !== "name") {
      return filteredStreams.map((stream) => ({
        kind: "stream" as const,
        key: `stream:${stream.name}`,
        depth: 0,
        name: stream.name,
        stream,
      }));
    }

    const grouped = new Map<string | null, typeof filteredStreams>();
    for (const stream of filteredStreams) {
      const group = streamGroupName(stream.name);
      const groupStreams = grouped.get(group) ?? [];
      groupStreams.push(stream);
      grouped.set(group, groupStreams);
    }

    const rows: GroupedStreamRow[] = [];
    for (const groupName of grouped.keys()) {
      const groupStreams = grouped.get(groupName) ?? [];
      const showGroupHeader = groupName !== null && groupStreams.length > 1;
      if (showGroupHeader) {
        rows.push({ kind: "group", key: `group:${groupName}`, depth: 0, name: groupName });
      }
      if (showGroupHeader && expandedGroups[groupName] === false) continue;
      for (const stream of groupStreams) {
        rows.push({
          kind: "stream",
          key: `stream:${stream.name}`,
          depth: showGroupHeader ? 1 : 0,
          name: stream.name,
          stream,
        });
      }
    }
    return rows;
  }, [filteredStreams, expandedGroups, streamSortField]);

  const streamMetrics = useMemo(
    () =>
      dataStreams.reduce(
        (acc, stream) => {
          const status = stream.status.toUpperCase();
          if (status === "GREEN") acc.green += 1;
          else if (status === "YELLOW") acc.yellow += 1;
          else if (status === "RED") acc.red += 1;
          acc.totalIndices += stream.indices.length;
          const stats = streamStatsByName.get(stream.name);
          acc.totalDocs += stats?.docs ?? 0;
          acc.totalSizeBytes += stats?.sizeBytes ?? 0;
          acc.total += 1;
          return acc;
        },
        { total: 0, green: 0, yellow: 0, red: 0, totalIndices: 0, totalDocs: 0, totalSizeBytes: 0 },
      ),
    [dataStreams, streamStatsByName],
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

  const toggleGroup = useCallback((groupName: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupName]: !(prev[groupName] ?? true) }));
  }, []);

  const handleOpenIndicesForStream = useCallback(
    (streamName: string) => {
      void navigate(
        `/indices?search=${encodeURIComponent(`${DATA_STREAM_INDEX_PREFIX}${streamName}-`)}`,
      );
    },
    [navigate],
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

  return (
    <InsightSlotProvider
      summary={slotInsights.summary}
      insights={slotInsights.insights}
      loading={slotInsights.loading}
      error={slotInsights.error}
      refresh={slotInsights.refresh}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <PageHeader
            title="Data Streams"
            actions={
              <>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={streamsResult.refresh}
                  disabled={loadingStreams}
                  startIcon={
                    loadingStreams ? <CircularProgress size={14} aria-hidden="true" /> : undefined
                  }
                  aria-label={loadingStreams ? "Refreshing data streams" : "Refresh data streams"}
                >
                  {loadingStreams ? "Refreshing..." : "Refresh"}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  disabled={!displayedName}
                  onClick={handleOpenInDiscover}
                >
                  Open in Query Lab
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!displayedName}
                  onClick={handleInspectInConsole}
                >
                  Inspect in Console
                </Button>
                {displayedName && (
                  <AskAiButton
                    label="Summarize schema"
                    prompt={`Summarize the schema of data stream "${displayedName}" and suggest one ES|QL query to explore it.`}
                  />
                )}
              </>
            }
          />
        </Paper>

        {!loadingStreams && dataStreams.length > 0 && (
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Box sx={{ flex: 1, minWidth: 100 }}>
              <InsightSlot slotId={DATA_STREAMS_INSIGHT_SLOT_IDS.totalStreamsCard}>
                <OverviewInfoCard title="Total Streams">
                  <Typography
                    variant="h5"
                    component="p"
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {streamMetrics.total}
                  </Typography>
                </OverviewInfoCard>
              </InsightSlot>
            </Box>
            <Box sx={{ flex: 1, minWidth: 100 }}>
              <InsightSlot slotId={DATA_STREAMS_INSIGHT_SLOT_IDS.healthyCard}>
                <OverviewInfoCard title="Healthy">
                  <Typography
                    variant="h5"
                    component="p"
                    sx={{ color: "success.main", fontVariantNumeric: "tabular-nums" }}
                  >
                    {streamMetrics.green}
                  </Typography>
                </OverviewInfoCard>
              </InsightSlot>
            </Box>
            <Box sx={{ flex: 1, minWidth: 100 }}>
              <InsightSlot slotId={DATA_STREAMS_INSIGHT_SLOT_IDS.degradedCard}>
                <OverviewInfoCard title="Degraded">
                  <Typography
                    variant="h5"
                    component="p"
                    sx={{
                      color: streamMetrics.yellow > 0 ? "warning.main" : "text.primary",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {streamMetrics.yellow}
                  </Typography>
                </OverviewInfoCard>
              </InsightSlot>
            </Box>
            <Box sx={{ flex: 1, minWidth: 100 }}>
              <InsightSlot slotId={DATA_STREAMS_INSIGHT_SLOT_IDS.unhealthyCard}>
                <OverviewInfoCard title="Unhealthy">
                  <Typography
                    variant="h5"
                    component="p"
                    sx={{
                      color: streamMetrics.red > 0 ? "error.main" : "text.primary",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {streamMetrics.red}
                  </Typography>
                </OverviewInfoCard>
              </InsightSlot>
            </Box>
            <Box sx={{ flex: 1, minWidth: 100 }}>
              <InsightSlot slotId={DATA_STREAMS_INSIGHT_SLOT_IDS.backingIndicesCard}>
                <OverviewInfoCard title="Backing Indices">
                  <Typography
                    variant="h5"
                    component="p"
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {streamMetrics.totalIndices}
                  </Typography>
                </OverviewInfoCard>
              </InsightSlot>
            </Box>
          </Stack>
        )}

        {error && <Alert severity="error">{error}</Alert>}
        {indicesMetricsError && (
          <Alert severity="warning">
            Index metrics unavailable: {indicesMetricsError}. Docs/Size values may be incomplete.
          </Alert>
        )}
        {slotInsights.error && (
          <Alert severity="warning">AI insights unavailable: {slotInsights.error}</Alert>
        )}
        {displayedDataStream && (
          <PageInsightBanner
            context={JSON.stringify({
              name: displayedDataStream.name,
              status: displayedDataStream.status,
              generation: displayedDataStream.generation,
              backingIndexCount: displayedDataStream.indices.length,
              ilmPolicy: displayedDataStream.ilm_policy ?? null,
            })}
            systemPrompt={`You are an Elasticsearch data stream analyst. Give one concise operational insight and one action for this selected stream.${INSIGHT_GUARDRAIL}`}
            cacheKey={`data-stream::${displayedDataStream.name}::${displayedDataStream.status}::${displayedDataStream.generation}::${displayedDataStream.indices.length}::${displayedDataStream.ilm_policy ?? ""}`}
          />
        )}

        <Box sx={{ display: "flex", flex: 1, gap: 1, minHeight: 0 }}>
          <InsightSlot slotId={DATA_STREAMS_INSIGHT_SLOT_IDS.streamList}>
            <Paper
              variant="outlined"
              sx={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                minHeight: 0,
              }}
            >
              <Box sx={{ p: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search streams"
                  value={search}
                  onChange={(e) => void setSearch(e.target.value)}
                  inputProps={{ "aria-label": "Search streams" }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={showSystemStreams}
                      onChange={(e) => setShowSystemStreams(e.target.checked)}
                      inputProps={{ "aria-label": "Show system streams" }}
                    />
                  }
                  label={
                    <Typography variant="caption" color="text.secondary">
                      Show system streams
                    </Typography>
                  }
                  sx={{ mt: 0.5, ml: 0 }}
                />
              </Box>
              <Divider />
              <TableContainer sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                <Table size="small" stickyHeader aria-label="Data stream list">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <TableSortLabel
                          active={streamSortField === "name"}
                          direction={streamSortField === "name" ? streamSortDirection : "asc"}
                          onClick={() => handleStreamSort("name")}
                        >
                          Name
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={streamSortField === "status"}
                          direction={streamSortField === "status" ? streamSortDirection : "asc"}
                          onClick={() => handleStreamSort("status")}
                        >
                          Status
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={streamSortField === "indices"}
                          direction={streamSortField === "indices" ? streamSortDirection : "asc"}
                          onClick={() => handleStreamSort("indices")}
                        >
                          Indices
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={streamSortField === "docs"}
                          direction={streamSortField === "docs" ? streamSortDirection : "asc"}
                          onClick={() => handleStreamSort("docs")}
                        >
                          Docs
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={streamSortField === "size"}
                          direction={streamSortField === "size" ? streamSortDirection : "asc"}
                          onClick={() => handleStreamSort("size")}
                        >
                          Size
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {groupedRows.map((row) =>
                      row.kind === "group" ? (
                        <TableRow key={row.key}>
                          <TableCell colSpan={5}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <IconButton
                                size="small"
                                aria-label={`${expandedGroups[row.name] === false ? "Expand" : "Collapse"} group ${row.name}`}
                                onClick={() => toggleGroup(row.name)}
                              >
                                {expandedGroups[row.name] === false ? (
                                  <KeyboardArrowRightIcon fontSize="small" />
                                ) : (
                                  <KeyboardArrowDownIcon fontSize="small" />
                                )}
                              </IconButton>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {row.name}
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow
                          key={row.key}
                          hover
                          selected={row.stream?.name === selectedName}
                          onClick={() => row.stream && setSelectedName(row.stream.name)}
                          tabIndex={0}
                          aria-label={
                            row.stream ? `Select data stream ${row.stream.name}` : undefined
                          }
                          onKeyDown={(event) => {
                            if (!row.stream) return;
                            if (
                              event.key === "Enter" ||
                              event.key === " " ||
                              event.key === "Spacebar"
                            ) {
                              event.preventDefault();
                              setSelectedName(row.stream.name);
                            }
                          }}
                          sx={{ cursor: "pointer" }}
                        >
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", pl: row.depth * 2 }}>
                              <Typography
                                variant="body2"
                                noWrap
                                title={row.stream?.name}
                                sx={{ width: "100%", fontSize: "0.85rem", fontFamily: "monospace" }}
                              >
                                {row.stream?.name}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={row.stream?.status.toUpperCase() ?? "UNKNOWN"}
                              color={getStatusChipColor(row.stream?.status ?? "")}
                              size="small"
                              sx={COMPACT_CHIP_SX}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="text"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (row.stream) handleOpenIndicesForStream(row.stream.name);
                              }}
                            >
                              {row.stream?.indices.length ?? 0}
                            </Button>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {(row.stream &&
                                (
                                  streamStatsByName.get(row.stream.name)?.docs ?? 0
                                ).toLocaleString()) ||
                                "0"}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {formatBytes(
                                row.stream
                                  ? (streamStatsByName.get(row.stream.name)?.sizeBytes ?? 0)
                                  : 0,
                              )}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ),
                    )}
                    {!loadingStreams && groupedRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ border: 0 }}>
                          <EmptyState
                            size="small"
                            heading="No data streams found"
                            description="Try adjusting your search or check that data streams exist in the cluster"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </InsightSlot>
        </Box>
        <Drawer
          anchor="right"
          open={Boolean(displayedDataStream)}
          onClose={() => void setSelectedName(null)}
          PaperProps={{
            sx: {
              width: { xs: "100%", md: 560 },
              p: 1,
              backgroundColor: "background.default",
            },
          }}
        >
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1 }}
          >
            <Typography variant="subtitle1">Data stream details</Typography>
            <IconButton
              size="small"
              aria-label="Close data stream details"
              onClick={() => void setSelectedName(null)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            <InsightSlot slotId={DATA_STREAMS_INSIGHT_SLOT_IDS.streamDetail}>
              <Paper
                variant="outlined"
                sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}
              >
                <Box sx={{ p: 1.5 }}>
                  {displayedDataStream ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <Typography variant="subtitle1">{displayedDataStream.name}</Typography>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "minmax(120px, auto) 1fr",
                          rowGap: 0.5,
                          columnGap: 1.5,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Status
                        </Typography>
                        <Typography variant="body2" data-testid="data-stream-meta-status">
                          {displayedDataStream.status}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Generation
                        </Typography>
                        <Typography variant="body2" data-testid="data-stream-meta-generation">
                          {displayedDataStream.generation}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Backing indices
                        </Typography>
                        <Typography variant="body2" data-testid="data-stream-meta-backing-indices">
                          {displayedDataStream.indices.length}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Documents
                        </Typography>
                        <Typography variant="body2" data-testid="data-stream-meta-docs">
                          {(
                            streamStatsByName.get(displayedDataStream.name)?.docs ?? 0
                          ).toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Store size
                        </Typography>
                        <Typography variant="body2" data-testid="data-stream-meta-size">
                          {formatBytes(
                            streamStatsByName.get(displayedDataStream.name)?.sizeBytes ?? 0,
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Write index
                        </Typography>
                        <Typography variant="body2" data-testid="data-stream-meta-write-index">
                          {displayedDataStream.indices[displayedDataStream.indices.length - 1]
                            ?.index_name ?? "n/a"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Managed by
                        </Typography>
                        <Typography variant="body2" data-testid="data-stream-meta-managed-by">
                          {displayedDataStream.next_generation_managed_by}
                        </Typography>
                        {displayedDataStream.ilm_policy && (
                          <>
                            <Typography variant="caption" color="text.secondary">
                              ILM policy
                            </Typography>
                            <Typography variant="body2" data-testid="data-stream-meta-ilm-policy">
                              {displayedDataStream.ilm_policy}
                            </Typography>
                          </>
                        )}
                      </Box>
                    </Box>
                  ) : (
                    <EmptyState
                      icon={<StorageIcon sx={{ fontSize: 32 }} />}
                      heading="Select a data stream"
                      description="Select a data stream from the left panel to view its fields and backing indices."
                    />
                  )}
                </Box>
                <Divider />
                <Box
                  sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: 0, p: 1.5 }}
                >
                  {displayedDataStream && (
                    <TextField
                      size="small"
                      placeholder="Search fields"
                      value={fieldSearch}
                      onChange={(e) => setFieldSearch(e.target.value)}
                      inputProps={{ "aria-label": "Search fields" }}
                    />
                  )}
                  {loadingFields ? (
                    <ContentSkeleton variant="table" />
                  ) : (
                    <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                      {displayedDataStream &&
                        fieldRows.map((field) => (
                          <Stack
                            key={`${field.name}:${field.type}`}
                            component="button"
                            direction="row"
                            spacing={1}
                            onClick={() => setSelectedField({ name: field.name, type: field.type })}
                            aria-pressed={
                              selectedField?.name === field.name &&
                              selectedField?.type === field.type
                            }
                            sx={{
                              alignItems: "center",
                              width: "100%",
                              py: 0.5,
                              px: 0.5,
                              border: "none",
                              borderRadius: 1,
                              background: "none",
                              bgcolor:
                                selectedField?.name === field.name &&
                                selectedField?.type === field.type
                                  ? "action.selected"
                                  : "transparent",
                              cursor: "pointer",
                              textAlign: "left",
                              "&:hover": { bgcolor: "action.hover" },
                            }}
                          >
                            <Typography variant="body2" color="text.primary" sx={{ flex: 1 }}>
                              {field.name}
                            </Typography>
                            <Chip size="small" label={field.type} />
                          </Stack>
                        ))}
                      {!loadingFields && fieldRows.length === 0 && displayedDataStream && (
                        <Typography variant="body2" color="text.secondary">
                          No fields found for this data stream.
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              </Paper>
            </InsightSlot>
          </Box>
        </Drawer>
      </Box>
    </InsightSlotProvider>
  );
}
