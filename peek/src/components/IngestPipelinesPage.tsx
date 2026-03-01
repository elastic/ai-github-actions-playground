import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
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
import AccountTreeIcon from "@mui/icons-material/AccountTree";

import type { SimulateIngestPipelineResponse } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { runConnectionRequest } from "../hooks/useConnectionRequest";
import { useIngestPipelines } from "../hooks/useIngestPipelines";

import EmptyState from "./EmptyState";

/**
 * Attempt to extract a human-readable message from a raw Elasticsearch error
 * string. Returns `null` when the error doesn't match a known pattern.
 */
function humanizeEsError(raw: string): string | null {
  if (/unauthorized.*read_pipeline|manage_ingest_pipelines|manage_pipeline/i.test(raw)) {
    return "Permission denied — your user role does not include the read_pipeline privilege required to view ingest pipelines.";
  }
  if (/unauthorized/i.test(raw)) {
    const match = raw.match(/this action is granted by the cluster privileges \[([^\]]+)\]/);
    const privileges = match?.[1];
    return privileges
      ? `Permission denied — this action requires one of: ${privileges}`
      : "Permission denied — insufficient cluster privileges.";
  }
  if (/security_exception/i.test(raw)) {
    return "Permission denied — a security exception occurred.";
  }
  return null;
}

/**
 * Parse the simulate input field into an array of Elasticsearch docs.
 * Accepts a single JSON object, a JSON array of objects, or NDJSON.
 * Returns null when the input cannot be parsed.
 */
function parseSimulateInput(input: string): Array<Record<string, unknown>> | null {
  const trimmed = input.trim();

  // Attempt standard JSON parse first (handles object and array inputs)
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((doc) =>
          doc !== null && typeof doc === "object" && "_source" in (doc as object)
            ? (doc as Record<string, unknown>)
            : { _source: doc },
        );
      }
      const doc = parsed as Record<string, unknown>;
      return ["_source" in doc ? doc : { _source: doc }];
    } catch {
      // fall through to NDJSON attempt
    }
  }

  // Attempt NDJSON: one JSON object per non-empty line
  const lines = trimmed.split("\n").filter((l) => l.trim());
  if (lines.length > 1) {
    try {
      return lines.map((line) => {
        const doc = JSON.parse(line.trim()) as Record<string, unknown>;
        return "_source" in doc ? doc : { _source: doc };
      });
    } catch {
      // fall through
    }
  }

  return null;
}

export default function IngestPipelinesPage() {
  const connection = useConnectionStore((s) => s.connection);
  const pipelinesResult = useIngestPipelines();

  const loading = pipelinesResult.status === "loading";
  const error = pipelinesResult.status === "error" ? pipelinesResult.error : null;
  const pipelinesData = pipelinesResult.status === "success" ? pipelinesResult.data : null;
  const pipelines = useMemo(() => pipelinesData ?? [], [pipelinesData]);

  const [search, setSearch] = useState("");
  const [showRawError, setShowRawError] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  // Auto-select the first pipeline when data loads
  useEffect(() => {
    if (!pipelinesData) return;
    setSelectedName((current) =>
      current && pipelinesData.some((p) => p.name === current)
        ? current
        : (pipelinesData[0]?.name ?? null),
    );
  }, [pipelinesData]);

  // Simulate state
  const [simulateInput, setSimulateInput] = useState('{\n  "_source": {}\n}');
  const [verbose, setVerbose] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulateError, setSimulateError] = useState<string | null>(null);
  const [simulateResult, setSimulateResult] = useState<SimulateIngestPipelineResponse | null>(null);
  const [expandedDocs, setExpandedDocs] = useState<Set<number>>(new Set());

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => p.name === selectedName) ?? null,
    [pipelines, selectedName],
  );

  // Clear simulate results when selection changes
  useEffect(() => {
    setSimulateResult(null);
    setSimulateError(null);
    setExpandedDocs(new Set());
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
    setExpandedDocs(new Set());
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(simulateInput);
      } catch {
        parsed = undefined;
      }
      let docs: Array<Record<string, unknown>> | null = null;
      if (parsed !== undefined) {
        if (Array.isArray(parsed)) {
          docs = parsed.map((doc) =>
            doc !== null && typeof doc === "object" && "_source" in (doc as object)
              ? (doc as Record<string, unknown>)
              : { _source: doc },
          );
        } else {
          // Accept either a raw _source object or a full doc wrapper
          const doc =
            parsed !== null && typeof parsed === "object" && "_source" in (parsed as object)
              ? (parsed as Record<string, unknown>)
              : { _source: parsed };
          docs = [doc];
        }
      } else {
        docs = parseSimulateInput(simulateInput);
      }
      if (!docs) {
        setSimulateError(
          "Invalid JSON: please enter a valid document object, JSON array, or NDJSON.",
        );
        return;
      }
      if (parsed === undefined || docs.length > 1 || verbose) {
        const { data, error } = await runConnectionRequest({
          connection,
          run: (client) => client.simulateIngestPipeline(selectedName, docs, { verbose }),
        });
        if (error !== null) {
          setSimulateError(error);
        } else if (data !== null) {
          setSimulateResult(data);
        }
        return;
      }
      const { data, error } = await runConnectionRequest({
        connection,
        run: (client) => client.simulateIngestPipeline(selectedName, docs),
      });
      if (error !== null) {
        setSimulateError(error);
      } else if (data !== null) {
        setSimulateResult(data);
      }
    } finally {
      setSimulating(false);
    }
  }, [connection, selectedName, simulateInput, verbose]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: 0, height: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" component="h1" sx={{ flex: 1 }}>
            Ingest Pipelines
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={pipelinesResult.refresh}
            disabled={loading}
          >
            {loading ? <CircularProgress size={16} /> : "Refresh"}
          </Button>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error">
          {humanizeEsError(error) ?? error}
          {humanizeEsError(error) && (
            <Collapse in={showRawError}>
              <Typography
                component="pre"
                variant="caption"
                sx={{ mt: 1, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              >
                {error}
              </Typography>
            </Collapse>
          )}
          {humanizeEsError(error) && (
            <Button
              size="small"
              variant="text"
              onClick={() => setShowRawError((v) => !v)}
              sx={{ mt: 0.5, p: 0, minWidth: 0, textTransform: "none" }}
            >
              {showRawError ? "Hide technical details" : "Technical details"}
            </Button>
          )}
        </Alert>
      )}

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
              <ListItem key={entry.name} disablePadding>
                <ListItemButton
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
              </ListItem>
            ))}
            {!loading && filteredPipelines.length === 0 && (
              <EmptyState
                heading="No pipelines found"
                description="Try adjusting your search or check that ingest pipelines exist in the cluster"
              />
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
                  Simulate — paste one or more documents to test against this pipeline
                </Typography>
                <TextField
                  multiline
                  minRows={4}
                  maxRows={10}
                  size="small"
                  fullWidth
                  label="Input documents (JSON, JSON array, or NDJSON)"
                  value={simulateInput}
                  onChange={(e) => setSimulateInput(e.target.value)}
                  inputProps={{ "aria-label": "Input documents (JSON, JSON array, or NDJSON)" }}
                  sx={{ fontFamily: "monospace" }}
                />
                <Stack direction="row" spacing={2} alignItems="center">
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => void handleSimulate()}
                    disabled={simulating || !selectedName}
                    startIcon={simulating ? <CircularProgress size={14} /> : null}
                  >
                    {simulating ? "Simulating…" : "Simulate"}
                  </Button>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={verbose}
                        onChange={(e) => setVerbose(e.target.checked)}
                        inputProps={{ "aria-label": "Verbose processor trace" }}
                      />
                    }
                    label={
                      <Typography variant="body2" color="text.secondary">
                        Verbose trace
                      </Typography>
                    }
                  />
                </Stack>
                {simulateError && <Alert severity="error">{simulateError}</Alert>}
                {simulateResult && (
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      gutterBottom
                      display="block"
                    >
                      Results — {simulateResult.docs?.length ?? 0} document
                      {(simulateResult.docs?.length ?? 0) !== 1 ? "s" : ""}
                    </Typography>
                    <Box
                      data-testid="simulate-result"
                      sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                    >
                      {simulateResult.docs?.map((docResult, idx) => {
                        const isError = !!docResult.doc?.error;
                        const isExpanded = expandedDocs.has(idx);
                        const hasTrace = (docResult.processor_results?.length ?? 0) > 0;
                        return (
                          <Paper key={idx} variant="outlined" sx={{ p: 1 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip
                                size="small"
                                label={isError ? "Error" : "OK"}
                                color={isError ? "error" : "success"}
                                data-testid={`doc-result-status-${idx}`}
                              />
                              <Typography variant="body2" sx={{ flex: 1 }}>
                                Doc {idx + 1}
                                {isError &&
                                  docResult.doc?.error &&
                                  ` — ${docResult.doc.error.type}: ${docResult.doc.error.reason}`}
                              </Typography>
                              <Button
                                size="small"
                                onClick={() => {
                                  setExpandedDocs((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(idx)) next.delete(idx);
                                    else next.add(idx);
                                    return next;
                                  });
                                }}
                                aria-expanded={isExpanded}
                                aria-label={`${isExpanded ? "Collapse" : "Expand"} Doc ${idx + 1}`}
                              >
                                {isExpanded ? "Collapse" : "Expand"}
                              </Button>
                            </Stack>
                            <Collapse in={isExpanded}>
                              <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                                <Box>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    display="block"
                                    gutterBottom
                                  >
                                    Output
                                  </Typography>
                                  <Typography
                                    component="pre"
                                    variant="body2"
                                    sx={{
                                      m: 0,
                                      p: 1,
                                      bgcolor: "action.hover",
                                      borderRadius: 1,
                                      overflow: "auto",
                                      maxHeight: 200,
                                      fontSize: "0.75rem",
                                    }}
                                  >
                                    {JSON.stringify(docResult.doc?._source ?? {}, null, 2)}
                                  </Typography>
                                </Box>
                                {hasTrace && (
                                  <Box>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      display="block"
                                      gutterBottom
                                    >
                                      Processor trace
                                    </Typography>
                                    <Box
                                      sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
                                    >
                                      {docResult.processor_results?.map((pr, prIdx) => (
                                        <Stack
                                          key={prIdx}
                                          direction="row"
                                          spacing={1}
                                          alignItems="center"
                                        >
                                          <Chip
                                            size="small"
                                            data-testid={`processor-trace-status-${idx}-${prIdx}`}
                                            label={
                                              pr.status === "success"
                                                ? "OK"
                                                : pr.status === "error"
                                                  ? "Error"
                                                  : "Unknown"
                                            }
                                            color={
                                              pr.status === "success"
                                                ? "success"
                                                : pr.status === "error"
                                                  ? "error"
                                                  : "default"
                                            }
                                          />
                                          <Typography variant="body2">
                                            {pr.processor_type ?? "processor"}
                                          </Typography>
                                        </Stack>
                                      ))}
                                    </Box>
                                  </Box>
                                )}
                              </Box>
                            </Collapse>
                          </Paper>
                        );
                      })}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          ) : (
            <EmptyState
              icon={<AccountTreeIcon sx={{ fontSize: 48, color: "text.secondary", mb: 0.5 }} />}
              heading="Select a pipeline"
              description="Choose an ingest pipeline from the left panel to view its processors and simulate documents."
            />
          )}
        </Paper>
      </Box>
    </Box>
  );
}
