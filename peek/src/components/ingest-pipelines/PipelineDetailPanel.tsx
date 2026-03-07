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
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ExpandLess from "@mui/icons-material/ExpandLess";

import type { ElasticsearchConnection, NodesStatsResponse } from "../../services/es";
import { useCopyFeedbackTimeout } from "../../hooks/useCopyFeedbackTimeout";
import { usePipelineSimulate } from "../../hooks/usePipelineSimulate";
import type { PipelineEntry } from "../../hooks/useIngestPipelines";
import type { DataFetchResult } from "../../types/query";
import { copyToClipboard } from "../../utils/copyToClipboard";
import { formatMs } from "../../utils/formatDuration";
import EmptyState from "../EmptyState";

import { parseSimulateInput } from "./ingestPipelineUtils";
import SimulateResults from "./SimulateResults";

interface PipelineDetailPanelProps {
  selectedPipeline: PipelineEntry | null;
  connection: ElasticsearchConnection | null;
  pipelinesExist: boolean;
  ingestNodeStatsResult: DataFetchResult<NodesStatsResponse>;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function formatAvgMsPerDoc(timeMs: number, count: number): string {
  if (count <= 0) return "n/a";
  const avg = timeMs / count;
  return avg < 1 ? `${avg.toFixed(3)} ms/doc` : `${avg.toFixed(2)} ms/doc`;
}

function formatFailureRate(failed: number, count: number): string {
  if (count <= 0) return "n/a";
  return `${((failed / count) * 100).toFixed(2)}%`;
}

interface NodePipelineRuntime {
  nodeId: string;
  nodeName: string;
  count: number;
  failed: number;
  current: number;
  timeMs: number;
}

interface ProcessorRuntimeAggregate {
  id: string;
  type: string;
  count: number;
  failed: number;
  current: number;
  timeMs: number;
  nodesSeen: number;
}

export default function PipelineDetailPanel({
  selectedPipeline,
  connection,
  pipelinesExist,
  ingestNodeStatsResult,
}: PipelineDetailPanelProps) {
  const [simulateInput, setSimulateInput] = useState('{\n  "_source": {}\n}');
  const [verbose, setVerbose] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [expandedProcessors, setExpandedProcessors] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const scheduleCopyReset = useCopyFeedbackTimeout(() => setCopiedKey(null));

  const processors = selectedPipeline?.pipeline.processors ?? [];
  const runtimeStats = useMemo(() => {
    if (!selectedPipeline || ingestNodeStatsResult.status !== "success") return null;

    const nodes = ingestNodeStatsResult.data.nodes ?? {};
    const nodeRows: NodePipelineRuntime[] = [];
    const processorMap = new Map<
      string,
      {
        id: string;
        type: string;
        count: number;
        failed: number;
        current: number;
        timeMs: number;
        nodeIds: Set<string>;
      }
    >();

    for (const [nodeId, node] of Object.entries(nodes)) {
      const pipelineStats = node.ingest?.pipelines?.[selectedPipeline.name];
      if (!pipelineStats) continue;

      const count = pipelineStats.count ?? 0;
      const failed = pipelineStats.failed ?? 0;
      const current = pipelineStats.current ?? 0;
      const timeMs = pipelineStats.time_in_millis ?? 0;
      nodeRows.push({
        nodeId,
        nodeName: node.name ?? nodeId,
        count,
        failed,
        current,
        timeMs,
      });

      for (const processorEntry of pipelineStats.processors ?? []) {
        const [processorId, processorInfo] = Object.entries(processorEntry)[0] ?? [];
        if (!processorId || !processorInfo || typeof processorInfo !== "object") continue;
        const typedInfo = processorInfo as {
          type?: string;
          stats?: { count?: number; failed?: number; current?: number; time_in_millis?: number };
        };
        const processorType = typedInfo.type ?? processorId.split(":")[0] ?? "unknown";
        const stats = typedInfo.stats;
        const existing = processorMap.get(processorId) ?? {
          id: processorId,
          type: processorType,
          count: 0,
          failed: 0,
          current: 0,
          timeMs: 0,
          nodeIds: new Set<string>(),
        };
        existing.count += stats?.count ?? 0;
        existing.failed += stats?.failed ?? 0;
        existing.current += stats?.current ?? 0;
        existing.timeMs += stats?.time_in_millis ?? 0;
        existing.nodeIds.add(nodeId);
        processorMap.set(processorId, existing);
      }
    }

    const summary = nodeRows.reduce(
      (acc, row) => {
        acc.count += row.count;
        acc.failed += row.failed;
        acc.current += row.current;
        acc.timeMs += row.timeMs;
        return acc;
      },
      { count: 0, failed: 0, current: 0, timeMs: 0 },
    );

    const sortedNodes = nodeRows.sort(
      (a, b) => b.failed - a.failed || b.timeMs - a.timeMs || b.count - a.count,
    );
    // Preserve run order as returned by node ingest stats processor arrays.
    // Do not re-sort by total time; hotspots should reflect pipeline execution order.
    const orderedProcessors: ProcessorRuntimeAggregate[] = Array.from(processorMap.values()).map(
      (entry) => ({
        id: entry.id,
        type: entry.type,
        count: entry.count,
        failed: entry.failed,
        current: entry.current,
        timeMs: entry.timeMs,
        nodesSeen: entry.nodeIds.size,
      }),
    );

    return {
      summary,
      nodeRows: sortedNodes,
      processors: orderedProcessors,
    };
  }, [selectedPipeline, ingestNodeStatsResult]);

  const processorKeys = useMemo(() => {
    const identityCounts = new Map<string, number>();
    return processors.map((processor) => {
      const [type, config] = Object.entries(processor)[0] ?? ["unknown", {}];
      const identity = `${type}:${stableStringify(config)}`;
      const occurrence = identityCounts.get(identity) ?? 0;
      identityCounts.set(identity, occurrence + 1);
      return `${selectedPipeline?.name}:${identity}:${occurrence}`;
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

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Runtime stats (from node ingest counters)
          </Typography>
          {ingestNodeStatsResult.status === "loading" && (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={14} />
              <Typography variant="body2" color="text.secondary">
                Loading runtime stats…
              </Typography>
            </Stack>
          )}
          {ingestNodeStatsResult.status === "error" && (
            <Alert severity="warning">
              Unable to load runtime stats from `/_nodes/stats`: {ingestNodeStatsResult.error}
            </Alert>
          )}
          {ingestNodeStatsResult.status === "success" &&
            runtimeStats &&
            runtimeStats.nodeRows.length > 0 && (
              <Stack spacing={1.5} data-testid="pipeline-runtime-stats">
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: 1,
                  }}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Docs processed
                    </Typography>
                    <Typography variant="body2">
                      {runtimeStats.summary.count.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Total time
                    </Typography>
                    <Typography variant="body2">{formatMs(runtimeStats.summary.timeMs)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Avg time/doc
                    </Typography>
                    <Typography variant="body2">
                      {formatAvgMsPerDoc(runtimeStats.summary.timeMs, runtimeStats.summary.count)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Failed
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: runtimeStats.summary.failed > 0 ? "warning.main" : undefined }}
                    >
                      {runtimeStats.summary.failed.toLocaleString()} (
                      {formatFailureRate(runtimeStats.summary.failed, runtimeStats.summary.count)})
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Current in-flight
                    </Typography>
                    <Typography variant="body2">
                      {runtimeStats.summary.current.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Nodes reporting
                    </Typography>
                    <Typography variant="body2">
                      {runtimeStats.nodeRows.length.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>

                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    sx={{ mb: 0.5 }}
                  >
                    Hot nodes
                  </Typography>
                  <TableContainer
                    component={Box}
                    sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}
                  >
                    <Table size="small" aria-label="Pipeline node runtime stats">
                      <TableHead>
                        <TableRow>
                          <TableCell>Node</TableCell>
                          <TableCell align="right">Docs</TableCell>
                          <TableCell align="right">Failed</TableCell>
                          <TableCell align="right">Total time</TableCell>
                          <TableCell align="right">Avg ms/doc</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {runtimeStats.nodeRows.slice(0, 8).map((row) => (
                          <TableRow key={row.nodeId}>
                            <TableCell>
                              <Typography variant="body2" noWrap title={row.nodeName}>
                                {row.nodeName}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{row.count.toLocaleString()}</TableCell>
                            <TableCell
                              align="right"
                              sx={{ color: row.failed > 0 ? "warning.main" : undefined }}
                            >
                              {row.failed.toLocaleString()}
                            </TableCell>
                            <TableCell align="right">{formatMs(row.timeMs)}</TableCell>
                            <TableCell align="right">
                              {formatAvgMsPerDoc(row.timeMs, row.count).replace(" ms/doc", "")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>

                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    sx={{ mb: 0.5 }}
                  >
                    Processor hotspots
                  </Typography>
                  {runtimeStats.processors.length === 0 ? (
                    <EmptyState
                      size="small"
                      heading="No processor counters"
                      description="Processor-level counters are not available for this pipeline on current nodes."
                    />
                  ) : (
                    <TableContainer
                      component={Box}
                      sx={{
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 1,
                        overflowX: "hidden",
                      }}
                    >
                      <Table size="small" aria-label="Pipeline processor runtime stats">
                        <TableHead>
                          <TableRow>
                            <TableCell>Processor</TableCell>
                            <TableCell align="right">Docs</TableCell>
                            <TableCell align="right">Failed</TableCell>
                            <TableCell align="right">Total time</TableCell>
                            <TableCell align="right">Avg ms/doc</TableCell>
                            <TableCell align="right">Nodes</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {runtimeStats.processors.slice(0, 12).map((processor) => (
                            <TableRow key={processor.id}>
                              <TableCell>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontFamily: "monospace",
                                    fontSize: "0.75rem",
                                    whiteSpace: "normal",
                                    wordBreak: "break-word",
                                    overflowWrap: "anywhere",
                                  }}
                                  title={processor.id}
                                >
                                  {processor.id}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {processor.type}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                {processor.count.toLocaleString()}
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{ color: processor.failed > 0 ? "warning.main" : undefined }}
                              >
                                {processor.failed.toLocaleString()}
                              </TableCell>
                              <TableCell align="right">{formatMs(processor.timeMs)}</TableCell>
                              <TableCell align="right">
                                {formatAvgMsPerDoc(processor.timeMs, processor.count).replace(
                                  " ms/doc",
                                  "",
                                )}
                              </TableCell>
                              <TableCell align="right">{processor.nodesSeen}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              </Stack>
            )}
          {ingestNodeStatsResult.status === "success" &&
            runtimeStats &&
            runtimeStats.nodeRows.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No runtime stats available for this pipeline yet. Stats appear after documents are
                processed.
              </Typography>
            )}
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
                const [type, rawConfig] = Object.entries(processor)[0] ?? ["unknown", {}];
                // When Elasticsearch returns the config as a pre-serialised JSON
                // string, parse it first so we can pretty-print it properly
                // instead of rendering an escaped inline literal.
                let parsedConfig: unknown = rawConfig;
                if (typeof rawConfig === "string") {
                  try {
                    parsedConfig = JSON.parse(rawConfig);
                  } catch {
                    // Not valid JSON — keep the original string
                  }
                }
                const configJson =
                  typeof parsedConfig === "string"
                    ? parsedConfig
                    : (JSON.stringify(parsedConfig, null, 2) ?? "");
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
                      <Tooltip title={copiedKey === processorKey ? "Copied!" : "Copy JSON"}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            void copyToClipboard(configJson).then((ok) => {
                              if (!ok) return;
                              setCopiedKey(processorKey);
                              scheduleCopyReset();
                            });
                          }}
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
