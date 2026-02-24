import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import { PAGE_MANIFEST } from "../../routes/manifest";
import { useConnectionStore } from "../../store/useConnectionStore";
import { useQueryStore } from "../../store/useQueryStore";
import type { EsqlResponse } from "../../types";
import DataTable from "../visualizations/DataTable";

import {
  buildProfilingQuery,
  type ProfilingViewMode,
  EMPTY_PROFILING_FILTERS,
} from "./profilingQueryBuilder";

export default function ProfilingPage() {
  const navigate = useNavigate();
  const connection = useConnectionStore((s) => s.connection);
  const setDiscoverQueryDraft = useQueryStore((s) => s.setDiscoverQueryDraft);
  const [result, setResult] = useState<EsqlResponse | null>(null);
  const [viewMode, setViewMode] = useState<ProfilingViewMode>("hotspots");
  const [rawQuery, setRawQuery] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [hostName, setHostName] = useState("");
  const [functionName, setFunctionName] = useState("");

  const filters = useMemo(
    () => ({
      ...EMPTY_PROFILING_FILTERS,
      serviceName: serviceName.trim() || null,
      hostName: hostName.trim() || null,
      functionName: functionName.trim() || null,
    }),
    [serviceName, hostName, functionName],
  );

  const generatedQuery = useMemo(() => buildProfilingQuery(viewMode, filters), [viewMode, filters]);
  const effectiveQuery = rawQuery ?? generatedQuery;

  const { runQuery, loading, error } = useEsqlQuery({
    connection,
    onSuccess: (data) => setResult(data),
    onFailure: () => setResult(null),
  });

  const handleRun = useCallback(() => {
    runQuery(effectiveQuery);
  }, [runQuery, effectiveQuery]);

  const handleOpenInQueryLab = useCallback(() => {
    setDiscoverQueryDraft(effectiveQuery);
    navigate(PAGE_MANIFEST.discover.path);
  }, [effectiveQuery, setDiscoverQueryDraft, navigate]);

  const handleResetFilters = useCallback(() => {
    setServiceName("");
    setHostName("");
    setFunctionName("");
    setRawQuery(null);
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: 0, height: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>
            Profiling Explorer
          </Typography>
          <Button size="small" variant="text" onClick={handleResetFilters}>
            Reset
          </Button>
          <Button size="small" variant="outlined" onClick={handleOpenInQueryLab}>
            Open in Query Lab
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          {(["hotspots", "timeline"] as ProfilingViewMode[]).map((mode) => (
            <Chip
              key={mode}
              label={mode === "hotspots" ? "Hotspots" : "Timeline"}
              color={viewMode === mode ? "primary" : "default"}
              variant={viewMode === mode ? "filled" : "outlined"}
              onClick={() => {
                setViewMode(mode);
                setRawQuery(null);
              }}
            />
          ))}
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 1 }}>
          <TextField
            size="small"
            label="Service"
            value={serviceName}
            onChange={(event) => setServiceName(event.target.value)}
          />
          <TextField
            size="small"
            label="Host"
            value={hostName}
            onChange={(event) => setHostName(event.target.value)}
          />
          <TextField
            size="small"
            label="Function"
            value={functionName}
            onChange={(event) => setFunctionName(event.target.value)}
          />
        </Stack>
        <TextField
          fullWidth
          multiline
          minRows={4}
          label="ES|QL Query"
          value={effectiveQuery}
          onChange={(event) => setRawQuery(event.target.value)}
        />
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <Button
            variant="contained"
            onClick={handleRun}
            disabled={loading || !effectiveQuery.trim()}
          >
            {loading ? <CircularProgress size={16} color="inherit" /> : "Run profiling query"}
          </Button>
          {result && (
            <Typography variant="caption" color="text.secondary">
              {result.values.length} rows
            </Typography>
          )}
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper variant="outlined" sx={{ flex: 1, minHeight: 320, overflow: "hidden" }}>
        {!result && !loading && (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Run a profiling query to explore hotspots and sample trends.
            </Typography>
          </Box>
        )}
        {loading && !result && (
          <Box sx={{ p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {result && <DataTable data={result} />}
      </Paper>
    </Box>
  );
}
