import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";

import { ElasticsearchClient, isElasticsearchError } from "../../services/es";
import type { ElasticsearchConnection } from "../../services/es";
import { useOpenInDiscover } from "../../hooks/useOpenInDiscover";
import ContentSkeleton from "../ContentSkeleton";
import EmptyState from "../EmptyState";
import { escapeEsqlString } from "../../services/es/esqlUtils";

import { LOGS_DIMENSION_LABELS, type LogsFocusDimension } from "./LogsLandingPage";

interface ValueRow {
  value: string;
  count: number;
}

interface LogsDimensionListPageProps {
  dimension: LogsFocusDimension;
  connection: ElasticsearchConnection;
  onBack: () => void;
}

export default function LogsDimensionListPage({
  dimension,
  connection,
  onBack,
}: LogsDimensionListPageProps) {
  const openInDiscover = useOpenInDiscover();
  const [rows, setRows] = useState<ValueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const fetchValues = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const client = new ElasticsearchClient(connection);
      const query = `FROM logs-* | WHERE ${dimension} IS NOT NULL | STATS count = COUNT(*) BY ${dimension} | SORT count DESC | LIMIT 200`;
      const result = await client.query({ query }, controller.signal);
      const dimCol = result.columns.findIndex((c) => c.name === dimension);
      const countCol = result.columns.findIndex((c) => c.name === "count");
      if (dimCol < 0 || countCol < 0) {
        throw new Error(`Unexpected response: missing ${dimension} or count column`);
      }
      const parsed: ValueRow[] = result.values
        .map((row) => ({
          value: String(row[dimCol] ?? ""),
          count: Number(row[countCol] ?? 0),
        }))
        .filter((r) => r.value.length > 0);
      setRows(parsed);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setError(isElasticsearchError(err) ? err.message : String(err));
    } finally {
      if (!controller.signal.aborted && abortRef.current === controller) setLoading(false);
    }
  }, [connection, dimension]);

  useEffect(() => {
    void fetchValues();
    return () => abortRef.current?.abort();
  }, [fetchValues]);

  const handleOpenInQueryLab = useCallback(
    (value: string) => {
      const escaped = escapeEsqlString(value);
      openInDiscover(
        `FROM logs-* | WHERE ${dimension} == "${escaped}" | SORT @timestamp DESC | LIMIT 500`,
      );
    },
    [dimension, openInDiscover],
  );

  const maxCount = rows[0]?.count || 1;
  const filtered = search.trim()
    ? rows.filter((r) => r.value.toLowerCase().includes(search.trim().toLowerCase()))
    : rows;

  const { singular: dimensionLabel, plural: dimensionPluralLabel } =
    LOGS_DIMENSION_LABELS[dimension];
  const noData = rows.length === 0;
  const emptyHeading = noData
    ? `No ${dimensionLabel.toLowerCase()} data found`
    : `No results match "${search}"`;
  const emptyDescription = noData
    ? `No values for ${dimension} were found in logs-* for the current time range.`
    : undefined;

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 2 }}>
        <Button size="small" variant="text" startIcon={<ArrowBackIcon />} onClick={onBack}>
          Back
        </Button>
        <Box>
          <Typography variant="h6">{dimensionPluralLabel}</Typography>
          <Typography variant="body2" color="text.secondary">
            Ranked by log volume &mdash; click to explore in Query Lab
          </Typography>
        </Box>
      </Box>

      <TextField
        placeholder={`Search ${dimensionLabel.toLowerCase()} names\u2026`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          },
        }}
      />

      {loading && <ContentSkeleton variant="list" />}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState heading={emptyHeading} description={emptyDescription} size="small" />
      )}

      {!loading && !error && filtered.length > 0 && (
        <List disablePadding>
          {filtered.map((row) => (
            <ListItemButton
              key={row.value}
              onClick={() => handleOpenInQueryLab(row.value)}
              sx={{ mb: 0.5, borderRadius: 1 }}
            >
              <ListItemText
                primary={row.value}
                secondary={
                  <Box
                    component="span"
                    sx={{ display: "flex", gap: 1, alignItems: "center", mt: 0.5 }}
                  >
                    <LinearProgress
                      variant="determinate"
                      value={(row.count / maxCount) * 100}
                      sx={{ flex: 1, height: 4, borderRadius: 2 }}
                    />
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ whiteSpace: "nowrap" }}
                    >
                      {row.count.toLocaleString()} logs
                    </Typography>
                  </Box>
                }
                slotProps={{ secondary: { component: "div" } }}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Paper>
  );
}
