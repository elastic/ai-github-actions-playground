import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
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
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { type DiskUsageIndexEntry } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { useQueryStore } from "../store/useQueryStore";
import { useApiConsoleStore } from "../store/useApiConsoleStore";
import { formatBytes } from "../utils/formatBytes";
import { PAGE_MANIFEST } from "../routes/manifest";
import { runConnectionRequest } from "../hooks/useConnectionRequest";
import { useIndices, useIndexDetail } from "../hooks/useIndices";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IndexTab = "overview" | "mappings" | "settings" | "stats" | "disk_usage";

interface MappingField {
  name: string;
  type: string;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function parseIntOrNull(value: string | null | undefined): number | null {
  if (value == null) return null;
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
}

function flattenMappingProperties(
  properties: Record<string, unknown>,
  prefix = "",
): MappingField[] {
  const rows: MappingField[] = [];
  for (const [key, value] of Object.entries(properties)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    const def = value as Record<string, unknown>;
    rows.push({ name: fieldPath, type: (def.type as string) || "object" });
    if (def.properties && typeof def.properties === "object") {
      rows.push(...flattenMappingProperties(def.properties as Record<string, unknown>, fieldPath));
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

function extractMappingFields(
  mappingResponse: Record<string, unknown>,
  indexName: string,
): MappingField[] {
  const indexData = (mappingResponse[indexName] ?? Object.values(mappingResponse)[0]) as
    | Record<string, unknown>
    | undefined;
  if (!indexData) return [];
  const mappings = indexData.mappings as Record<string, unknown> | undefined;
  if (!mappings) return [];
  const properties = mappings.properties as Record<string, unknown> | undefined;
  if (!properties) return [];
  return flattenMappingProperties(properties);
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
): Array<{ key: string; value: string }> {
  const result: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      result.push(...flattenObject(v as Record<string, unknown>, fullKey));
    } else {
      result.push({ key: fullKey, value: Array.isArray(v) ? v.join(", ") : String(v ?? "") });
    }
  }
  return result.sort((a, b) => a.key.localeCompare(b.key));
}

function extractSettings(
  settingsResponse: Record<string, unknown>,
  indexName: string,
): Array<{ key: string; value: string }> {
  const indexData = (settingsResponse[indexName] ?? Object.values(settingsResponse)[0]) as
    | Record<string, unknown>
    | undefined;
  if (!indexData) return [];
  const settings = indexData.settings as Record<string, unknown> | undefined;
  if (!settings) return [];
  return flattenObject(settings);
}

function healthColor(health: string): "success" | "warning" | "error" | "default" {
  if (health === "green") return "success";
  if (health === "yellow") return "warning";
  if (health === "red") return "error";
  return "default";
}

// ---------------------------------------------------------------------------
// Small sub-components
// ---------------------------------------------------------------------------

function MetaGrid({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(160px, auto) 1fr",
        rowGap: 0.75,
        columnGap: 1.5,
      }}
    >
      {children}
    </Box>
  );
}

function MetaLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" color="text.secondary">
      {children}
    </Typography>
  );
}

function MetaValue({
  children,
  "data-testid": testId,
}: {
  children: React.ReactNode;
  "data-testid"?: string;
}) {
  return (
    <Typography variant="body2" component="div" data-testid={testId}>
      {children}
    </Typography>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function IndicesPage() {
  const connection = useConnectionStore((s) => s.connection);
  const setDiscoverQueryDraft = useQueryStore((s) => s.setDiscoverQueryDraft);
  const setConsoleDraft = useApiConsoleStore((s) => s.setConsoleDraft);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [showSystemIndices, setShowSystemIndices] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<IndexTab>("overview");
  const [diskUsage, setDiskUsage] = useState<DiskUsageIndexEntry | null>(null);
  const [diskUsageLoading, setDiskUsageLoading] = useState(false);
  const [diskUsageError, setDiskUsageError] = useState<string | null>(null);

  const indicesResult = useIndices();
  const detailResult = useIndexDetail(selectedIndex);

  const loadingIndices = indicesResult.status === "loading";
  const error = indicesResult.status === "error" ? indicesResult.error : null;
  const indicesData = indicesResult.status === "success" ? indicesResult.data : null;
  const indices = useMemo(() => indicesData ?? [], [indicesData]);
  // Treat "idle" as loading when an index is selected but the detail effect
  // hasn't fired yet. This prevents a brief flash of overview content before
  // the detail loading spinner appears (React effects run after render).
  const loadingDetail =
    detailResult.status === "loading" || (selectedIndex !== null && detailResult.status === "idle");
  const mappings = detailResult.status === "success" ? detailResult.data.mappings : null;
  const settings = detailResult.status === "success" ? detailResult.data.settings : null;
  const indexStats = detailResult.status === "success" ? detailResult.data.indexStats : null;

  // Auto-select the first index when data loads
  useEffect(() => {
    if (!indicesData) return;
    setSelectedIndex((current) => {
      if (current && indicesData.some((i) => i.index === current)) return current;
      const first = showSystemIndices
        ? indicesData[0]
        : indicesData.find((i) => !i.index.startsWith("."));
      return first?.index ?? null;
    });
  }, [indicesData, showSystemIndices]);

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
    setSelectedIndex(first?.index ?? null);
  }, [showSystemIndices, selectedIndex, indices]);

  const filteredIndices = indices.filter((idx) => {
    if (!showSystemIndices && idx.index.startsWith(".")) return false;
    const term = search.trim().toLowerCase();
    return !term || idx.index.toLowerCase().includes(term);
  });

  const selectedRecord = indices.find((i) => i.index === selectedIndex) ?? null;

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

  // ----- Tab panel ids -------------------------------------------------------
  const tabPanelId = (tab: IndexTab) => `index-tabpanel-${tab}`;
  const tabId = (tab: IndexTab) => `index-tab-${tab}`;

  // ----- Overview tab --------------------------------------------------------
  const overviewContent = (
    <MetaGrid>
      {selectedRecord ? (
        <>
          <MetaLabel>Health</MetaLabel>
          <MetaValue data-testid="index-meta-health">
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Chip
                size="small"
                label={selectedRecord.health.toUpperCase()}
                color={healthColor(selectedRecord.health)}
                sx={{ fontSize: "0.7rem", height: 20 }}
              />
            </Stack>
          </MetaValue>

          <MetaLabel>Status</MetaLabel>
          <MetaValue data-testid="index-meta-status">{selectedRecord.status}</MetaValue>

          <MetaLabel>Primary shards</MetaLabel>
          <MetaValue data-testid="index-meta-pri">{selectedRecord.pri}</MetaValue>

          <MetaLabel>Replica shards</MetaLabel>
          <MetaValue data-testid="index-meta-rep">{selectedRecord.rep}</MetaValue>

          <MetaLabel>Documents</MetaLabel>
          <MetaValue data-testid="index-meta-docs-count">
            {parseIntOrNull(selectedRecord["docs.count"])?.toLocaleString() ?? "n/a"}
          </MetaValue>

          <MetaLabel>Deleted documents</MetaLabel>
          <MetaValue data-testid="index-meta-docs-deleted">
            {parseIntOrNull(selectedRecord["docs.deleted"])?.toLocaleString() ?? "n/a"}
          </MetaValue>

          <MetaLabel>Store size</MetaLabel>
          <MetaValue data-testid="index-meta-store-size">
            {formatBytes(parseIntOrNull(selectedRecord["store.size"]))}
          </MetaValue>

          <MetaLabel>Primary store size</MetaLabel>
          <MetaValue data-testid="index-meta-pri-store-size">
            {formatBytes(parseIntOrNull(selectedRecord["pri.store.size"]))}
          </MetaValue>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ gridColumn: "span 2" }}>
          No index selected.
        </Typography>
      )}
    </MetaGrid>
  );

  // ----- Mappings tab --------------------------------------------------------
  const mappingFields =
    selectedIndex && mappings ? extractMappingFields(mappings, selectedIndex) : [];

  const mappingsContent = (
    <Box>
      {mappingFields.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No mapping properties found.
        </Typography>
      ) : (
        mappingFields.map((f) => (
          <Stack
            key={f.name}
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ py: 0.5, px: 0.5, borderRadius: 1 }}
          >
            <Typography variant="body2" sx={{ flex: 1, wordBreak: "break-all" }}>
              {f.name}
            </Typography>
            <Chip size="small" label={f.type} />
          </Stack>
        ))
      )}
    </Box>
  );

  // ----- Settings tab --------------------------------------------------------
  const settingRows = selectedIndex && settings ? extractSettings(settings, selectedIndex) : [];

  const settingsContent = (
    <Box>
      {settingRows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No settings found.
        </Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "minmax(200px, 1fr) 1fr",
            rowGap: 0.25,
            columnGap: 1,
          }}
        >
          {settingRows.map(({ key, value }) => (
            <Fragment key={key}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ wordBreak: "break-all", py: 0.25 }}
              >
                {key}
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: "break-all", py: 0.25 }}>
                {value}
              </Typography>
            </Fragment>
          ))}
        </Box>
      )}
    </Box>
  );

  // ----- Stats tab -----------------------------------------------------------
  const totalStats = indexStats?._all?.total;
  const primaryStats = indexStats?._all?.primaries;

  const statsContent = (
    <MetaGrid>
      {totalStats || primaryStats ? (
        <>
          <MetaLabel>Total documents</MetaLabel>
          <MetaValue data-testid="index-stats-docs-count">
            {totalStats?.docs?.count?.toLocaleString() ?? "n/a"}
          </MetaValue>

          <MetaLabel>Deleted documents</MetaLabel>
          <MetaValue data-testid="index-stats-docs-deleted">
            {totalStats?.docs?.deleted?.toLocaleString() ?? "n/a"}
          </MetaValue>

          <MetaLabel>Disk usage (total)</MetaLabel>
          <MetaValue data-testid="index-stats-store-total">
            {formatBytes(totalStats?.store?.size_in_bytes ?? null)}
          </MetaValue>

          <MetaLabel>Disk usage (primaries)</MetaLabel>
          <MetaValue data-testid="index-stats-store-primaries">
            {formatBytes(primaryStats?.store?.size_in_bytes ?? null)}
          </MetaValue>

          <MetaLabel>Segments</MetaLabel>
          <MetaValue data-testid="index-stats-segments">
            {totalStats?.segments?.count?.toLocaleString() ?? "n/a"}
          </MetaValue>

          <MetaLabel>Indexing operations</MetaLabel>
          <MetaValue data-testid="index-stats-indexing">
            {totalStats?.indexing?.index_total?.toLocaleString() ?? "n/a"}
          </MetaValue>

          <MetaLabel>Search queries</MetaLabel>
          <MetaValue data-testid="index-stats-search">
            {totalStats?.search?.query_total?.toLocaleString() ?? "n/a"}
          </MetaValue>

          <MetaLabel>Merges</MetaLabel>
          <MetaValue data-testid="index-stats-merges">
            {totalStats?.merge?.total?.toLocaleString() ?? "n/a"}
          </MetaValue>

          <MetaLabel>Refreshes</MetaLabel>
          <MetaValue data-testid="index-stats-refreshes">
            {totalStats?.refresh?.total?.toLocaleString() ?? "n/a"}
          </MetaValue>

          <MetaLabel>Flushes</MetaLabel>
          <MetaValue data-testid="index-stats-flushes">
            {totalStats?.flush?.total?.toLocaleString() ?? "n/a"}
          </MetaValue>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ gridColumn: "span 2" }}>
          No stats available.
        </Typography>
      )}
    </MetaGrid>
  );

  // ----- Disk Usage tab -------------------------------------------------------
  const diskUsageFields = diskUsage
    ? Object.entries(diskUsage.fields)
        .map(([name, stats]) => ({ name, totalBytes: stats.total_in_bytes, ...stats }))
        .sort((a, b) => b.totalBytes - a.totalBytes)
    : [];

  const diskUsageContent = (
    <Box>
      {!diskUsage && !diskUsageLoading && !diskUsageError && (
        <Stack spacing={1.5} alignItems="flex-start">
          <Alert severity="info">
            Disk usage analysis runs <code>POST /{"{index}"}/_disk_usage</code> which is resource
            intensive. Click the button below to analyze field-level storage consumption.
          </Alert>
          <Button size="small" variant="contained" onClick={() => void handleAnalyzeDiskUsage()}>
            Analyze disk usage
          </Button>
        </Stack>
      )}
      {diskUsageLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      {diskUsageError && <Alert severity="error">{diskUsageError}</Alert>}
      {diskUsage && (
        <Stack spacing={1.5}>
          <MetaGrid>
            <MetaLabel>Total analyzed size</MetaLabel>
            <MetaValue data-testid="disk-usage-total">
              {formatBytes(diskUsage.store_size_in_bytes)}
            </MetaValue>
            <MetaLabel>All fields (combined)</MetaLabel>
            <MetaValue data-testid="disk-usage-all-fields">
              {formatBytes(diskUsage.all_fields.total_in_bytes)}
            </MetaValue>
          </MetaGrid>
          <Divider />
          <Typography variant="subtitle2">
            Per-field breakdown ({diskUsageFields.length} fields)
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              rowGap: 0.25,
              columnGap: 2,
            }}
          >
            {diskUsageFields.map(({ name, totalBytes }) => (
              <Box key={name} sx={{ display: "contents" }}>
                <Typography variant="body2" sx={{ wordBreak: "break-all", py: 0.25 }}>
                  {name}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ textAlign: "right", whiteSpace: "nowrap", py: 0.25 }}
                >
                  {formatBytes(totalBytes)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Stack>
      )}
    </Box>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: 0, height: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" component="h1" sx={{ flex: 1 }}>
            Indices
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={indicesResult.refresh}
            disabled={loadingIndices}
          >
            {loadingIndices ? <CircularProgress size={16} /> : "Refresh"}
          </Button>
          <Tooltip title={!selectedIndex ? "Select an index first" : ""}>
            <span>
              <Button
                size="small"
                variant="contained"
                disabled={!selectedIndex}
                onClick={handleOpenInQueryLab}
              >
                Open in Query Lab
              </Button>
            </span>
          </Tooltip>
          <Button
            size="small"
            variant="outlined"
            disabled={!selectedIndex}
            onClick={handleInspectInConsole}
          >
            Inspect in Console
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: "flex", gap: 1, minHeight: 0, flex: 1 }}>
        {/* Left panel: index list */}
        <Paper
          variant="outlined"
          sx={{
            width: 280,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <Box sx={{ p: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search indices"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
          <List dense sx={{ overflow: "auto", minHeight: 0, flex: 1 }} aria-label="Index list">
            {filteredIndices.map((idx) => (
              <ListItem key={idx.index} disablePadding>
                <ListItemButton
                  selected={idx.index === selectedIndex}
                  onClick={() => setSelectedIndex(idx.index)}
                >
                  <Chip
                    size="small"
                    color={healthColor(idx.health)}
                    label={idx.health.slice(0, 1).toUpperCase()}
                    aria-label={`Health: ${idx.health}`}
                    sx={{ width: 24, height: 20, fontSize: "0.65rem", mr: 1, flexShrink: 0 }}
                  />
                  <ListItemText
                    primary={idx.index}
                    secondary={`${idx.status} · ${idx.pri}P / ${idx.rep}R`}
                    primaryTypographyProps={{ sx: { wordBreak: "break-all" } }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
            {!loadingIndices && filteredIndices.length === 0 && (
              <ListItem>
                <Typography variant="body2" color="text.primary">
                  No indices found.
                </Typography>
              </ListItem>
            )}
          </List>
        </Paper>

        {/* Right panel: index details */}
        <Paper
          variant="outlined"
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {selectedIndex ? (
            <>
              <Box sx={{ px: 2, pt: 1.5, pb: 0 }}>
                <Typography variant="h6" component="h2">
                  {selectedIndex}
                </Typography>
              </Box>
              <Tabs
                value={activeTab}
                onChange={(_, v: IndexTab) => setActiveTab(v)}
                sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
                aria-label="Index detail tabs"
              >
                <Tab
                  label="Overview"
                  value="overview"
                  id={tabId("overview")}
                  aria-controls={tabPanelId("overview")}
                />
                <Tab
                  label="Mappings"
                  value="mappings"
                  id={tabId("mappings")}
                  aria-controls={tabPanelId("mappings")}
                />
                <Tab
                  label="Settings"
                  value="settings"
                  id={tabId("settings")}
                  aria-controls={tabPanelId("settings")}
                />
                <Tab
                  label="Stats"
                  value="stats"
                  id={tabId("stats")}
                  aria-controls={tabPanelId("stats")}
                />
                <Tab
                  label="Disk Usage"
                  value="disk_usage"
                  id={tabId("disk_usage")}
                  aria-controls={tabPanelId("disk_usage")}
                />
              </Tabs>
              <Box
                role="tabpanel"
                id={tabPanelId(activeTab)}
                aria-labelledby={tabId(activeTab)}
                sx={{ flex: 1, overflow: "auto", p: 2 }}
              >
                {loadingDetail ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : (
                  <>
                    {activeTab === "overview" && overviewContent}
                    {activeTab === "mappings" && mappingsContent}
                    {activeTab === "settings" && settingsContent}
                    {activeTab === "stats" && statsContent}
                    {activeTab === "disk_usage" && diskUsageContent}
                  </>
                )}
              </Box>
            </>
          ) : (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Select an index to view details.
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
