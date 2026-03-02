import { useState, useCallback, useEffect } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AccountTreeIcon from "@mui/icons-material/AccountTree";

import type { SimulateIngestPipelineResponse , ElasticsearchConnection } from "../../services/es";
import { runConnectionRequest } from "../../hooks/useConnectionRequest";
import EmptyState from "../EmptyState";

import { parseSimulateInput } from "./ingestPipelineUtils";

interface IngestPipeline {
  description?: string;
  version?: number;
  processors?: unknown[];
}

interface PipelineEntry {
  name: string;
  pipeline: IngestPipeline;
}

interface PipelineDetailPanelProps {
  selectedPipeline: PipelineEntry | null;
  connection: ElasticsearchConnection | null;
}

export default function PipelineDetailPanel({
  selectedPipeline,
  connection,
}: PipelineDetailPanelProps) {
  const [simulateInput, setSimulateInput] = useState('{\n  "_source": {}\n}');
  const [verbose, setVerbose] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulateError, setSimulateError] = useState<string | null>(null);
  const [simulateResult, setSimulateResult] = useState<SimulateIngestPipelineResponse | null>(null);
  const [expandedDocs, setExpandedDocs] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSimulateResult(null);
    setSimulateError(null);
  }, [selectedPipeline?.name]);

  const handleSimulate = useCallback(async () => {
    if (!connection || !selectedPipeline) return;
    setSimulating(true);
    setSimulateError(null);
    setSimulateResult(null);
    setExpandedDocs(new Set());
    try {
      const docs = parseSimulateInput(simulateInput);
      if (!docs) {
        setSimulateError(
          "Invalid JSON: please enter a valid document object, JSON array, or NDJSON.",
        );
        return;
      }
      if (docs.length > 1 || verbose) {
        const { data, error } = await runConnectionRequest({
          connection,
          run: (client) => client.simulateIngestPipeline(selectedPipeline.name, docs, { verbose }),
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
        run: (client) => client.simulateIngestPipeline(selectedPipeline.name, docs),
      });
      if (error !== null) {
        setSimulateError(error);
      } else if (data !== null) {
        setSimulateResult(data);
      }
    } finally {
      setSimulating(false);
    }
  }, [connection, selectedPipeline, simulateInput, verbose]);

  if (!selectedPipeline) {
    return (
      <Paper
        variant="outlined"
        sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0, overflow: "auto" }}
      >
        <EmptyState
          icon={<AccountTreeIcon sx={{ mb: 0.5, color: "text.secondary", fontSize: 48 }} />}
          heading="Select a pipeline"
          description="Choose an ingest pipeline from the left panel to view its processors and simulate documents."
        />
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0, overflow: "auto" }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 1.5 }}>
        {/* Metadata */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>
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
              maxHeight: 240,
              overflow: "auto",
              m: 0,
              p: 1,
              borderRadius: 1,
              bgcolor: "action.hover",
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
              disabled={simulating || !selectedPipeline.name}
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
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
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
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
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
                                maxHeight: 200,
                                overflow: "auto",
                                m: 0,
                                p: 1,
                                borderRadius: 1,
                                bgcolor: "action.hover",
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
                              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
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
    </Paper>
  );
}
