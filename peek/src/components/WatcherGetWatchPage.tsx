import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";

import { useTableSort } from "../hooks/useTableSort";
import { useWatcherQueryWatches } from "../hooks/useWatcherQueryWatches";
import { useWatcherWatch } from "../hooks/useWatcherWatch";

import EmptyState from "./EmptyState";
import PageContainer from "./PageContainer";
import PageHeaderSection from "./PageHeaderSection";

function formatTimestamp(value: string | number | undefined): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return new Date(value).toISOString();
  return "n/a";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getScheduleLabel(watch: Record<string, unknown> | undefined): string {
  const trigger = asRecord(watch?.trigger);
  const schedule = asRecord(trigger?.schedule);
  if (!schedule) return "n/a";
  if (typeof schedule.interval === "string") return `interval ${schedule.interval}`;
  if ("cron" in schedule) return "cron";
  if ("hourly" in schedule) return "hourly";
  if ("daily" in schedule) return "daily";
  if ("weekly" in schedule) return "weekly";
  if ("monthly" in schedule) return "monthly";
  return "custom schedule";
}

function getMetadataString(watch: Record<string, unknown> | undefined, key: string): string {
  const metadata = asRecord(watch?.metadata);
  const value = metadata?.[key];
  if (typeof value === "string" && value.trim().length > 0) return value;
  return "n/a";
}

function getActionType(value: unknown): string {
  const obj = asRecord(value);
  if (!obj) return "n/a";
  const keys = Object.keys(obj);
  return keys[0] ?? "n/a";
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

type SortField =
  | "id"
  | "active"
  | "state"
  | "trigger"
  | "ack"
  | "owner"
  | "lastChecked"
  | "actions";

interface WatchTableRow {
  id: string;
  active: boolean;
  state: string;
  trigger: string;
  ack: string;
  owner: string;
  lastChecked: string;
  lastCheckedEpoch: number;
  actionCount: number;
}

export default function WatcherGetWatchPage() {
  const [selectedWatchId, setSelectedWatchId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { sortField, sortDirection, getSortLabelProps } = useTableSort<SortField>("id");
  const listResult = useWatcherQueryWatches({ size: 500 });
  const watchResult = useWatcherWatch(selectedWatchId ?? "");
  const loading = watchResult.status === "loading";
  const watchData = watchResult.status === "success" ? watchResult.data : null;
  const listedWatches = useMemo(() => {
    if (listResult.status !== "success") return [];
    return [...listResult.data.watches].sort((a, b) => a._id.localeCompare(b._id));
  }, [listResult]);
  const output = useMemo(() => (watchData ? JSON.stringify(watchData, null, 2) : ""), [watchData]);
  const selectedWatchSummary = useMemo(
    () => listedWatches.find((watch) => watch._id === selectedWatchId) ?? null,
    [listedWatches, selectedWatchId],
  );
  const tableRows = useMemo<WatchTableRow[]>(
    () =>
      listedWatches.map((watch) => {
        const active = Boolean(watch.status?.state?.active);
        const state = watch.status?.execution_state ?? "n/a";
        const trigger = getScheduleLabel(watch.watch);
        const ackStates = Object.values(watch.status?.actions ?? {})
          .map((entry) => entry.ack?.state)
          .filter((ackState): ackState is string => typeof ackState === "string");
        const ack = ackStates[0] ?? "n/a";
        const owner = getMetadataString(watch.watch, "owner");
        const lastChecked = formatTimestamp(watch.status?.last_checked);
        const parsedLastChecked =
          typeof watch.status?.last_checked === "number"
            ? watch.status.last_checked
            : typeof watch.status?.last_checked === "string"
              ? Date.parse(watch.status.last_checked)
              : Number.NaN;
        return {
          id: watch._id,
          active,
          state,
          trigger,
          ack,
          owner,
          lastChecked,
          lastCheckedEpoch: Number.isFinite(parsedLastChecked) ? parsedLastChecked : -1,
          actionCount: Object.keys(watch.status?.actions ?? {}).length,
        };
      }),
    [listedWatches],
  );
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = term
      ? tableRows.filter((row) =>
          [
            row.id,
            row.state,
            row.trigger,
            row.ack,
            row.owner,
            row.lastChecked,
            row.active ? "yes" : "no",
          ].some((value) => value.toLowerCase().includes(term)),
        )
      : tableRows;
    const sorted = [...rows].sort((a, b) => {
      let compare = 0;
      switch (sortField) {
        case "id":
          compare = a.id.localeCompare(b.id);
          break;
        case "active":
          compare = Number(a.active) - Number(b.active);
          break;
        case "state":
          compare = a.state.localeCompare(b.state);
          break;
        case "trigger":
          compare = a.trigger.localeCompare(b.trigger);
          break;
        case "ack":
          compare = a.ack.localeCompare(b.ack);
          break;
        case "owner":
          compare = a.owner.localeCompare(b.owner);
          break;
        case "lastChecked":
          compare = a.lastCheckedEpoch - b.lastCheckedEpoch;
          break;
        case "actions":
          compare = a.actionCount - b.actionCount;
          break;
      }
      return sortDirection === "asc" ? compare : -compare;
    });
    return sorted;
  }, [search, sortDirection, sortField, tableRows]);

  return (
    <PageContainer>
      <PageHeaderSection
        title="Watchers"
        actions={
          <Button
            size="small"
            variant="outlined"
            onClick={listResult.refresh}
            disabled={listResult.status === "loading"}
            startIcon={
              listResult.status === "loading" ? (
                <CircularProgress size={14} aria-hidden="true" />
              ) : undefined
            }
          >
            {listResult.status === "loading" ? "Refreshing..." : "Refresh list"}
          </Button>
        }
      />

      {watchResult.status === "error" && <Alert severity="error">{watchResult.error}</Alert>}
      {listResult.status === "error" && <Alert severity="warning">{listResult.error}</Alert>}

      <Paper variant="outlined" sx={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        {listResult.status === "loading" ? (
          <EmptyState
            size="small"
            heading="Loading watches"
            description="Querying registered watches..."
          />
        ) : listedWatches.length === 0 ? (
          <EmptyState
            size="small"
            heading="No watches found"
            description="No watcher definitions were returned."
          />
        ) : (
          <TableContainer sx={{ flex: 1 }}>
            <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Search watches"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                inputProps={{ "aria-label": "Search watches" }}
              />
            </Box>
            <Table stickyHeader size="small" aria-label="Watcher watches table">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel {...getSortLabelProps("id")}>Watch ID</TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel {...getSortLabelProps("active")}>Active</TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel {...getSortLabelProps("state")}>State</TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel {...getSortLabelProps("trigger")}>Trigger</TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel {...getSortLabelProps("ack")}>Ack</TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel {...getSortLabelProps("owner")}>Owner</TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel {...getSortLabelProps("lastChecked")}>
                      Last checked
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel {...getSortLabelProps("actions")}>Actions</TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.map((row) => {
                  return (
                    <TableRow
                      key={row.id}
                      hover
                      selected={selectedWatchId === row.id}
                      onClick={() => setSelectedWatchId(row.id)}
                      sx={{ cursor: "pointer" }}
                      aria-label={`Open watch ${row.id}`}
                    >
                      <TableCell>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ fontFamily: "monospace" }}
                          title={row.id}
                        >
                          {row.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.active ? "Yes" : "No"}
                          color={row.active ? "success" : "default"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.state}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.trigger}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.ack}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap title={row.owner}>
                          {row.owner}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap title={row.lastChecked}>
                          {row.lastChecked}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{row.actionCount.toLocaleString()}</Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ border: 0 }}>
                      <EmptyState
                        size="small"
                        heading="No matching watches"
                        description="Try a different search term."
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Drawer
        anchor="right"
        open={Boolean(selectedWatchId)}
        onClose={() => setSelectedWatchId(null)}
        PaperProps={{
          sx: {
            width: { xs: "100%", md: 620 },
            p: 1,
            backgroundColor: "background.default",
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1 }}>
          <Typography variant="subtitle1">Watch details</Typography>
          <IconButton
            size="small"
            aria-label="Close watch details"
            onClick={() => setSelectedWatchId(null)}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ p: 1, overflow: "auto", minHeight: 0, flex: 1 }}>
          {loading ? (
            <EmptyState
              size="small"
              heading="Loading watch"
              description="Fetching watch definition..."
            />
          ) : watchResult.status === "error" ? (
            <Alert severity="error">{watchResult.error}</Alert>
          ) : watchData ? (
            <Stack spacing={1}>
              {(() => {
                const watch = asRecord(watchData.watch) ?? {};
                const statusActions = watchData.status?.actions ?? {};
                const watchActions = asRecord(watch.actions) ?? {};
                const actionIds = Array.from(
                  new Set([...Object.keys(statusActions), ...Object.keys(watchActions)]),
                );
                return (
                  <>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip
                        size="small"
                        label={`ID ${watchData._id ?? selectedWatchId ?? "unknown"}`}
                      />
                      <Chip
                        size="small"
                        label={`Found ${watchData.found === false ? "no" : "yes"}`}
                        color={watchData.found === false ? "warning" : "success"}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={`Active ${watchData.status?.state?.active ? "yes" : "no"}`}
                        variant="outlined"
                      />
                      {watchData.status?.execution_state && (
                        <Chip
                          size="small"
                          label={`State ${watchData.status.execution_state}`}
                          variant="outlined"
                        />
                      )}
                      <Button size="small" variant="outlined" onClick={watchResult.refresh}>
                        Refresh details
                      </Button>
                    </Stack>
                    <Paper variant="outlined" sx={{ p: 1 }}>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Overview
                      </Typography>
                      <Stack spacing={0.5}>
                        <Typography variant="body2">
                          <strong>Trigger:</strong> {getScheduleLabel(watch)}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Owner:</strong> {getMetadataString(watch, "owner")}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Purpose:</strong> {getMetadataString(watch, "purpose")}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Last checked:</strong>{" "}
                          {formatTimestamp(watchData.status?.last_checked)}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Last met condition:</strong>{" "}
                          {formatTimestamp(watchData.status?.last_met_condition)}
                        </Typography>
                      </Stack>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1 }}>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Trigger
                      </Typography>
                      <Typography
                        component="pre"
                        variant="body2"
                        sx={{
                          m: 0,
                          fontFamily: "monospace",
                          fontSize: "0.78rem",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {prettyJson(watch.trigger)}
                      </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1 }}>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Input
                      </Typography>
                      <Typography
                        component="pre"
                        variant="body2"
                        sx={{
                          m: 0,
                          fontFamily: "monospace",
                          fontSize: "0.78rem",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {prettyJson(watch.input)}
                      </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1 }}>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Condition
                      </Typography>
                      <Typography
                        component="pre"
                        variant="body2"
                        sx={{
                          m: 0,
                          fontFamily: "monospace",
                          fontSize: "0.78rem",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {prettyJson(watch.condition)}
                      </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1 }}>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Actions
                      </Typography>
                      {actionIds.length === 0 ? (
                        <EmptyState
                          size="small"
                          heading="No actions defined"
                          description="This watch does not currently define any actions."
                        />
                      ) : (
                        <Table size="small" aria-label="Watch action details">
                          <TableHead>
                            <TableRow>
                              <TableCell>Action ID</TableCell>
                              <TableCell>Type</TableCell>
                              <TableCell>Ack state</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {actionIds.map((actionId) => (
                              <TableRow key={actionId}>
                                <TableCell>
                                  <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                                    {actionId}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {getActionType(watchActions[actionId])}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {statusActions[actionId]?.ack?.state ?? "n/a"}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1 }}>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Metadata
                      </Typography>
                      <Typography
                        component="pre"
                        variant="body2"
                        sx={{
                          m: 0,
                          fontFamily: "monospace",
                          fontSize: "0.78rem",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {prettyJson(watch.metadata)}
                      </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1.5 }}>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Raw JSON
                      </Typography>
                      <Typography
                        component="pre"
                        variant="body2"
                        sx={{
                          m: 0,
                          fontFamily: "monospace",
                          fontSize: "0.78rem",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                        data-testid="watcher-get-watch-output"
                      >
                        {output}
                      </Typography>
                    </Paper>
                  </>
                );
              })()}
            </Stack>
          ) : (
            <EmptyState
              size="small"
              heading="No watch selected"
              description={
                selectedWatchSummary
                  ? "Select a watch row to inspect status and definition."
                  : "Select a watch row from the table."
              }
            />
          )}
        </Box>
      </Drawer>
    </PageContainer>
  );
}
