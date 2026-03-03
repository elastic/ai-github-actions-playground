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
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import StorageIcon from "@mui/icons-material/Storage";
import { parseAsString, useQueryState } from "nuqs";

import type { FieldCapsResponse } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { useQueryStore } from "../store/useQueryStore";
import { useApiConsoleStore } from "../store/useApiConsoleStore";
import { usePageContextStore } from "../store/usePageContextStore";
import { PAGE_MANIFEST } from "../routes/manifest";
import { useDataStreams } from "../hooks/useDataStreams";
import { useFieldCaps } from "../hooks/useFieldCaps";
import { COMPACT_CHIP_SX } from "../types/tokens";

import ContentSkeleton from "./ContentSkeleton";
import EmptyState from "./EmptyState";
import FieldStatsPanel from "./FieldStatsPanel";
import PageHeader from "./PageHeader";

function toFieldRows(fieldCaps: FieldCapsResponse) {
  return Object.entries(fieldCaps.fields ?? {})
    .flatMap(([name, capabilities]) =>
      Object.values(capabilities).map((cap) => ({ name, type: cap.type })),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

const STATUS_CHIP_COLORS: Record<string, "success" | "warning" | "error" | "default"> = {
  GREEN: "success",
  YELLOW: "warning",
  RED: "error",
};

export default function DataStreamsPage() {
  const connection = useConnectionStore((s) => s.connection);
  const setDiscoverQueryDraft = useQueryStore((s) => s.setDiscoverQueryDraft);
  const setConsoleDraft = useApiConsoleStore((s) => s.setConsoleDraft);
  const navigate = useNavigate();

  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault("").withOptions({ history: "replace" }),
  );
  const [fieldSearch, setFieldSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const deferredFieldSearch = useDeferredValue(fieldSearch);
  const [showSystemStreams, setShowSystemStreams] = useState(false);
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
    return dataStreams.filter((stream) => {
      if (!showSystemStreams && stream.name.startsWith(".")) return false;
      if (term && !stream.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [dataStreams, deferredSearch, showSystemStreams]);

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
  }, [streamsData, selectedName, setPageSection]);

  const fieldRows = useMemo(() => {
    const rows = fieldCaps ? toFieldRows(fieldCaps) : [];
    const term = deferredFieldSearch.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(term));
  }, [fieldCaps, deferredFieldSearch]);

  const handleOpenInDiscover = useCallback(() => {
    if (!selectedName) return;
    setDiscoverQueryDraft(`FROM ${selectedName} | SORT @timestamp DESC | LIMIT 50`);
    navigate(PAGE_MANIFEST.discover.path);
  }, [selectedName, navigate, setDiscoverQueryDraft]);

  const handleInspectInConsole = useCallback(() => {
    if (!selectedName) return;
    setConsoleDraft({ method: "GET", path: `/_data_stream/${selectedName}` });
    navigate(PAGE_MANIFEST.console.path);
  }, [selectedName, navigate, setConsoleDraft]);

  const handleFieldStatsQuery = useCallback(
    (query: string) => {
      setDiscoverQueryDraft(query);
      navigate(PAGE_MANIFEST.discover.path);
    },
    [navigate, setDiscoverQueryDraft],
  );

  return (
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
              >
                {loadingStreams ? <CircularProgress size={16} /> : "Refresh"}
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
            </>
          }
        />
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: "flex", flex: 1, gap: 1, minHeight: 0 }}>
        <Paper
          variant="outlined"
          sx={{ display: "flex", flexShrink: 0, flexDirection: "column", width: 320, minHeight: 0 }}
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
          <List dense sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            {filteredStreams.map((stream) => (
              <ListItem key={stream.name} disablePadding>
                <ListItemButton
                  selected={stream.name === selectedName}
                  onClick={() => setSelectedName(stream.name)}
                >
                  <ListItemText
                    primary={stream.name}
                    primaryTypographyProps={{
                      noWrap: true,
                      title: stream.name,
                      sx: { fontFamily: "monospace", fontSize: "0.85rem" },
                    }}
                    secondaryTypographyProps={{ component: "span" }}
                    sx={{ minWidth: 0 }}
                    secondary={
                      <Box
                        component="span"
                        sx={{ display: "inline-flex", gap: 0.5, alignItems: "center", mt: 0.5 }}
                      >
                        <Chip
                          component="span"
                          label={stream.status.toUpperCase()}
                          color={STATUS_CHIP_COLORS[stream.status.toUpperCase()] ?? "default"}
                          size="small"
                          sx={COMPACT_CHIP_SX}
                        />
                        <Chip
                          component="span"
                          label={`${stream.indices.length} ${stream.indices.length === 1 ? "Index" : "Indices"}`}
                          size="small"
                          variant="outlined"
                          sx={COMPACT_CHIP_SX}
                        />
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
            {!loadingStreams && filteredStreams.length === 0 && (
              <EmptyState
                size="small"
                heading="No data streams found"
                description="Try adjusting your search or check that data streams exist in the cluster"
              />
            )}
          </List>
        </Paper>

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
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: 0, p: 1.5 }}>
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
                        selectedField?.name === field.name && selectedField?.type === field.type
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
                          selectedField?.name === field.name && selectedField?.type === field.type
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

        {selectedField && connection && displayedName && (
          <FieldStatsPanel
            connection={connection}
            streamName={displayedName}
            fieldName={selectedField.name}
            fieldType={selectedField.type}
            onClose={() => setSelectedField(null)}
            onOpenInQueryLab={handleFieldStatsQuery}
          />
        )}
      </Box>
    </Box>
  );
}
