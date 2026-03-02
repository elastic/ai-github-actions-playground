import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import StorageIcon from "@mui/icons-material/Storage";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";

import { type DiskUsageIndexEntry } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { useQueryStore } from "../store/useQueryStore";
import { useApiConsoleStore } from "../store/useApiConsoleStore";
import { PAGE_MANIFEST } from "../routes/manifest";
import { runConnectionRequest } from "../hooks/useConnectionRequest";
import { useIndices, useIndexDetail } from "../hooks/useIndices";

import EmptyState from "./EmptyState";
import PageHeader from "./PageHeader";
import IndexDetailPanel from "./IndexDetailPanel";
import { type IndexTab, healthColor, INDEX_TABS } from "./indicesUtils";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function IndicesPage() {
  const connection = useConnectionStore((s) => s.connection);
  const setDiscoverQueryDraft = useQueryStore((s) => s.setDiscoverQueryDraft);
  const setConsoleDraft = useApiConsoleStore((s) => s.setConsoleDraft);
  const navigate = useNavigate();

  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault("").withOptions({ history: "replace" }),
  );
  const [showSystemIndices, setShowSystemIndices] = useState(false);
  const [selectedIndex, setSelectedIndex] = useQueryState("index", parseAsString);
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringEnum<IndexTab>(INDEX_TABS)
      .withDefault("overview")
      .withOptions({ history: "replace" }),
  );
  const [diskUsage, setDiskUsage] = useState<DiskUsageIndexEntry | null>(null);
  const [diskUsageLoading, setDiskUsageLoading] = useState(false);
  const [diskUsageError, setDiskUsageError] = useState<string | null>(null);

  const indicesResult = useIndices();
  const detailResult = useIndexDetail(selectedIndex);

  const loadingIndices = indicesResult.status === "loading";
  const error = indicesResult.status === "error" ? indicesResult.error : null;
  const indicesData = indicesResult.status === "success" ? indicesResult.data : null;
  const indices = useMemo(() => indicesData ?? [], [indicesData]);
  const mappings = detailResult.status === "success" ? detailResult.data.mappings : null;
  const settings = detailResult.status === "success" ? detailResult.data.settings : null;
  const indexStats = detailResult.status === "success" ? detailResult.data.indexStats : null;

  // Auto-select the first index when data loads
  useEffect(() => {
    if (!indicesData) return;
    if (selectedIndex && indicesData.some((i) => i.index === selectedIndex)) return;
    const first = showSystemIndices
      ? indicesData[0]
      : indicesData.find((i) => !i.index.startsWith("."));
    void setSelectedIndex(first?.index ?? null);
  }, [indicesData, showSystemIndices, selectedIndex, setSelectedIndex]);

  // Clear disk usage when selectedIndex changes
  useEffect(() => {
    setDiskUsage(null);
    setDiskUsageError(null);
  }, [selectedIndex]);

  // When system indices are hidden, deselect any active system index.
  useEffect(() => {
    if (showSystemIndices) return;
    if (!selectedIndex?.startsWith(".")) return;
    const first = indices.find((i) => !i.index.startsWith("."));
    void setSelectedIndex(first?.index ?? null);
  }, [showSystemIndices, selectedIndex, indices, setSelectedIndex]);

  const deferredSearch = useDeferredValue(search);
  const filteredIndices = useMemo(() => {
    return indices.filter((idx) => {
      if (!showSystemIndices && idx.index.startsWith(".")) return false;
      const term = deferredSearch.trim().toLowerCase();
      return !term || idx.index.toLowerCase().includes(term);
    });
  }, [indices, showSystemIndices, deferredSearch]);

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
    setDiscoverQueryDraft(`FROM ${selectedIndex} | LIMIT 50`);
    navigate(PAGE_MANIFEST.discover.path);
  }, [selectedIndex, navigate, setDiscoverQueryDraft]);

  const handleInspectInConsole = useCallback(() => {
    if (!selectedIndex) return;
    setConsoleDraft({ method: "GET", path: `/${selectedIndex}/_mapping` });
    navigate(PAGE_MANIFEST.console.path);
  }, [selectedIndex, navigate, setConsoleDraft]);

  const handleAnalyzeDiskUsage = useCallback(async () => {
    if (!connection || !selectedIndex) return;
    setDiskUsageLoading(true);
    setDiskUsageError(null);
    setDiskUsage(null);
    try {
      const { data, error } = await runConnectionRequest({
        connection,
        run: (client) => client.getIndexDiskUsage(selectedIndex),
      });
      if (error !== null) {
        setDiskUsageError(error);
      } else if (data !== null) {
        const entry = data[selectedIndex] as DiskUsageIndexEntry | undefined;
        setDiskUsage(entry ?? null);
      }
    } finally {
      setDiskUsageLoading(false);
    }
  }, [connection, selectedIndex]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
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
            </>
          }
        />
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: "flex", flex: 1, gap: 1, minHeight: 0 }}>
        {/* Left panel: index list */}
        <Paper
          variant="outlined"
          sx={{
            display: "flex",
            flexShrink: 0,
            flexDirection: "column",
            width: 280,
            minHeight: 0,
          }}
        >
          <Box sx={{ p: 1 }}>
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
          <Divider />
          <List
            dense
            sx={{ flex: 1, minHeight: 0, overflow: "auto" }}
            aria-label="Index list"
            tabIndex={0}
          >
            {filteredIndices.map((idx) => (
              <ListItem key={idx.index} disablePadding>
                <ListItemButton
                  selected={idx.index === selectedIndex}
                  onClick={() => void setSelectedIndex(idx.index)}
                >
                  <Chip
                    size="small"
                    color={healthColor(idx.health)}
                    label={idx.health.slice(0, 1).toUpperCase()}
                    aria-label={`Health: ${idx.health}`}
                    sx={{ flexShrink: 0, width: 24, height: 20, mr: 1, fontSize: "0.65rem" }}
                  />
                  <ListItemText
                    primary={idx.index}
                    secondary={`${idx.status} · ${idx.pri}P / ${idx.rep}R`}
                    primaryTypographyProps={{ noWrap: true, title: idx.index }}
                    sx={{ minWidth: 0 }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
            {!loadingIndices && filteredIndices.length === 0 && (
              <ListItem>
                <EmptyState
                  size="small"
                  icon={<StorageIcon sx={{ fontSize: 28 }} />}
                  heading="No indices found"
                  description={
                    showSystemIndices
                      ? "No indices match the current search filter."
                      : "Toggle 'Show system indices' above to include system indices."
                  }
                />
              </ListItem>
            )}
          </List>
        </Paper>

        {/* Right panel: index details */}
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
          onAnalyzeDiskUsage={() => void handleAnalyzeDiskUsage()}
        />
      </Box>
    </Box>
  );
}
