import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LoadingButton from "./LoadingButton";
import Collapse from "@mui/material/Collapse";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";

import { useConnectionStore } from "../store/useConnectionStore";
import { usePageContextStore } from "../store/usePageContextStore";
import { useIngestPipelines } from "../hooks/useIngestPipelines";
import { useIngestNodeStats } from "../hooks/useIngestNodeStats";
import { INSIGHT_GUARDRAIL } from "../hooks/insightPromptUtils";

import PageHeader from "./PageHeader";
import PageInsightBanner from "./PageInsightBanner";
import { OverviewInfoCard } from "./OverviewInfoCard";
import PipelineListPanel from "./ingest-pipelines/PipelineListPanel";
import PipelineDetailPanel from "./ingest-pipelines/PipelineDetailPanel";
import { humanizeEsError } from "./ingest-pipelines/ingestPipelineUtils";

export default function IngestPipelinesPage() {
  const connection = useConnectionStore((s) => s.connection);
  const pipelinesResult = useIngestPipelines();
  const ingestNodeStatsResult = useIngestNodeStats();

  const loading =
    pipelinesResult.status === "loading" || ingestNodeStatsResult.status === "loading";
  const error = pipelinesResult.status === "error" ? pipelinesResult.error : null;
  const pipelinesData = pipelinesResult.status === "success" ? pipelinesResult.data : null;
  const pipelines = useMemo(() => pipelinesData ?? [], [pipelinesData]);

  const [search, setSearch] = useState("");
  const [showRawError, setShowRawError] = useState(false);
  const [showSystemPipelines, setShowSystemPipelines] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const visiblePipelines = useMemo(
    () => pipelines.filter((pipeline) => showSystemPipelines || !pipeline.name.startsWith(".")),
    [pipelines, showSystemPipelines],
  );

  // Keep selection valid when pipeline list changes.
  useEffect(() => {
    if (!pipelinesData) return;
    if (!selectedName) return;
    if (visiblePipelines.some((p) => p.name === selectedName)) return;
    setSelectedName(null);
  }, [pipelinesData, selectedName, visiblePipelines]);

  const effectiveSelectedName = selectedName;

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => p.name === effectiveSelectedName) ?? null,
    [pipelines, effectiveSelectedName],
  );

  const filteredPipelines = useMemo(() => {
    const term = search.trim().toLowerCase();
    return visiblePipelines.filter((p) => {
      if (!term) return true;
      return p.name.toLowerCase().includes(term);
    });
  }, [search, visiblePipelines]);

  const runtimeByPipelineName = useMemo(() => {
    if (ingestNodeStatsResult.status !== "success") return {};
    const byPipeline = new Map<
      string,
      { count: number; failed: number; current: number; timeMs: number; nodes: Set<string> }
    >();
    for (const [nodeId, node] of Object.entries(ingestNodeStatsResult.data.nodes ?? {})) {
      for (const [pipelineName, stats] of Object.entries(node.ingest?.pipelines ?? {})) {
        const existing = byPipeline.get(pipelineName) ?? {
          count: 0,
          failed: 0,
          current: 0,
          timeMs: 0,
          nodes: new Set<string>(),
        };
        existing.count += stats.count ?? 0;
        existing.failed += stats.failed ?? 0;
        existing.current += stats.current ?? 0;
        existing.timeMs += stats.time_in_millis ?? 0;
        existing.nodes.add(nodeId);
        byPipeline.set(pipelineName, existing);
      }
    }

    return Object.fromEntries(
      Array.from(byPipeline.entries()).map(([pipelineName, stats]) => [
        pipelineName,
        {
          count: stats.count,
          failed: stats.failed,
          current: stats.current,
          timeMs: stats.timeMs,
          nodes: stats.nodes.size,
        },
      ]),
    );
  }, [ingestNodeStatsResult]);

  const pipelineMetrics = useMemo(() => {
    if (ingestNodeStatsResult.status !== "success") {
      return {
        totalVisiblePipelines: visiblePipelines.length,
        pipelinesWithErrors: null as number | null,
        activePipelines: null as number | null,
        currentInFlight: null as number | null,
        totalTimeMs: null as number | null,
      };
    }

    let pipelinesWithErrors = 0;
    let activePipelines = 0;
    let currentInFlight = 0;
    let totalTimeMs = 0;
    for (const pipeline of visiblePipelines) {
      const runtime = runtimeByPipelineName[pipeline.name];
      if (!runtime) continue;
      totalTimeMs += runtime.timeMs;
      currentInFlight += runtime.current;
      if (runtime.current > 0) activePipelines += 1;
      if (runtime.failed > 0) pipelinesWithErrors += 1;
    }

    return {
      totalVisiblePipelines: visiblePipelines.length,
      pipelinesWithErrors,
      activePipelines,
      currentInFlight,
      totalTimeMs,
    };
  }, [ingestNodeStatsResult.status, runtimeByPipelineName, visiblePipelines]);

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

  const processorSignature = (selectedPipeline?.pipeline.processors ?? [])
    .map((processor) => Object.keys(processor)[0] ?? "unknown")
    .join(",");
  const insightCacheKey = `ingest-pipelines::${effectiveSelectedName ?? ""}::${processorSignature}`;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Ingest Pipelines"
          actions={
            <LoadingButton
              size="small"
              variant="outlined"
              onClick={() => {
                pipelinesResult.refresh();
                ingestNodeStatsResult.refresh();
              }}
              loading={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </LoadingButton>
          }
        />
      </Paper>

      {insightContext && (
        <PageInsightBanner
          context={insightContext}
          systemPrompt={`You are an Elasticsearch ingest pipeline expert. Describe this pipeline in one concise sentence. List the processors it has and what each does (e.g., parses log lines with grok, adds geo-IP lookup, sets timestamp).${INSIGHT_GUARDRAIL}`}
          cacheKey={insightCacheKey}
        />
      )}

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        sx={{ alignItems: { md: "center" } }}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Box sx={{ minWidth: 170 }}>
            <OverviewInfoCard title="Total pipelines">
              <Typography variant="h6">
                {pipelineMetrics.totalVisiblePipelines.toLocaleString()}
              </Typography>
            </OverviewInfoCard>
          </Box>
          <Box sx={{ minWidth: 170 }}>
            <OverviewInfoCard title="Pipelines with errors">
              <Typography
                variant="h6"
                color={pipelineMetrics.pipelinesWithErrors ? "warning.main" : undefined}
              >
                {pipelineMetrics.pipelinesWithErrors === null
                  ? "n/a"
                  : pipelineMetrics.pipelinesWithErrors.toLocaleString()}
              </Typography>
            </OverviewInfoCard>
          </Box>
          <Box sx={{ minWidth: 190 }}>
            <OverviewInfoCard title="Active pipelines">
              <Typography variant="h6">
                {pipelineMetrics.activePipelines === null
                  ? "n/a"
                  : pipelineMetrics.activePipelines.toLocaleString()}
              </Typography>
            </OverviewInfoCard>
          </Box>
          <Box sx={{ minWidth: 190 }}>
            <OverviewInfoCard title="Current in-flight">
              <Typography variant="h6">
                {pipelineMetrics.currentInFlight === null
                  ? "n/a"
                  : pipelineMetrics.currentInFlight.toLocaleString()}
              </Typography>
            </OverviewInfoCard>
          </Box>
          <Box sx={{ minWidth: 190 }}>
            <OverviewInfoCard title="Total processing time">
              <Typography variant="h6">
                {pipelineMetrics.totalTimeMs === null
                  ? "n/a"
                  : pipelineMetrics.totalTimeMs < 1000
                    ? `${pipelineMetrics.totalTimeMs.toLocaleString()} ms`
                    : `${(pipelineMetrics.totalTimeMs / 1000).toFixed(2)} s`}
              </Typography>
            </OverviewInfoCard>
          </Box>
        </Stack>
      </Stack>

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
          showSystemPipelines={showSystemPipelines}
          onShowSystemPipelinesChange={setShowSystemPipelines}
          filteredPipelines={filteredPipelines}
          runtimeStatus={ingestNodeStatsResult.status}
          runtimeByPipelineName={runtimeByPipelineName}
          totalPipelineCount={pipelines.length}
          selectedName={effectiveSelectedName}
          onSelect={setSelectedName}
        />
      </Box>
      {ingestNodeStatsResult.status === "error" && (
        <Alert severity="warning">
          Runtime counters unavailable: {ingestNodeStatsResult.error}. Table runtime columns may
          show n/a.
        </Alert>
      )}
      <Drawer
        anchor="right"
        open={Boolean(displayedPipeline)}
        onClose={() => setSelectedName(null)}
        PaperProps={{
          sx: {
            width: { xs: "100%", md: 620 },
            p: 1,
            backgroundColor: "background.default",
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1 }}>
          <Typography variant="subtitle1">Pipeline details</Typography>
          <IconButton
            size="small"
            aria-label="Close pipeline details"
            onClick={() => setSelectedName(null)}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <PipelineDetailPanel
            key={effectiveSelectedName ?? "none"}
            selectedPipeline={displayedPipeline}
            connection={connection}
            pipelinesExist={pipelines.length > 0}
            ingestNodeStatsResult={ingestNodeStatsResult}
          />
        </Box>
      </Drawer>
    </Box>
  );
}
