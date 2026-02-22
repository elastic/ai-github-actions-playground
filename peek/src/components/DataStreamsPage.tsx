import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import type { DataStreamInfo, FieldCapsResponse } from "../services/es";
import { useDashboardStore } from "../store/useDashboardStore";

function toFieldRows(fieldCaps: FieldCapsResponse) {
  return Object.entries(fieldCaps.fields ?? {})
    .flatMap(([name, capabilities]) =>
      Object.values(capabilities).map((cap) => ({ name, type: cap.type })),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function DataStreamsPage() {
  const connection = useDashboardStore((s) => s.connection);
  const setCurrentPage = useDashboardStore((s) => s.setCurrentPage);
  const setDiscoverQueryDraft = useDashboardStore((s) => s.setDiscoverQueryDraft);

  const [search, setSearch] = useState("");
  const [fieldSearch, setFieldSearch] = useState("");
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataStreams, setDataStreams] = useState<DataStreamInfo[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [fieldCaps, setFieldCaps] = useState<FieldCapsResponse | null>(null);
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
      const client = new ElasticsearchClient(connection);
      const response = await client.getDataStreams();
      const nextStreams = response.data_streams ?? [];
      setDataStreams(nextStreams);
      setSelectedName((current) => {
        if (current && nextStreams.some((stream) => stream.name === current)) {
          return current;
        }
        return nextStreams[0]?.name ?? null;
      });
    } catch (err) {
      setError(isElasticsearchError(err) ? err.message : String(err));
    } finally {
      setLoadingStreams(false);
    }
  }, [connection]);

  const loadFields = useCallback(
    async (dataStreamName: string) => {
      if (!connection) return;
      const requestId = fieldRequestIdRef.current + 1;
      fieldRequestIdRef.current = requestId;
      setLoadingFields(true);
      setError(null);
      try {
        const client = new ElasticsearchClient(connection);
        const response = await client.getFieldCaps(dataStreamName);
        if (requestId === fieldRequestIdRef.current) {
          setFieldCaps(response);
        }
      } catch (err) {
        if (requestId === fieldRequestIdRef.current) {
          setError(isElasticsearchError(err) ? err.message : String(err));
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

  const filteredStreams = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return dataStreams;
    return dataStreams.filter((stream) => stream.name.toLowerCase().includes(term));
  }, [dataStreams, search]);

  const fieldRows = useMemo(() => {
    const rows = fieldCaps ? toFieldRows(fieldCaps) : [];
    const term = fieldSearch.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(term));
  }, [fieldCaps, fieldSearch]);

  const handleOpenInDiscover = useCallback(() => {
    if (!selectedName) return;
    setDiscoverQueryDraft(`FROM ${selectedName} | SORT @timestamp DESC | LIMIT 50`);
    setCurrentPage("discover");
  }, [selectedName, setCurrentPage, setDiscoverQueryDraft]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: 0, height: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" sx={{ flex: 1 }}>
            Data Streams
          </Typography>
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
            Open in Discover
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: "flex", gap: 1, minHeight: 0, flex: 1 }}>
        <Paper
          variant="outlined"
          sx={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}
        >
          <Box sx={{ p: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search streams"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Box>
          <Divider />
          <List dense sx={{ overflow: "auto", minHeight: 0, flex: 1 }}>
            {filteredStreams.map((stream) => (
              <ListItemButton
                key={stream.name}
                selected={stream.name === selectedName}
                onClick={() => setSelectedName(stream.name)}
              >
                <ListItemText
                  primary={stream.name}
                  secondary={`${stream.indices.length} backing indices`}
                />
              </ListItemButton>
            ))}
            {!loadingStreams && filteredStreams.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No data streams found.
              </Typography>
            )}
          </List>
        </Paper>

        <Paper
          variant="outlined"
          sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
        >
          <Box sx={{ p: 1.5 }}>
            {selectedDataStream ? (
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="h6">{selectedDataStream.name}</Typography>
                <Chip size="small" label={`status: ${selectedDataStream.status}`} />
                <Chip size="small" label={`generation: ${selectedDataStream.generation}`} />
                <Chip size="small" label={`template: ${selectedDataStream.template}`} />
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Select a data stream.
              </Typography>
            )}
          </Box>
          <Divider />
          <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", minHeight: 0, gap: 1 }}>
            <TextField
              size="small"
              placeholder="Search fields"
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
            />
            {loadingFields ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Box sx={{ overflow: "auto", minHeight: 0, flex: 1 }}>
                {fieldRows.map((field) => (
                  <Stack
                    key={`${field.name}:${field.type}`}
                    direction="row"
                    spacing={1}
                    sx={{ py: 0.5 }}
                  >
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {field.name}
                    </Typography>
                    <Chip size="small" label={field.type} />
                  </Stack>
                ))}
                {!loadingFields && fieldRows.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No fields found for this stream.
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
