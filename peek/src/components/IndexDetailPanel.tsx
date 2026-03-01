import { Fragment } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import StorageIcon from "@mui/icons-material/Storage";

import { type DiskUsageIndexEntry, type CatIndexRecord } from "../services/es";
import { formatBytes } from "../utils/formatBytes";

import ContentSkeleton from "./ContentSkeleton";
import EmptyState from "./EmptyState";
import {
  type IndexTab,
  parseIntOrNull,
  extractMappingFields,
  extractSettings,
  healthColor,
} from "./indicesUtils";

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
// Types & helpers
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface IndexDetailPanelProps {
  selectedIndex: string | null;
  selectedRecord: CatIndexRecord | null;
  loadingDetail: boolean;
  activeTab: IndexTab;
  onTabChange: (tab: IndexTab) => void;
  mappings: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  indexStats: any;
  diskUsage: DiskUsageIndexEntry | null;
  diskUsageLoading: boolean;
  diskUsageError: string | null;
  onAnalyzeDiskUsage: () => void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const tabPanelId = (tab: IndexTab) => `index-tabpanel-${tab}`;
const tabId = (tab: IndexTab) => `index-tab-${tab}`;

// ---------------------------------------------------------------------------
// Tab content components
// ---------------------------------------------------------------------------

function OverviewContent({ selectedRecord }: { selectedRecord: CatIndexRecord | null }) {
  return (
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
                sx={{ height: 20, fontSize: "0.7rem" }}
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
}

function MappingsContent({
  selectedIndex,
  mappings,
}: {
  selectedIndex: string;
  mappings: Record<string, unknown> | null;
}) {
  const mappingFields = mappings ? extractMappingFields(mappings, selectedIndex) : [];
  return (
    <Box sx={{ height: "100%" }}>
      {mappingFields.length === 0 ? (
        <EmptyState
          size="small"
          heading="No mapping properties"
          description="No field definitions found for this index."
        />
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
}

function SettingsContent({
  selectedIndex,
  settings,
}: {
  selectedIndex: string;
  settings: Record<string, unknown> | null;
}) {
  const settingRows = settings ? extractSettings(settings, selectedIndex) : [];
  return (
    <Box sx={{ height: "100%" }}>
      {settingRows.length === 0 ? (
        <EmptyState
          size="small"
          heading="No settings"
          description="No configuration settings found for this index."
        />
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
                sx={{ py: 0.25, wordBreak: "break-all" }}
              >
                {key}
              </Typography>
              <Typography variant="body2" sx={{ py: 0.25, wordBreak: "break-all" }}>
                {value}
              </Typography>
            </Fragment>
          ))}
        </Box>
      )}
    </Box>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function StatsContent({ indexStats }: { indexStats: any }) {
  const totalStats = indexStats?._all?.total;
  const primaryStats = indexStats?._all?.primaries;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
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
}

function DiskUsageContent({
  diskUsage,
  diskUsageLoading,
  diskUsageError,
  onAnalyzeDiskUsage,
}: {
  diskUsage: DiskUsageIndexEntry | null;
  diskUsageLoading: boolean;
  diskUsageError: string | null;
  onAnalyzeDiskUsage: () => void;
}) {
  const diskUsageFields = diskUsage
    ? Object.entries(diskUsage.fields)
        .map(([name, stats]) => ({ name, totalBytes: stats.total_in_bytes, ...stats }))
        .sort((a, b) => b.totalBytes - a.totalBytes)
    : [];

  return (
    <Box>
      {!diskUsage && !diskUsageLoading && !diskUsageError && (
        <Stack spacing={1.5} alignItems="flex-start">
          <Alert severity="info">
            Disk usage analysis runs <code>POST /{"{index}"}/_disk_usage</code> which is resource
            intensive. Click the button below to analyze field-level storage consumption.
          </Alert>
          <Button size="small" variant="contained" onClick={onAnalyzeDiskUsage}>
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
                <Typography variant="body2" sx={{ py: 0.25, wordBreak: "break-all" }}>
                  {name}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ py: 0.25, textAlign: "right", whiteSpace: "nowrap" }}
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
}

// ---------------------------------------------------------------------------
// Main panel component
// ---------------------------------------------------------------------------

export default function IndexDetailPanel({
  selectedIndex,
  selectedRecord,
  loadingDetail,
  activeTab,
  onTabChange,
  mappings,
  settings,
  indexStats,
  diskUsage,
  diskUsageLoading,
  diskUsageError,
  onAnalyzeDiskUsage,
}: IndexDetailPanelProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {selectedIndex ? (
        <>
          <Box sx={{ pt: 1.5, pb: 0, px: 2 }}>
            <Typography variant="h6" component="h2">
              {selectedIndex}
            </Typography>
          </Box>
          <Tabs
            value={activeTab}
            onChange={(_, v: IndexTab) => onTabChange(v)}
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
              <ContentSkeleton variant="table" />
            ) : (
              <>
                {activeTab === "overview" && <OverviewContent selectedRecord={selectedRecord} />}
                {activeTab === "mappings" && (
                  <MappingsContent selectedIndex={selectedIndex} mappings={mappings} />
                )}
                {activeTab === "settings" && (
                  <SettingsContent selectedIndex={selectedIndex} settings={settings} />
                )}
                {activeTab === "stats" && <StatsContent indexStats={indexStats} />}
                {activeTab === "disk_usage" && (
                  <DiskUsageContent
                    diskUsage={diskUsage}
                    diskUsageLoading={diskUsageLoading}
                    diskUsageError={diskUsageError}
                    onAnalyzeDiskUsage={onAnalyzeDiskUsage}
                  />
                )}
              </>
            )}
          </Box>
        </>
      ) : (
        <EmptyState
          icon={<StorageIcon sx={{ fontSize: 32 }} />}
          heading="No index selected"
          description="Select an index from the list to view its details."
        />
      )}
    </Paper>
  );
}
