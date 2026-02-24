import { useState, useCallback, useMemo } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useShallow } from "zustand/react/shallow";

import { ElasticsearchClient } from "../services/es";
import type { ElasticsearchConnection } from "../types";
import {
  useEvalStore,
  type EvalRun,
  type JudgedQuery,
  type QueryEvalResult,
} from "../store/useEvalStore";

import { recallAtK, precisionAtK, ndcgAtK } from "./evalMetrics";

function fmt(value: number): string {
  return value.toFixed(3);
}

function toCsvRows(run: EvalRun): string {
  const header = ["query", "recall", "precision", "ndcg", "duration_ms", "error"];
  const rows = run.results.map((r) => [
    JSON.stringify(r.query),
    r.error ? "" : fmt(r.recall),
    r.error ? "" : fmt(r.precision),
    r.error ? "" : fmt(r.ndcg),
    r.durationMs !== null ? String(r.durationMs) : "",
    r.error ? JSON.stringify(r.error) : "",
  ]);
  return [header, ...rows].map((row) => row.join(",")).join("\n");
}

interface RelevanceEvalPanelProps {
  connection: ElasticsearchConnection | null;
}

export default function RelevanceEvalPanel({ connection }: RelevanceEvalPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const { judgedSetJson, idField, k, runs, setJudgedSetJson, setIdField, setK, addRun, clearRuns } =
    useEvalStore(
      useShallow((s) => ({
        judgedSetJson: s.judgedSetJson,
        idField: s.idField,
        k: s.k,
        runs: s.runs,
        setJudgedSetJson: s.setJudgedSetJson,
        setIdField: s.setIdField,
        setK: s.setK,
        addRun: s.addRun,
        clearRuns: s.clearRuns,
      })),
    );

  const latestRun = runs[0] ?? null;

  const { parsed: judgedSet, error: parseError } = useMemo<{
    parsed: JudgedQuery[] | null;
    error: string | null;
  }>(() => {
    try {
      const parsed: unknown = JSON.parse(judgedSetJson);
      if (!Array.isArray(parsed)) {
        return { parsed: null, error: "Judged set must be a JSON array" };
      }
      for (const entry of parsed) {
        const relevant = (entry as Record<string, unknown>).relevant;
        if (
          typeof entry !== "object" ||
          entry === null ||
          typeof (entry as Record<string, unknown>).query !== "string" ||
          !Array.isArray(relevant) ||
          !relevant.every((id) => typeof id === "string")
        ) {
          return {
            parsed: null,
            error: 'Each entry must have "query" (string) and "relevant" (string[]) fields',
          };
        }
      }
      return { parsed: parsed as JudgedQuery[], error: null };
    } catch {
      return { parsed: null, error: "Invalid JSON" };
    }
  }, [judgedSetJson]);

  const handleRunEval = useCallback(async () => {
    if (!connection || !judgedSet || judgedSet.length === 0) return;

    setRunning(true);
    setRunError(null);

    const client = new ElasticsearchClient(connection);
    const results: QueryEvalResult[] = [];

    for (const entry of judgedSet) {
      try {
        const startMs = performance.now();
        const data = await client.query({ query: entry.query });
        const durationMs = Math.round(performance.now() - startMs);

        const idColIdx = data.columns.findIndex((c) => c.name === idField);
        const retrievedIds: string[] =
          idColIdx >= 0
            ? data.values.map((row) => String(row[idColIdx] ?? "")).filter(Boolean)
            : [];

        results.push({
          query: entry.query,
          retrievedIds,
          recall: recallAtK(retrievedIds, entry.relevant, k),
          precision: precisionAtK(retrievedIds, entry.relevant, k),
          ndcg: ndcgAtK(retrievedIds, entry.relevant, k),
          durationMs,
          error: null,
        });
      } catch (err) {
        results.push({
          query: entry.query,
          retrievedIds: [],
          recall: 0,
          precision: 0,
          ndcg: 0,
          durationMs: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    addRun({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      idField,
      k,
      results,
    });
    setRunning(false);
  }, [connection, judgedSet, idField, k, addRun]);

  const handleExportJson = useCallback(() => {
    if (!latestRun) return;
    const blob = new Blob([JSON.stringify(latestRun, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eval-run-${latestRun.id.slice(0, 8)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, [latestRun]);

  const handleExportCsv = useCallback(() => {
    if (!latestRun) return;
    const csv = toCsvRows(latestRun);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eval-run-${latestRun.id.slice(0, 8)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, [latestRun]);

  const avgMetric = useCallback(
    (key: "recall" | "precision" | "ndcg"): number | null => {
      if (!latestRun || latestRun.results.length === 0) return null;
      const valid = latestRun.results.filter((r) => !r.error);
      if (valid.length === 0) return null;
      return valid.reduce((sum, r) => sum + r[key], 0) / valid.length;
    },
    [latestRun],
  );

  return (
    <Paper variant="outlined">
      {/* Header */}
      <Box sx={{ px: 1.5, py: 0.75, display: "flex", alignItems: "center", gap: 0.5 }}>
        <IconButton
          size="small"
          onClick={() => setExpanded((prev) => !prev)}
          aria-label={expanded ? "Collapse evaluation panel" : "Expand evaluation panel"}
        >
          <ExpandMoreIcon
            fontSize="small"
            sx={{
              transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform 0.2s",
            }}
          />
        </IconButton>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Relevance Evaluation
        </Typography>
        {latestRun && (
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            <Chip size="small" label={`R@${latestRun.k}: ${fmt(avgMetric("recall") ?? 0)}`} />
            <Chip size="small" label={`P@${latestRun.k}: ${fmt(avgMetric("precision") ?? 0)}`} />
            <Chip
              size="small"
              color="primary"
              label={`NDCG@${latestRun.k}: ${fmt(avgMetric("ndcg") ?? 0)}`}
            />
          </Box>
        )}
      </Box>
      <Divider />

      {/* Body */}
      <Collapse in={expanded}>
        <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
          {/* Config row */}
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
            <TextField
              size="small"
              label="ID field"
              value={idField}
              onChange={(e) => setIdField(e.target.value)}
              sx={{ width: 150 }}
              helperText="Column used as doc ID"
            />
            <TextField
              size="small"
              label="k"
              type="number"
              value={k}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 0) setK(val);
              }}
              sx={{ width: 80 }}
              helperText="Rank cutoff"
              inputProps={{ min: 1 }}
            />
          </Box>

          {/* Judged set editor */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
              Judged query set (JSON)
            </Typography>
            <TextField
              multiline
              fullWidth
              rows={6}
              value={judgedSetJson}
              onChange={(e) => setJudgedSetJson(e.target.value)}
              error={!!parseError}
              helperText={parseError ?? 'Array of {"query": "ES|QL...", "relevant": ["id1", ...]}'}
              inputProps={{ style: { fontFamily: "monospace", fontSize: "0.75rem" } }}
              size="small"
            />
          </Box>

          {/* Run button row */}
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Button
              variant="contained"
              size="small"
              startIcon={
                running ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />
              }
              onClick={() => void handleRunEval()}
              disabled={running || !connection || !!parseError}
            >
              Run Evaluation
            </Button>
            {runs.length > 0 && (
              <Button size="small" color="error" variant="text" onClick={clearRuns}>
                Clear runs
              </Button>
            )}
          </Box>

          {runError && <Alert severity="error">{runError}</Alert>}

          {/* Results table for the latest run */}
          {latestRun && (
            <Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 0.5,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {new Date(latestRun.timestamp).toLocaleString()} — {latestRun.results.length}{" "}
                  {latestRun.results.length === 1 ? "query" : "queries"}, k={latestRun.k}, id_field=
                  {latestRun.idField}
                </Typography>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  <Tooltip title="Export as JSON">
                    <IconButton
                      size="small"
                      onClick={handleExportJson}
                      aria-label="Export evaluation run as JSON"
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Export as CSV">
                    <IconButton
                      size="small"
                      onClick={handleExportCsv}
                      aria-label="Export evaluation run as CSV"
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Query</TableCell>
                    <TableCell align="right">Recall@k</TableCell>
                    <TableCell align="right">Precision@k</TableCell>
                    <TableCell align="right">NDCG@k</TableCell>
                    <TableCell align="right">Took</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {latestRun.results.map((r, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell>
                        <Typography
                          variant="caption"
                          noWrap
                          title={r.query}
                          sx={{ maxWidth: 300, display: "block", fontFamily: "monospace" }}
                        >
                          {r.query}
                        </Typography>
                        {r.error && (
                          <Typography variant="caption" color="error.main">
                            Error: {r.error}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">{r.error ? "—" : fmt(r.recall)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">
                          {r.error ? "—" : fmt(r.precision)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption" fontWeight={600}>
                          {r.error ? "—" : fmt(r.ndcg)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">
                          {r.durationMs !== null ? `${r.durationMs} ms` : "—"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Average row — only shown when there are multiple queries */}
                  {latestRun.results.length > 1 && (
                    <TableRow sx={{ "& td": { borderTop: 2, borderColor: "divider" } }}>
                      <TableCell>
                        <Typography variant="caption" fontWeight={600}>
                          Average
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption" fontWeight={600}>
                          {avgMetric("recall") !== null ? fmt(avgMetric("recall")!) : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption" fontWeight={600}>
                          {avgMetric("precision") !== null ? fmt(avgMetric("precision")!) : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption" fontWeight={600}>
                          {avgMetric("ndcg") !== null ? fmt(avgMetric("ndcg")!) : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}
