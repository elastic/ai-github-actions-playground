import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Drawer from "@mui/material/Drawer";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
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
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import StorageIcon from "@mui/icons-material/Storage";
import CloseIcon from "@mui/icons-material/Close";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";

import { useApiConsoleStore } from "../store/useApiConsoleStore";
import { usePageContextStore } from "../store/usePageContextStore";
import { PAGE_MANIFEST } from "../routes/manifest";
import { useIndices, useIndexDetail } from "../hooks/useIndices";
import { useOpenInDiscover } from "../hooks/useOpenInDiscover";
import { useDiskUsage } from "../hooks/useDiskUsage";
import { formatBytes } from "../utils/formatBytes";
import { usePageSlotInsights } from "../hooks/usePageSlotInsights";
import { INSIGHT_GUARDRAIL } from "../hooks/insightPromptUtils";

import EmptyState from "./EmptyState";
import PageHeader from "./PageHeader";
import IndexDetailPanel from "./IndexDetailPanel";
import AskAiButton from "./AskAiButton";
import InsightSlot from "./InsightSlot";
import { InsightSlotProvider } from "./InsightSlotContext";
import { OverviewInfoCard } from "./OverviewInfoCard";
import { type IndexTab, parseIntOrNull, healthColor, INDEX_TABS } from "./indicesUtils";
import { INDICES_INSIGHT_SLOT_IDS, INDICES_INSIGHT_SLOTS } from "./indicesInsightSlots";

// ---------------------------------------------------------------------------
// Sorting helpers
// ---------------------------------------------------------------------------

type IndexSortField = "index" | "health" | "docs.count" | "store.size";
type SortDirection = "asc" | "desc";

const HEALTH_ORDER: Record<string, number> = { green: 0, yellow: 1, red: 2 };

function compareIndices(
  a: { index: string; health: string; "docs.count": string | null; "store.size": string | null },
  b: { index: string; health: string; "docs.count": string | null; "store.size": string | null },
  field: IndexSortField,
  dir: SortDirection,
): number {
  let cmp: number;
  switch (field) {
    case "index":
      cmp = a.index.localeCompare(b.index);
      break;
    case "health":
      cmp = (HEALTH_ORDER[a.health] ?? 99) - (HEALTH_ORDER[b.health] ?? 99);
      break;
    case "docs.count":
      cmp = (parseIntOrNull(a["docs.count"]) ?? -1) - (parseIntOrNull(b["docs.count"]) ?? -1);
      break;
    case "store.size":
      cmp = (parseIntOrNull(a["store.size"]) ?? -1) - (parseIntOrNull(b["store.size"]) ?? -1);
      break;
    default:
      cmp = 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function IndicesPage() {
  const openInDiscover = useOpenInDiscover();
  const setConsoleDraft = useApiConsoleStore((s) => s.setConsoleDraft);
  const navigate = useNavigate();

  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault("").withOptions({ history: "replace" }),
  );
  const [showSystemIndices, setShowSystemIndices] = useState(false);
  const [sortField, setSortField] = useState<IndexSortField>("index");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedIndex, setSelectedIndex] = useQueryState("selectedIndex", parseAsString);
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringEnum<IndexTab>(INDEX_TABS)
      .withDefault("overview")
      .withOptions({ history: "replace" }),
  );

  const indicesResult = useIndices();
  const detailResult = useIndexDetail(selectedIndex);
  const diskUsageResult = useDiskUsage(selectedIndex);

  const diskUsage = diskUsageResult.status === "success" ? diskUsageResult.data : null;
  const diskUsageLoading = diskUsageResult.status === "loading";
  const diskUsageError = diskUsageResult.status === "error" ? diskUsageResult.error : null;

  const loadingIndices = indicesResult.status === "loading";
  const error = indicesResult.status === "error" ? indicesResult.error : null;
  const indicesData = indicesResult.status === "success" ? indicesResult.data : null;
  const indices = useMemo(() => indicesData ?? [], [indicesData]);
  const mappings = detailResult.status === "success" ? detailResult.data.mappings : null;
  const settings = detailResult.status === "success" ? detailResult.data.settings : null;
  const indexStats = detailResult.status === "success" ? detailResult.data.indexStats : null;

  // Clear selection when the selected index disappears from fetched results.
  useEffect(() => {
    if (!indicesData) return;
    if (!selectedIndex) return;
    if (indicesData.some((i) => i.index === selectedIndex)) return;
    void setSelectedIndex(null);
  }, [indicesData, selectedIndex, setSelectedIndex]);

  // When system indices are hidden, deselect any active system index.
  useEffect(() => {
    if (showSystemIndices) return;
    if (!selectedIndex?.startsWith(".")) return;
    void setSelectedIndex(null);
  }, [showSystemIndices, selectedIndex, indices, setSelectedIndex]);

  const deferredSearch = useDeferredValue(search);
  const filteredIndices = useMemo(() => {
    const filtered = indices.filter((idx) => {
      if (!showSystemIndices && idx.index.startsWith(".")) return false;
      const term = deferredSearch.trim().toLowerCase();
      return !term || idx.index.toLowerCase().includes(term);
    });
    return [...filtered].sort((a, b) => compareIndices(a, b, sortField, sortDirection));
  }, [indices, showSystemIndices, deferredSearch, sortField, sortDirection]);
  const hasAnyIndices = indices.length > 0;
  const emptyIndicesDescription = !hasAnyIndices
    ? "No indices exist in this cluster."
    : showSystemIndices
      ? "No indices match the current search filter."
      : "Toggle 'Show system indices' above to include system indices.";

  const handleSort = useCallback(
    (field: IndexSortField) => {
      setSortDirection((prev) => (sortField === field && prev === "asc" ? "desc" : "asc"));
      setSortField(field);
    },
    [sortField],
  );

  // Publish screen context for AI chat
  const setPageSection = usePageContextStore((s) => s.setPageSection);
  useEffect(() => {
    if (!indicesData) return;
    const breakdown = { green: 0, yellow: 0, red: 0 };
    for (const idx of indicesData) {
      const h = idx.health?.toLowerCase();
      if (h === "green") breakdown.green++;
      else if (h === "yellow") breakdown.yellow++;
      else if (h === "red") breakdown.red++;
    }
    setPageSection("indices", {
      selectedIndex: selectedIndex ?? null,
      totalIndices: indicesData.length,
      healthBreakdown: breakdown,
    });
  }, [indicesData, selectedIndex, setPageSection]);

  // When filtered results don't include the selected index (e.g. search excludes
  // it), hide the detail panel. The persisted selectedIndex is kept so the
  // selection is restored when the search term is cleared.
  const displayedIndex = filteredIndices.some((i) => i.index === selectedIndex)
    ? selectedIndex
    : null;

  // Treat "idle" as loading when an index is selected but the detail effect
  // hasn't fired yet. This prevents a brief flash of overview content before
  // the detail loading spinner appears (React effects run after render).
  const loadingDetail =
    detailResult.status === "loading" ||
    (displayedIndex !== null && detailResult.status === "idle");

  const selectedRecord = indices.find((i) => i.index === displayedIndex) ?? null;

  const handleOpenInQueryLab = useCallback(() => {
    if (!selectedIndex) return;
    openInDiscover(`FROM ${selectedIndex} | LIMIT 50`);
  }, [selectedIndex, openInDiscover]);

  const handleInspectInConsole = useCallback(() => {
    if (!selectedIndex) return;
    setConsoleDraft({ method: "GET", path: `/${selectedIndex}/_mapping` });
    navigate(PAGE_MANIFEST.console.path);
  }, [selectedIndex, navigate, setConsoleDraft]);

  const indexMetrics = useMemo(() => {
    const green = indices.filter((i) => i.health?.toLowerCase() === "green").length;
    const yellow = indices.filter((i) => i.health?.toLowerCase() === "yellow").length;
    const red = indices.filter((i) => i.health?.toLowerCase() === "red").length;
    const totalDocs = indices.reduce((sum, i) => sum + (parseIntOrNull(i["docs.count"]) ?? 0), 0);
    const totalSizeBytes = indices.reduce(
      (sum, i) => sum + (parseIntOrNull(i["store.size"]) ?? 0),
      0,
    );
    return {
      total: indices.length,
      green,
      yellow,
      red,
      totalDocs,
      totalSizeBytes,
    };
  }, [indices]);

  const insightContext = useMemo(
    () =>
      indicesData
        ? JSON.stringify({
            totalIndices: indexMetrics.total,
            healthy: indexMetrics.green,
            degraded: indexMetrics.yellow,
            unhealthy: indexMetrics.red,
            totalDocs: indexMetrics.totalDocs,
            totalSizeBytes: indexMetrics.totalSizeBytes,
            selectedIndex: displayedIndex,
            filteredCount: filteredIndices.length,
          })
        : "",
    [indicesData, indexMetrics, displayedIndex, filteredIndices.length],
  );

  const slotInsights = usePageSlotInsights({
    context: insightContext,
    systemPrompt:
      "You are an Elasticsearch index management analyst. " +
      "Generate one concise, high-signal insight per slot. " +
      "Focus on index health, capacity, shard distribution, and actionable recommendations. " +
      "Use only facts from provided context; do not invent data. " +
      "When indices are degraded or unhealthy, suggest investigation steps. " +
      INSIGHT_GUARDRAIL,
    cacheKey:
      `indices-slots::${indexMetrics.total}` +
      `::${indexMetrics.green}::${indexMetrics.yellow}::${indexMetrics.red}` +
      `::${indexMetrics.totalDocs}::${indexMetrics.totalSizeBytes}` +
      `::${displayedIndex ?? ""}`,
    slots: INDICES_INSIGHT_SLOTS,
    enabled: indices.length > 0,
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
            title="Indices"
            actions={
              <>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={indicesResult.refresh}
                  startIcon={
                    loadingIndices ? <CircularProgress size={14} aria-hidden="true" /> : undefined
                  }
                  aria-label={loadingIndices ? "Refreshing indices" : "Refresh indices"}
                >
                  {loadingIndices ? "Refreshing..." : "Refresh"}
                </Button>
                <Tooltip title={!displayedIndex ? "Select an index first" : ""}>
                  <span>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={!displayedIndex}
                      onClick={handleOpenInQueryLab}
                    >
                      Open in Query Lab
                    </Button>
                  </span>
                </Tooltip>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!displayedIndex}
                  onClick={handleInspectInConsole}
                >
                  Inspect in Console
                </Button>
                {displayedIndex && (
                  <AskAiButton
                    label="Explain index"
                    prompt={`Review index "${displayedIndex}" and suggest improvements for mappings, shard/replica counts, and lifecycle policy based on the currently selected index details.`}
                  />
                )}
              </>
            }
          />
        </Paper>

        {!loadingIndices && indices.length > 0 && (
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Box sx={{ flex: 1, minWidth: 100 }}>
              <InsightSlot slotId={INDICES_INSIGHT_SLOT_IDS.totalIndicesCard}>
                <OverviewInfoCard title="Total Indices">
                  <Typography
                    variant="h5"
                    component="p"
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {indexMetrics.total}
                  </Typography>
                </OverviewInfoCard>
              </InsightSlot>
            </Box>
            <Box sx={{ flex: 1, minWidth: 100 }}>
              <InsightSlot slotId={INDICES_INSIGHT_SLOT_IDS.healthyCard}>
                <OverviewInfoCard title="Healthy">
                  <Typography
                    variant="h5"
                    component="p"
                    sx={{ color: "success.main", fontVariantNumeric: "tabular-nums" }}
                  >
                    {indexMetrics.green}
                  </Typography>
                </OverviewInfoCard>
              </InsightSlot>
            </Box>
            <Box sx={{ flex: 1, minWidth: 100 }}>
              <InsightSlot slotId={INDICES_INSIGHT_SLOT_IDS.degradedCard}>
                <OverviewInfoCard title="Degraded">
                  <Typography
                    variant="h5"
                    component="p"
                    sx={{
                      color: indexMetrics.yellow > 0 ? "warning.main" : "text.primary",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {indexMetrics.yellow}
                  </Typography>
                </OverviewInfoCard>
              </InsightSlot>
            </Box>
            <Box sx={{ flex: 1, minWidth: 100 }}>
              <InsightSlot slotId={INDICES_INSIGHT_SLOT_IDS.unhealthyCard}>
                <OverviewInfoCard title="Unhealthy">
                  <Typography
                    variant="h5"
                    component="p"
                    sx={{
                      color: indexMetrics.red > 0 ? "error.main" : "text.primary",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {indexMetrics.red}
                  </Typography>
                </OverviewInfoCard>
              </InsightSlot>
            </Box>
            <Box sx={{ flex: 1, minWidth: 100 }}>
              <InsightSlot slotId={INDICES_INSIGHT_SLOT_IDS.totalDocsCard}>
                <OverviewInfoCard title="Total Docs">
                  <Typography
                    variant="h5"
                    component="p"
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {indexMetrics.totalDocs.toLocaleString()}
                  </Typography>
                </OverviewInfoCard>
              </InsightSlot>
            </Box>
            <Box sx={{ flex: 1, minWidth: 100 }}>
              <InsightSlot slotId={INDICES_INSIGHT_SLOT_IDS.totalSizeCard}>
                <OverviewInfoCard title="Total Size">
                  <Typography
                    variant="h5"
                    component="p"
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatBytes(indexMetrics.totalSizeBytes)}
                  </Typography>
                </OverviewInfoCard>
              </InsightSlot>
            </Box>
          </Stack>
        )}

        {error && <Alert severity="error">{error}</Alert>}
        {slotInsights.error && (
          <Alert severity="warning">AI insights unavailable: {slotInsights.error}</Alert>
        )}

        <Box sx={{ display: "flex", flex: 1, gap: 1, minHeight: 0 }}>
          <InsightSlot slotId={INDICES_INSIGHT_SLOT_IDS.indexList}>
            <Paper
              variant="outlined"
              sx={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                minHeight: 0,
              }}
            >
              <Box sx={{ p: 1, borderBottom: 1, borderColor: "border.subtle" }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search indices"
                  value={search}
                  onChange={(e) => void setSearch(e.target.value)}
                  inputProps={{ "aria-label": "Search indices" }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={showSystemIndices}
                      onChange={(e) => setShowSystemIndices(e.target.checked)}
                      inputProps={{ "aria-label": "Show system indices" }}
                    />
                  }
                  label={
                    <Typography variant="caption" color="text.secondary">
                      Show system indices
                    </Typography>
                  }
                  sx={{ mt: 0.5, ml: 0 }}
                />
              </Box>
              <TableContainer sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                <Table size="small" stickyHeader aria-label="Index list">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <TableSortLabel
                          active={sortField === "index"}
                          direction={sortField === "index" ? sortDirection : "asc"}
                          onClick={() => handleSort("index")}
                        >
                          Name
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortField === "health"}
                          direction={sortField === "health" ? sortDirection : "asc"}
                          onClick={() => handleSort("health")}
                        >
                          Health
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortField === "docs.count"}
                          direction={sortField === "docs.count" ? sortDirection : "asc"}
                          onClick={() => handleSort("docs.count")}
                        >
                          Docs
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortField === "store.size"}
                          direction={sortField === "store.size" ? sortDirection : "asc"}
                          onClick={() => handleSort("store.size")}
                        >
                          Size
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredIndices.map((idx) => (
                      <TableRow
                        key={idx.index}
                        hover
                        selected={idx.index === selectedIndex}
                        onClick={() => void setSelectedIndex(idx.index)}
                        tabIndex={0}
                        aria-label={`Select index ${idx.index}`}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" ||
                            event.key === " " ||
                            event.key === "Spacebar"
                          ) {
                            event.preventDefault();
                            void setSelectedIndex(idx.index);
                          }
                        }}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          <Typography
                            variant="body2"
                            noWrap
                            title={idx.index}
                            sx={{ width: "100%" }}
                          >
                            {idx.index}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={healthColor(idx.health)}
                            label={idx.health}
                            aria-label={`Health: ${idx.health}`}
                            sx={{ height: 20, fontSize: "0.7rem" }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {parseIntOrNull(idx["docs.count"])?.toLocaleString() ?? "n/a"}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {formatBytes(parseIntOrNull(idx["store.size"]))}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!loadingIndices && filteredIndices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} sx={{ border: 0 }}>
                          <EmptyState
                            size="small"
                            icon={<StorageIcon sx={{ fontSize: 28 }} />}
                            heading="No indices found"
                            description={emptyIndicesDescription}
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
          open={Boolean(displayedIndex)}
          onClose={() => void setSelectedIndex(null)}
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
            <Typography variant="subtitle1">Index details</Typography>
            <IconButton
              size="small"
              aria-label="Close index details"
              onClick={() => void setSelectedIndex(null)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            <InsightSlot slotId={INDICES_INSIGHT_SLOT_IDS.indexDetail}>
              <IndexDetailPanel
                selectedIndex={displayedIndex}
                selectedRecord={selectedRecord}
                loadingDetail={loadingDetail}
                activeTab={activeTab}
                onTabChange={(tab) => void setActiveTab(tab)}
                mappings={mappings}
                settings={settings}
                indexStats={indexStats}
                diskUsage={diskUsage}
                diskUsageLoading={diskUsageLoading}
                diskUsageError={diskUsageError}
                onAnalyzeDiskUsage={diskUsageResult.analyze}
              />
            </InsightSlot>
          </Box>
        </Drawer>
      </Box>
    </InsightSlotProvider>
  );
}
