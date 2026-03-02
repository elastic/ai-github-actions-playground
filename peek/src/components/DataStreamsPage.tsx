import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import type { DataStreamInfo, FieldCapsResponse } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { useQueryStore } from "../store/useQueryStore";
import { useApiConsoleStore } from "../store/useApiConsoleStore";
import { PAGE_MANIFEST } from "../routes/manifest";
import { runConnectionRequest } from "../hooks/useConnectionRequest";

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

const COMPACT_CHIP_SX = { height: 20, fontSize: "0.7rem" } as const;

export default function DataStreamsPage() {
  const connection = useConnectionStore((s) => s.connection);
  const setDiscoverQueryDraft = useQueryStore((s) => s.setDiscoverQueryDraft);
  const setConsoleDraft = useApiConsoleStore((s) => s.setConsoleDraft);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [fieldSearch, setFieldSearch] = useState("");
  const [showSystemStreams, setShowSystemStreams] = useState(false);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataStreams, setDataStreams] = useState<DataStreamInfo[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [fieldCaps, setFieldCaps] = useState<FieldCapsResponse | null>(null);
  const [selectedField, setSelectedField] = useState<{ name: string; type: string } | null>(null);
  const fieldRequestIdRef = useRef(0);

  const selectedDataStream = useMemo(
    () => dataStreams.find((stream) => stream.name === selectedName) ?? null,
    [dataStreams, selectedName],
  );

  const loadDataStreams = useCallback(async () => {
    if (!connection) return;
    setLoadingStreams(true);
    setError(null);
    try {
      const { data, error } = await runConnectionRequest({
        connection,
        run: (client) => client.getDataStreams(),
      });
      if (error !== null) {
        setError(error);
      } else if (data !== null) {
        const nextStreams = data.data_streams ?? [];
        setDataStreams(nextStreams);
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
      }
    } finally {
      setLoadingStreams(false);
    }
  }, [connection, showSystemStreams]);

  const loadFields = useCallback(
    async (dataStreamName: string) => {
      if (!connection) return;
      const requestId = fieldRequestIdRef.current + 1;
      fieldRequestIdRef.current = requestId;
      setLoadingFields(true);
      setError(null);
      try {
        const { data, error } = await runConnectionRequest({
          connection,
          run: (client) => client.getFieldCaps(dataStreamName),
        });
        if (requestId !== fieldRequestIdRef.current) return;
        if (error !== null) {
          setError(error);
        } else if (data !== null) {
          setFieldCaps(data);
        }
      } finally {
        if (requestId === fieldRequestIdRef.current) {
          setLoadingFields(false);
        }
      }
    },
    [connection],
  );

  useEffect(() => {
    void loadDataStreams();
  }, [loadDataStreams]);

  useEffect(() => {
    if (!selectedName) {
      setFieldCaps(null);
      return;
    }
    void loadFields(selectedName);
  }, [selectedName, loadFields]);

  // When system streams are hidden, ensure the selected stream is not a hidden system stream.
  useEffect(() => {
    if (showSystemStreams) return;
    if (!selectedName?.startsWith(".")) return;
    const firstVisible = dataStreams.find((s) => !s.name.startsWith("."));
    setSelectedName(firstVisible?.name ?? null);
  }, [showSystemStreams, selectedName, dataStreams]);

  // Clear selected field when the active stream changes.
  useEffect(() => {
    setSelectedField(null);
  }, [selectedName]);

  const filteredStreams = useMemo(() => {
    const term = search.trim().toLowerCase();
    return dataStreams.filter((stream) => {
      if (!showSystemStreams && stream.name.startsWith(".")) return false;
      if (term && !stream.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [dataStreams, search, showSystemStreams]);

  const fieldRows = useMemo(() => {
    const rows = fieldCaps ? toFieldRows(fieldCaps) : [];
    const term = fieldSearch.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(term));
  }, [fieldCaps, fieldSearch]);

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
                onClick={loadDataStreams}
                disabled={loadingStreams}
              >
                {loadingStreams ? <CircularProgress size={16} /> : "Refresh"}
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={!selectedName}
                onClick={handleOpenInDiscover}
              >
                Open in Query Lab
              </Button>
              <Button
                size="small"
                variant="outlined"
                disabled={!selectedName}
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
              onChange={(e) => setSearch(e.target.value)}
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
            {selectedDataStream ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="subtitle1">{selectedDataStream.name}</Typography>
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
                    {selectedDataStream.status}
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    Generation
                  </Typography>
                  <Typography variant="body2" data-testid="data-stream-meta-generation">
                    {selectedDataStream.generation}
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    Backing indices
                  </Typography>
                  <Typography variant="body2" data-testid="data-stream-meta-backing-indices">
                    {selectedDataStream.indices.length}
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    Write index
                  </Typography>
                  <Typography variant="body2" data-testid="data-stream-meta-write-index">
                    {selectedDataStream.indices[selectedDataStream.indices.length - 1]
                      ?.index_name ?? "n/a"}
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    Managed by
                  </Typography>
                  <Typography variant="body2" data-testid="data-stream-meta-managed-by">
                    {selectedDataStream.next_generation_managed_by}
                  </Typography>

                  {selectedDataStream.ilm_policy && (
                    <>
                      <Typography variant="caption" color="text.secondary">
                        ILM policy
                      </Typography>
                      <Typography variant="body2" data-testid="data-stream-meta-ilm-policy">
                        {selectedDataStream.ilm_policy}
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
            {selectedDataStream && (
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
                {fieldRows.map((field) => (
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
                {!loadingFields && fieldRows.length === 0 && selectedDataStream && (
                  <Typography variant="body2" color="text.secondary">
                    No fields found for this data stream.
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </Paper>

        {selectedField && connection && selectedName && (
          <FieldStatsPanel
            connection={connection}
            streamName={selectedName}
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
