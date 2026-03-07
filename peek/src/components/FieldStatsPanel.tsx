import { useCallback } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import ContentSkeleton from "./ContentSkeleton";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";

import {
  buildFieldStatsQuery,
  buildTopValuesQuery,
  buildMinMaxQuery,
  isKeywordLikeType,
  isNumericOrDateType,
} from "../services/es";
import type { ElasticsearchConnection, ConfidenceLevel } from "../services/es";
import { useFieldStats } from "../hooks/useFieldStats";

import EmptyState from "./EmptyState";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FieldStatsPanelProps {
  connection: ElasticsearchConnection;
  streamName: string;
  fieldName: string;
  fieldType: string;
  onClose: () => void;
  onOpenInQueryLab: (query: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNullPercent(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

const CONFIDENCE_COLOR: Record<ConfidenceLevel, "success" | "warning" | "error"> = {
  high: "success",
  medium: "warning",
  low: "error",
};

const CONFIDENCE_TOOLTIP: Record<ConfidenceLevel, string> = {
  high: "All documents in this stream were analyzed — stats are exact.",
  medium:
    "Stats are nearly complete but the stream is approaching the sample limit. Results may become approximate for very large streams.",
  low: "The sample limit was reached. Stats reflect only a subset of documents in this stream.",
};

function buildQueryLabQuery(streamName: string, fieldName: string, fieldType: string): string {
  if (isKeywordLikeType(fieldType)) {
    return buildTopValuesQuery(streamName, fieldName);
  }
  if (isNumericOrDateType(fieldType)) {
    return buildMinMaxQuery(streamName, fieldName);
  }
  return buildFieldStatsQuery(streamName, fieldName);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FieldStatsPanel({
  connection,
  streamName,
  fieldName,
  fieldType,
  onClose,
  onOpenInQueryLab,
}: FieldStatsPanelProps) {
  const result = useFieldStats(connection, streamName, fieldName, fieldType);
  const loading = result.status === "loading";
  const error = result.status === "error" ? result.error : null;
  const stats = result.status === "success" ? result.data : null;

  const handleOpenInQueryLab = useCallback(() => {
    onOpenInQueryLab(buildQueryLabQuery(streamName, fieldName, fieldType));
  }, [streamName, fieldName, fieldType, onOpenInQueryLab]);

  return (
    <Paper
      variant="outlined"
      sx={{ display: "flex", flexShrink: 0, flexDirection: "column", width: 300, minHeight: 0 }}
    >
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0, py: 1, px: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap title={fieldName}>
            {fieldName}
          </Typography>
          <Chip size="small" label={fieldType} sx={{ mt: 0.5 }} />
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close field stats">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Divider />

      {/* Body */}
      <Box
        aria-busy={loading}
        sx={{ display: "flex", flex: 1, flexDirection: "column", gap: 1, overflow: "auto", p: 1.5 }}
      >
        {loading && (
          <Box
            role="status"
            aria-live="polite"
            aria-label="Loading field statistics"
            data-testid="field-stats-loading"
          >
            <ContentSkeleton variant="list" />
          </Box>
        )}

        {!loading && error && <Alert severity="error">{error}</Alert>}

        {!loading && stats && (
          <>
            {/* Confidence badge */}
            <Tooltip title={CONFIDENCE_TOOLTIP[stats.confidence]} placement="top">
              <Chip
                size="small"
                label={CONFIDENCE_LABEL[stats.confidence]}
                color={CONFIDENCE_COLOR[stats.confidence]}
                data-testid="field-stats-confidence-badge"
                sx={{ alignSelf: "flex-start" }}
              />
            </Tooltip>

            {/* Counts grid */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                rowGap: 0.5,
                columnGap: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Total docs
              </Typography>
              <Typography variant="body2" data-testid="field-stats-total">
                {stats.totalCount.toLocaleString()}
              </Typography>

              <Typography variant="caption" color="text.secondary">
                Non-null
              </Typography>
              <Typography variant="body2" data-testid="field-stats-non-null">
                {stats.nonNullCount.toLocaleString()}
              </Typography>

              <Typography variant="caption" color="text.secondary">
                Null %
              </Typography>
              <Typography variant="body2" data-testid="field-stats-null-pct">
                {formatNullPercent(stats.nullPercent)}
              </Typography>

              <Typography variant="caption" color="text.secondary">
                Cardinality
              </Typography>
              <Typography variant="body2" data-testid="field-stats-cardinality">
                {stats.cardinality.toLocaleString()}
              </Typography>
            </Box>

            {/* Top values (keyword-like) */}
            {stats.topValues !== undefined && (
              <>
                <Divider />
                <Typography variant="caption" color="text.secondary">
                  Top values
                </Typography>
                {stats.topValues.length === 0 ? (
                  <EmptyState
                    size="small"
                    heading="No values found"
                    description="No distinct values detected in the current range"
                  />
                ) : (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    {stats.topValues.map((tv) => (
                      <Stack
                        key={tv.value}
                        direction="row"
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                          title={tv.value}
                        >
                          {tv.value}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                          {tv.count.toLocaleString()}
                        </Typography>
                      </Stack>
                    ))}
                  </Box>
                )}
              </>
            )}

            {/* Min / Max (numeric or date) */}
            {(stats.min !== undefined || stats.max !== undefined) && (
              <>
                <Divider />
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    rowGap: 0.5,
                    columnGap: 1,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Min
                  </Typography>
                  <Typography variant="body2" data-testid="field-stats-min">
                    {stats.min != null ? String(stats.min) : "—"}
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    Max
                  </Typography>
                  <Typography variant="body2" data-testid="field-stats-max">
                    {stats.max != null ? String(stats.max) : "—"}
                  </Typography>
                </Box>
              </>
            )}
          </>
        )}
      </Box>

      <Divider />

      {/* Footer */}
      <Box sx={{ flexShrink: 0, p: 1 }}>
        <Button
          size="small"
          variant="outlined"
          fullWidth
          onClick={handleOpenInQueryLab}
          data-testid="field-stats-open-in-query-lab"
        >
          Open stats query in Query Lab
        </Button>
      </Box>
    </Paper>
  );
}
