import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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
import type { IngestPipeline, SimulateIngestPipelineResponse } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";

type PipelineEntry = { name: string; pipeline: IngestPipeline };

export default function IngestPipelinesPage() {
  const connection = useConnectionStore((s) => s.connection);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelines, setPipelines] = useState<PipelineEntry[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  // Simulate state
  const [simulateInput, setSimulateInput] = useState('{\n  "_source": {}\n}');
  const [simulating, setSimulating] = useState(false);
  const [simulateError, setSimulateError] = useState<string | null>(null);
  const [simulateResult, setSimulateResult] = useState<SimulateIngestPipelineResponse | null>(null);

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => p.name === selectedName) ?? null,
    [pipelines, selectedName],
  );

  const loadPipelines = useCallback(async () => {
    if (!connection) return;
    setLoading(true);
    setError(null);
    try {
      const client = new ElasticsearchClient(connection);
      const response = await client.getIngestPipelines();
      const next = Object.entries(response)
        .map(([name, pipeline]) => ({ name, pipeline }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setPipelines(next);
      setSelectedName((current) =>
        current && next.some((p) => p.name === current) ? current : (next[0]?.name ?? null),
      );
    } catch (err) {
      setError(isElasticsearchError(err) ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void loadPipelines();
  }, [loadPipelines]);

  // Clear simulate results when selection changes
  useEffect(() => {
    setSimulateResult(null);
    setSimulateError(null);
  }, [selectedName]);

  const filteredPipelines = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return pipelines;
    return pipelines.filter((p) => p.name.toLowerCase().includes(term));
  }, [pipelines, search]);

  const handleSimulate = useCallback(async () => {
    if (!connection || !selectedName) return;
    setSimulating(true);
    setSimulateError(null);
    setSimulateResult(null);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(simulateInput);
      } catch {
        setSimulateError("Invalid JSON: please enter a valid document object.");
        return;
      }
      // Accept either a raw _source object or a full doc wrapper
      const doc =
        parsed !== null && typeof parsed === "object" && "_source" in (parsed as object)
          ? (parsed as Record<string, unknown>)
          : { _source: parsed };
      const client = new ElasticsearchClient(connection);
      const result = await client.simulateIngestPipeline(selectedName, [doc]);
      setSimulateResult(result);
    } catch (err) {
      setSimulateError(isElasticsearchError(err) ? err.message : String(err));
    } finally {
      setSimulating(false);
    }
  }, [connection, selectedName, simulateInput]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: 0, height: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" sx={{ flex: 1 }}>
            Ingest Pipelines
          </Typography>
          <Button size="small" variant="outlined" onClick={loadPipelines} disabled={loading}>
            {loading ? <CircularProgress size={16} /> : "Refresh"}
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: "flex", gap: 1, minHeight: 0, flex: 1 }}>
        {/* Left panel: pipeline list */}
        <Paper
          variant="outlined"
          sx={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}
        >
          <Box sx={{ p: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search pipelines"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Box>
          <Divider />
          <List dense sx={{ overflow: "auto", minHeight: 0, flex: 1 }}>
            {filteredPipelines.map((entry) => (
              <ListItemButton
                key={entry.name}
                selected={entry.name === selectedName}
                onClick={() => setSelectedName(entry.name)}
              >
                <ListItemText
                  primary={entry.name}
                  secondary={`${entry.pipeline.processors?.length ?? 0} processor${
                    (entry.pipeline.processors?.length ?? 0) === 1 ? "" : "s"
                  }`}
                />
              </ListItemButton>
            ))}
            {!loading && filteredPipelines.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No pipelines found.
              </Typography>
            )}
          </List>
        </Paper>

        {/* Right panel: details + simulate */}
        <Paper
          variant="outlined"
          sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "auto" }}
        >
          {selectedPipeline ? (
            <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 2 }}>
              {/* Metadata */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  {selectedPipeline.name}
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "minmax(100px, auto) 1fr",
                    rowGap: 0.5,
                    columnGap: 1.5,
                  }}
                >
                  {selectedPipeline.pipeline.description && (
                    <>
                      <Typography variant="caption" color="text.secondary">
                        Description
                      </Typography>
                      <Typography variant="body2" data-testid="pipeline-meta-description">
                        {selectedPipeline.pipeline.description}
                      </Typography>
                    </>
                  )}
                  {selectedPipeline.pipeline.version !== undefined && (
                    <>
                      <Typography variant="caption" color="text.secondary">
                        Version
                      </Typography>
                      <Typography variant="body2" data-testid="pipeline-meta-version">
                        {selectedPipeline.pipeline.version}
                      </Typography>
                    </>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Processors
                  </Typography>
                  <Typography variant="body2" data-testid="pipeline-meta-processors">
                    {selectedPipeline.pipeline.processors?.length ?? 0}
                  </Typography>
                </Box>
              </Box>

              <Divider />

              {/* Processors JSON */}
              <Box>
                <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                  Processors
                </Typography>
                <Typography
                  component="pre"
                  variant="body2"
                  data-testid="pipeline-processors-json"
                  sx={{
                    m: 0,
                    p: 1,
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    overflow: "auto",
                    maxHeight: 240,
                    fontSize: "0.75rem",
                  }}
                >
                  {JSON.stringify(selectedPipeline.pipeline.processors ?? [], null, 2)}
                </Typography>
              </Box>

              <Divider />

              {/* Simulate section */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Simulate — paste a document to test against this pipeline
                </Typography>
                <TextField
                  multiline
                  minRows={4}
                  maxRows={10}
                  size="small"
                  fullWidth
                  label="Input document (JSON)"
                  value={simulateInput}
                  onChange={(e) => setSimulateInput(e.target.value)}
                  inputProps={{ "aria-label": "Input document (JSON)" }}
                  sx={{ fontFamily: "monospace" }}
                />
                <Box>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => void handleSimulate()}
                    disabled={simulating || !selectedName}
                    startIcon={simulating ? <CircularProgress size={14} /> : null}
                  >
                    {simulating ? "Simulating…" : "Simulate"}
                  </Button>
                </Box>
                {simulateError && <Alert severity="error">{simulateError}</Alert>}
                {simulateResult && (
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      gutterBottom
                      display="block"
                    >
                      Result
                    </Typography>
                    <Typography
                      component="pre"
                      variant="body2"
                      data-testid="simulate-result"
                      sx={{
                        m: 0,
                        p: 1,
                        bgcolor: "action.hover",
                        borderRadius: 1,
                        overflow: "auto",
                        maxHeight: 320,
                        fontSize: "0.75rem",
                      }}
                    >
                      {JSON.stringify(simulateResult, null, 2)}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          ) : (
            <Box sx={{ p: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                Select a pipeline.
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
