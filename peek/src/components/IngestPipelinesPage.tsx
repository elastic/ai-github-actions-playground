import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { useConnectionStore } from "../store/useConnectionStore";
import { useIngestPipelines } from "../hooks/useIngestPipelines";

import PageHeader from "./PageHeader";
import PipelineListPanel from "./ingest-pipelines/PipelineListPanel";
import PipelineDetailPanel from "./ingest-pipelines/PipelineDetailPanel";
import { humanizeEsError } from "./ingest-pipelines/ingestPipelineUtils";

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

  // Derive effective selection: keep current if it still exists, otherwise select first.
  const effectiveSelectedName = useMemo(() => {
    if (!pipelinesData) return null;
    if (selectedName && pipelinesData.some((p) => p.name === selectedName)) return selectedName;
    return pipelinesData[0]?.name ?? null;
  }, [pipelinesData, selectedName]);

  useEffect(() => {
    if (!effectiveSelectedName || effectiveSelectedName === selectedName) return;
    setSelectedName(effectiveSelectedName);
  }, [effectiveSelectedName, selectedName]);

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => p.name === effectiveSelectedName) ?? null,
    [pipelines, effectiveSelectedName],
  );

  const filteredPipelines = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return pipelines;
    return pipelines.filter((p) => p.name.toLowerCase().includes(term));
  }, [pipelines, search]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Ingest Pipelines"
          actions={
            <Button
              size="small"
              variant="outlined"
              onClick={pipelinesResult.refresh}
              disabled={loading}
            >
              {loading ? <CircularProgress size={16} /> : "Refresh"}
            </Button>
          }
        />
      </Paper>

      {error && (
        <Alert severity="error">
          {humanizeEsError(error) ?? error}
          {humanizeEsError(error) && (
            <Collapse in={showRawError}>
              <Typography
                component="pre"
                variant="caption"
                sx={{ mt: 1, wordBreak: "break-word", whiteSpace: "pre-wrap" }}
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
              sx={{ minWidth: 0, mt: 0.5, p: 0, textTransform: "none" }}
            >
              {showRawError ? "Hide technical details" : "Technical details"}
            </Button>
          )}
        </Alert>
      )}

      <Box sx={{ display: "flex", flex: 1, gap: 1, minHeight: 0 }}>
        <PipelineListPanel
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          filteredPipelines={filteredPipelines}
          selectedName={effectiveSelectedName}
          onSelect={setSelectedName}
        />
        <PipelineDetailPanel
          key={effectiveSelectedName ?? "none"}
          selectedPipeline={selectedPipeline}
          connection={connection}
        />
      </Box>
    </Box>
  );
}
