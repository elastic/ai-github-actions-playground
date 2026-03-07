import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
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

import { useClusterSettings } from "../hooks/useClusterSettings";

import EmptyState from "./EmptyState";
import PageHeader from "./PageHeader";

type SettingsSource = "persistent" | "transient" | "default";
type SortField = "key" | "value";
type SortDirection = "asc" | "desc";

interface SettingsRow {
  key: string;
  value: string;
  source: SettingsSource;
}

function flattenSettings(
  source: SettingsSource,
  settings: Record<string, unknown> | undefined,
): SettingsRow[] {
  if (!settings) return [];
  return Object.entries(settings).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
    source,
  }));
}

function sourceRank(source: SettingsSource): number {
  if (source === "transient") return 0;
  if (source === "persistent") return 1;
  return 2;
}

function sourceColor(source: SettingsSource): "warning" | "success" | "default" {
  if (source === "transient") return "warning";
  if (source === "persistent") return "success";
  return "default";
}

export default function ClusterSettingsPage() {
  const [search, setSearch] = useState("");
  const [showDefaults, setShowDefaults] = useState(false);
  const [sortField, setSortField] = useState<SortField>("key");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const result = useClusterSettings();

  const loading = result.status === "loading";
  const error = result.status === "error" ? result.error : null;
  const data = result.status === "success" ? result.data : null;

  const allRows = useMemo(() => {
    const transient = flattenSettings("transient", data?.transient);
    const persistent = flattenSettings("persistent", data?.persistent);
    const defaults = flattenSettings("default", data?.defaults);
    return [...transient, ...persistent, ...defaults];
  }, [data]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const sourceFilteredRows = showDefaults
      ? allRows
      : allRows.filter((row) => row.source !== "default");
    const rows = term
      ? sourceFilteredRows.filter(
          (row) => row.key.toLowerCase().includes(term) || row.value.toLowerCase().includes(term),
        )
      : sourceFilteredRows;

    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortField === "key") cmp = a.key.localeCompare(b.key);
      else cmp = a.value.localeCompare(b.value);
      if (cmp !== 0) return sortDirection === "asc" ? cmp : -cmp;
      const bySource = sourceRank(a.source) - sourceRank(b.source);
      if (bySource !== 0) return bySource;
      return a.key.localeCompare(b.key);
    });
  }, [allRows, search, showDefaults, sortField, sortDirection]);
  const hasAnySettings = allRows.length > 0;
  const hasFilteredRows = filteredRows.length > 0;
  const emptySettingsHeading = hasAnySettings ? "No matching settings" : "No cluster settings";
  const emptySettingsDescription = hasAnySettings
    ? "Try a different filter."
    : "No cluster settings were returned by this cluster.";

  const counts = useMemo(() => {
    const tally = { transient: 0, persistent: 0, default: 0 };
    for (const row of allRows) tally[row.source] += 1;
    return tally;
  }, [allRows]);

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection("asc");
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Cluster Settings"
          description="Flattened settings from /_cluster/settings with transient, persistent, and defaults."
          actions={
            <Button
              size="small"
              variant="outlined"
              onClick={result.refresh}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={14} aria-hidden="true" /> : undefined}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          }
        />
        <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={`Transient ${counts.transient.toLocaleString()}`}
            color="warning"
          />
          <Chip
            size="small"
            label={`Persistent ${counts.persistent.toLocaleString()}`}
            color="success"
          />
          <Chip size="small" label={`Defaults ${counts.default.toLocaleString()}`} />
          <Chip
            size="small"
            label={`Total ${allRows.length.toLocaleString()}`}
            variant="outlined"
          />
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper
        variant="outlined"
        sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}
      >
        <Box sx={{ p: 1 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Filter settings by key or value"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              inputProps={{ "aria-label": "Filter settings by key or value" }}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={showDefaults}
                  onChange={(event) => setShowDefaults(event.target.checked)}
                  inputProps={{ "aria-label": "Show defaults" }}
                />
              }
              label={<Typography variant="body2">Show defaults</Typography>}
              sx={{ ml: { md: 0.5 } }}
            />
          </Stack>
        </Box>
        <TableContainer sx={{ flex: 1 }}>
          <Table stickyHeader size="small" aria-label="Cluster settings table">
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={sortField === "key"}
                    direction={sortField === "key" ? sortDirection : "asc"}
                    onClick={() => handleSort("key")}
                  >
                    Setting
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === "value"}
                    direction={sortField === "value" ? sortDirection : "asc"}
                    onClick={() => handleSort("value")}
                  >
                    Value
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ width: 130 }}>Source</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={`${row.source}:${row.key}`}>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "0.8rem",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        lineHeight: 1.35,
                      }}
                      title={row.key}
                    >
                      {row.key}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                      {row.value}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={sourceColor(row.source)}
                      label={row.source}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {result.status === "success" && !hasFilteredRows && (
          <EmptyState
            size="small"
            heading={emptySettingsHeading}
            description={emptySettingsDescription}
          />
        )}
      </Paper>
    </Box>
  );
}
