import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";

import type { TransformRow } from "../../services/es";

import { formatMs, formatNum } from "./transformSortUtils";
import { DetailSection, DetailField } from "./TransformDetailFields";

interface TransformDetailDrawerProps {
  row: TransformRow | null;
  onClose: () => void;
}

export function TransformDetailDrawer({ row, onClose }: TransformDetailDrawerProps) {
  const [showRawJson, setShowRawJson] = useState(false);

  return (
    <Drawer
      anchor="right"
      open={Boolean(row)}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: "100%", md: 620 }, p: 1, backgroundColor: "background.default" },
      }}
    >
      {row && (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 1,
            }}
          >
            <Typography variant="subtitle1">{row.id}</Typography>
            <IconButton size="small" aria-label="Close transform details" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 1, py: 1 }}>
            <DetailSection title="Configuration">
              <DetailField label="Transform ID">{row.id}</DetailField>
              {row.description && <DetailField label="Description">{row.description}</DetailField>}
              <DetailField label="Type">{row.type}</DetailField>
              <DetailField label="Source Indices">
                {row.sourceIndices.join(", ") || "—"}
              </DetailField>
              <DetailField label="Destination Index">{row.destIndex || "—"}</DetailField>
              {row.destPipeline && (
                <DetailField label="Destination Pipeline">{row.destPipeline}</DetailField>
              )}
              {row.frequency && <DetailField label="Frequency">{row.frequency}</DetailField>}
              {row.syncField && <DetailField label="Sync Field">{row.syncField}</DetailField>}
              {row.syncDelay && <DetailField label="Sync Delay">{row.syncDelay}</DetailField>}
              {row.retentionMaxAge && (
                <DetailField label="Retention Max Age">{row.retentionMaxAge}</DetailField>
              )}
              {row.maxPageSearchSize != null && (
                <DetailField label="Max Page Search Size">
                  {formatNum(row.maxPageSearchSize)}
                </DetailField>
              )}
              {row.docsPerSecond != null && (
                <DetailField label="Docs Per Second">
                  {row.docsPerSecond === 0 ? "unlimited" : formatNum(row.docsPerSecond)}
                </DetailField>
              )}
            </DetailSection>

            <DetailSection title="Performance">
              <DetailField label="Search Time">{formatMs(row.searchTimeMs)}</DetailField>
              <DetailField label="Index Time">{formatMs(row.indexTimeMs)}</DetailField>
              <DetailField label="Processing Time">{formatMs(row.processingTimeMs)}</DetailField>
              <DetailField label="Delete Time">{formatMs(row.deleteTimeMs)}</DetailField>
              <DetailField label="Trigger Count">{formatNum(row.triggerCount)}</DetailField>
              <DetailField label="Pages Processed">{formatNum(row.pagesProcessed)}</DetailField>
            </DetailSection>

            <DetailSection title="Checkpoint">
              <DetailField label="Last Checkpoint">{formatNum(row.checkpoint)}</DetailField>
              {row.lastCheckpointTimeMs != null && (
                <DetailField label="Last Checkpoint Time">
                  {new Date(row.lastCheckpointTimeMs).toLocaleString()}
                </DetailField>
              )}
              {row.nextCheckpoint != null && (
                <DetailField label="Next Checkpoint">{formatNum(row.nextCheckpoint)}</DetailField>
              )}
              {row.nextCheckpointDocsProcessed != null && (
                <DetailField label="Next Ckpt Docs Processed">
                  {formatNum(row.nextCheckpointDocsProcessed)}
                </DetailField>
              )}
              {row.nextCheckpointDocsIndexed != null && (
                <DetailField label="Next Ckpt Docs Indexed">
                  {formatNum(row.nextCheckpointDocsIndexed)}
                </DetailField>
              )}
              <DetailField label="Avg Checkpoint Duration">
                {formatMs(row.avgCheckpointDurationMs)}
              </DetailField>
              <DetailField label="Exp Avg Docs Indexed">
                {row.expAvgDocsIndexed.toFixed(1)}
              </DetailField>
              <DetailField label="Exp Avg Docs Processed">
                {row.expAvgDocsProcessed.toFixed(1)}
              </DetailField>
            </DetailSection>

            <DetailSection title="Failures">
              <DetailField label="Search Failures" warn={row.searchFailures > 0}>
                {formatNum(row.searchFailures)}
              </DetailField>
              <DetailField label="Index Failures" warn={row.indexFailures > 0}>
                {formatNum(row.indexFailures)}
              </DetailField>
            </DetailSection>

            <Box sx={{ mt: 1 }}>
              <Button
                size="small"
                variant="text"
                onClick={() => setShowRawJson((v) => !v)}
                sx={{ textTransform: "none" }}
              >
                {showRawJson ? "Hide raw JSON" : "Show raw JSON"}
              </Button>
              {showRawJson && (
                <Paper
                  variant="outlined"
                  sx={{
                    mt: 1,
                    p: 1.5,
                    maxHeight: 400,
                    overflow: "auto",
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {JSON.stringify({ definition: row.definition, stats: row.stats }, null, 2)}
                </Paper>
              )}
            </Box>
          </Box>
        </>
      )}
    </Drawer>
  );
}
