import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";

import {
  ElasticsearchClient,
  isElasticsearchError,
  fetchFieldStats,
  buildFieldStatsQuery,
  buildTopValuesQuery,
  buildMinMaxQuery,
  isKeywordLikeType,
  isNumericOrDateType,
} from "../services/es";
import type { ElasticsearchConnection, FieldStats } from "../services/es";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<FieldStats | null>(null);
  const requestIdRef = useRef(0);

  const loadStats = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    setStats(null);
    try {
      const client = new ElasticsearchClient(connection);
      const result = await fetchFieldStats(client, streamName, fieldName, fieldType);
      if (requestId === requestIdRef.current) {
        setStats(result);
      }
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setError(isElasticsearchError(err) ? err.message : String(err));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [connection, streamName, fieldName, fieldType]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const handleOpenInQueryLab = useCallback(() => {
    onOpenInQueryLab(buildQueryLabQuery(streamName, fieldName, fieldType));
  }, [streamName, fieldName, fieldType, onOpenInQueryLab]);

  return (
    <Paper
      variant="outlined"
      sx={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}
    >
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1, flexShrink: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap title={fieldName}>
            {fieldName}
          </Typography>
          <Chip size="small" label={fieldType} sx={{ mt: 0.25 }} />
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close field stats">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Divider />

      {/* Body */}
      <Box
        sx={{ flex: 1, overflow: "auto", p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}
      >
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {!loading && error && <Alert severity="error">{error}</Alert>}

        {!loading && stats && (
          <>
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
                  <Typography variant="body2" color="text.secondary">
                    No values found.
                  </Typography>
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
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
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
      <Box sx={{ p: 1, flexShrink: 0 }}>
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
