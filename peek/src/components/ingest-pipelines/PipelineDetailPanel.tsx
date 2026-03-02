import { useState, useCallback, useEffect, useRef } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AccountTreeIcon from "@mui/icons-material/AccountTree";

import type { SimulateIngestPipelineResponse, ElasticsearchConnection } from "../../services/es";
import { runConnectionRequest } from "../../hooks/useConnectionRequest";
import type { PipelineEntry } from "../../hooks/useIngestPipelines";
import EmptyState from "../EmptyState";

import { parseSimulateInput } from "./ingestPipelineUtils";
import SimulateResults from "./SimulateResults";

interface PipelineDetailPanelProps {
  selectedPipeline: PipelineEntry | null;
  connection: ElasticsearchConnection | null;
  pipelinesExist: boolean;
}

export default function PipelineDetailPanel({
  selectedPipeline,
  connection,
  pipelinesExist,
}: PipelineDetailPanelProps) {
  const [simulateInput, setSimulateInput] = useState('{\n  "_source": {}\n}');
  const [verbose, setVerbose] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulateError, setSimulateError] = useState<string | null>(null);
  const [simulateResult, setSimulateResult] = useState<SimulateIngestPipelineResponse | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    requestSeqRef.current += 1;
    setSimulating(false);
    setSimulateResult(null);
    setSimulateError(null);
  }, [selectedPipeline?.name]);

  const handleSimulate = useCallback(async () => {
    if (!connection || !selectedPipeline) return;
    const requestId = ++requestSeqRef.current;
    setSimulating(true);
    setSimulateError(null);
    setSimulateResult(null);
    try {
      const docs = parseSimulateInput(simulateInput);
      if (!docs) {
        setSimulateError(
          "Invalid JSON: please enter a valid document object, JSON array, or NDJSON.",
        );
        return;
      }
      const { data, error } = await runConnectionRequest({
        connection,
        run: (client) => client.simulateIngestPipeline(selectedPipeline.name, docs, { verbose }),
      });
      if (requestId !== requestSeqRef.current) return;
      if (error !== null) {
        setSimulateError(error);
      } else if (data !== null) {
        setSimulateResult(data);
      }
    } finally {
      if (requestId === requestSeqRef.current) setSimulating(false);
    }
  }, [connection, selectedPipeline, simulateInput, verbose]);

  if (!selectedPipeline) {
    return (
      <Paper
        variant="outlined"
        sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0, overflow: "auto" }}
      >
        {pipelinesExist ? (
          <EmptyState
            icon={<AccountTreeIcon sx={{ mb: 0.5, color: "text.secondary", fontSize: 48 }} />}
            heading="Select a pipeline"
            description="Choose an ingest pipeline from the left panel to view its processors and simulate documents."
          />
        ) : (
          <EmptyState
            icon={<AccountTreeIcon sx={{ mb: 0.5, color: "text.secondary", fontSize: 48 }} />}
            heading="No ingest pipelines"
            description="This cluster has no ingest pipelines yet. Create one via Console or add data to get started."
            addDataHref="/add-data"
          />
        )}
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

        {/* Processors */}
        <Box>
          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
            Processors
          </Typography>
          {(selectedPipeline.pipeline.processors ?? []).length === 0 ? (
            <EmptyState
              size="small"
              heading="No processors"
              description="This pipeline has no processors defined."
            />
          ) : (
            <Stack spacing={1} data-testid="pipeline-processors-list">
              {(selectedPipeline.pipeline.processors ?? []).map((processor, index) => {
                const [type, config] = Object.entries(processor)[0] ?? ["unknown", {}];
                return (
                  <Box
                    key={index}
                    component="fieldset"
                    sx={{
                      m: 0,
                      p: 1,
                      border: 1,
                      borderColor: "border.subtle",
                      borderRadius: 1,
                    }}
                  >
                    <Typography component="legend" variant="caption" sx={{ px: 0.5 }}>
                      {type}
                    </Typography>
                    <Typography
                      component="pre"
                      variant="body2"
                      sx={{
                        m: 0,
                        p: 0.5,
                        wordBreak: "break-word",
                        whiteSpace: "pre-wrap",
                        fontSize: "0.75rem",
                      }}
                    >
                      {JSON.stringify(config, null, 2)}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          )}
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
          {simulateResult && <SimulateResults simulateResult={simulateResult} />}
        </Box>
      </Box>
    </Paper>
  );
}
