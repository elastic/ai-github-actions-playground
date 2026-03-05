import { useState, useCallback, useMemo } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ExpandLess from "@mui/icons-material/ExpandLess";

import type { ElasticsearchConnection } from "../../services/es";
import { usePipelineSimulate } from "../../hooks/usePipelineSimulate";
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
  const [validationError, setValidationError] = useState<string | null>(null);
  const [expandedProcessors, setExpandedProcessors] = useState<Set<string>>(new Set());

  const processors = selectedPipeline?.pipeline.processors ?? [];

  const processorKeys = useMemo(() => {
    const typeCounts = new Map<string, number>();
    return processors.map((processor) => {
      const [type] = Object.entries(processor)[0] ?? ["unknown"];
      const occurrence = typeCounts.get(type) ?? 0;
      typeCounts.set(type, occurrence + 1);
      return `${selectedPipeline?.name}:${type}:${occurrence}`;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- processors reference is stable when pipeline.processors is unchanged
  }, [selectedPipeline?.pipeline.processors, selectedPipeline?.name]);

  const {
    simulating,
    error: simulateApiError,
    result: simulateResult,
    simulate,
    reset,
  } = usePipelineSimulate(connection, selectedPipeline?.name);

  const simulateError = validationError ?? simulateApiError;

  const handleSimulate = useCallback(() => {
    if (!selectedPipeline) return;
    const docs = parseSimulateInput(simulateInput);
    if (!docs) {
      setValidationError(
        "Invalid JSON: please enter a valid document object, JSON array, or NDJSON.",
      );
      reset();
      return;
    }
    setValidationError(null);
    simulate(docs, verbose);
  }, [selectedPipeline, simulateInput, verbose, simulate, reset]);

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
          {processors.length === 0 ? (
            <EmptyState
              size="small"
              heading="No processors"
              description="This pipeline has no processors defined."
            />
          ) : (
            <Stack spacing={1} data-testid="pipeline-processors-list">
              {processors.map((processor, index) => {
                const [type, config] = Object.entries(processor)[0] ?? ["unknown", {}];
                const configJson = JSON.stringify(config, null, 2);
                const processorKey = processorKeys[index]!;
                const isExpanded = expandedProcessors.has(processorKey);
                return (
                  <Box
                    key={processorKey}
                    component="fieldset"
                    sx={{
                      m: 0,
                      p: 1,
                      border: 1,
                      borderColor: "border.subtle",
                      borderRadius: 1,
                    }}
                  >
                    <Typography
                      component="legend"
                      variant="caption"
                      sx={{ px: 0.5, bgcolor: "background.paper" }}
                    >
                      {type}
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Button
                        size="small"
                        onClick={() =>
                          setExpandedProcessors((prev) => {
                            const next = new Set(prev);
                            if (next.has(processorKey)) next.delete(processorKey);
                            else next.add(processorKey);
                            return next;
                          })
                        }
                        endIcon={isExpanded ? <ExpandLess /> : <ExpandMore />}
                        sx={{ textTransform: "none" }}
                      >
                        {isExpanded ? "Hide config" : "Show config"}
                      </Button>
                      <Tooltip title="Copy JSON">
                        <IconButton
                          size="small"
                          onClick={() => void navigator.clipboard.writeText(configJson)}
                          aria-label={`Copy ${type} config`}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Collapse in={isExpanded} unmountOnExit>
                      <Typography
                        component="pre"
                        variant="body2"
                        sx={{
                          m: 0,
                          mt: 0.5,
                          p: 1,
                          borderRadius: 1,
                          bgcolor: "action.hover",
                          wordBreak: "break-word",
                          whiteSpace: "pre-wrap",
                          fontSize: "0.75rem",
                          fontFamily: "monospace",
                        }}
                      >
                        {configJson}
                      </Typography>
                    </Collapse>
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
              onClick={handleSimulate}
              disabled={simulating || !selectedPipeline.name || !connection}
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
