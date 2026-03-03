import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { useConnectionStore } from "../store/useConnectionStore";
import { usePageContextStore } from "../store/usePageContextStore";
import { useIngestPipelines } from "../hooks/useIngestPipelines";

import PageHeader from "./PageHeader";
import PageInsightBanner from "./PageInsightBanner";
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
  const [prevPipelinesData, setPrevPipelinesData] = useState(pipelinesData);

  // When pipeline list changes, reset selection if the selected pipeline no longer exists.
  // Using the "adjust state during render" pattern to avoid calling setState in an effect.
  if (pipelinesData !== prevPipelinesData) {
    setPrevPipelinesData(pipelinesData);
    const stillValid = selectedName != null && pipelinesData?.some((p) => p.name === selectedName);
    if (!stillValid) {
      setSelectedName(pipelinesData?.[0]?.name ?? null);
    }
  }

  const effectiveSelectedName = selectedName ?? pipelinesData?.[0]?.name ?? null;

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => p.name === effectiveSelectedName) ?? null,
    [pipelines, effectiveSelectedName],
  );

  const filteredPipelines = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return pipelines;
    return pipelines.filter((p) => p.name.toLowerCase().includes(term));
  }, [pipelines, search]);

  // When filtered results don't include the selected pipeline (e.g. search
  // excludes it), hide the detail panel while keeping the selection.
  const displayedPipeline = filteredPipelines.some((p) => p.name === effectiveSelectedName)
    ? selectedPipeline
    : null;

  // Publish screen context for AI chat
  const setPageSection = usePageContextStore((s) => s.setPageSection);
  useEffect(() => {
    if (!pipelinesData) return;
    setPageSection("ingestPipelines", {
      selectedPipeline: effectiveSelectedName,
      totalPipelines: pipelinesData.length,
      processorCount: selectedPipeline?.pipeline.processors?.length ?? 0,
    });
  }, [pipelinesData, effectiveSelectedName, selectedPipeline, setPageSection]);

  const insightContext = useMemo(() => {
    if (!selectedPipeline) return "";
    const processors = selectedPipeline.pipeline.processors ?? [];
    return JSON.stringify({
      pipelineName: selectedPipeline.name,
      processorCount: processors.length,
      processorTypes: processors.map((p) => Object.keys(p)[0] ?? "unknown"),
    });
  }, [selectedPipeline]);

  const insightCacheKey = `ingest-pipelines::${effectiveSelectedName ?? ""}::${selectedPipeline?.pipeline.processors?.length ?? 0}`;

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

      {insightContext && (
        <PageInsightBanner
          context={insightContext}
          systemPrompt="You are an Elasticsearch ingest pipeline expert. Describe this pipeline in one concise sentence. List the processors it has and what each does (e.g., parses log lines with grok, adds geo-IP lookup, sets timestamp)."
          cacheKey={insightCacheKey}
        />
      )}

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
          totalPipelineCount={pipelines.length}
          selectedName={effectiveSelectedName}
          onSelect={setSelectedName}
        />
        <PipelineDetailPanel
          key={effectiveSelectedName ?? "none"}
          selectedPipeline={displayedPipeline}
          connection={connection}
          pipelinesExist={pipelines.length > 0}
        />
      </Box>
    </Box>
  );
}
