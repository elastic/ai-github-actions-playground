import { useCallback, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";

import type { ElasticsearchConnection } from "../../services/es";
import { useDashboardEditorStore } from "../../store/useDashboardEditorStore";
import { useOpenInDiscover } from "../../hooks/useOpenInDiscover";
import { useRankedDimensionValues } from "../../hooks/useRankedDimensionValues";
import ContentSkeleton from "../ContentSkeleton";
import EmptyState from "../EmptyState";
import RankedValueList from "../RankedValueList";
import { escapeEsqlString } from "../../services/es/esqlUtils";
import { timeRangeToEsqlFilter } from "./logsQueryBuilder";

import { LOGS_DIMENSION_LABELS, type LogsFocusDimension } from "./logsDimensions";

interface LogsDimensionListPageProps {
  dimension: LogsFocusDimension;
  connection: ElasticsearchConnection;
  onBack: () => void;
}

export default function LogsDimensionListPage({
  dimension,
  connection,
  onBack,
}: LogsDimensionListPageProps) {
  const openInDiscover = useOpenInDiscover();
  const timeRange = useDashboardEditorStore((s) => s.dashboard.timeRange);
  const [search, setSearch] = useState("");

  const buildQuery = useCallback(() => {
    const timeFilter = timeRangeToEsqlFilter(timeRange);
    return `FROM logs-* | WHERE ${timeFilter} | WHERE ${dimension} IS NOT NULL | STATS count = COUNT(*) BY ${dimension} | SORT count DESC | LIMIT 200`;
  }, [dimension, timeRange]);

  const { rows, loading, error } = useRankedDimensionValues({
    connection,
    buildQuery,
    dimensionColumn: dimension,
    metricColumn: "count",
  });
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? rows.filter((row) => row.value.toLowerCase().includes(term)) : rows;
  }, [rows, search]);

  const handleOpenInQueryLab = useCallback(
    (value: string) => {
      const escaped = escapeEsqlString(value);
      openInDiscover(
        `FROM logs-* | WHERE ${dimension} == "${escaped}" | SORT @timestamp DESC | LIMIT 500`,
      );
    },
    [dimension, openInDiscover],
  );

  const { singular: dimensionLabel, plural: dimensionPluralLabel } =
    LOGS_DIMENSION_LABELS[dimension];
  const noData = rows.length === 0;
  const emptyHeading = noData
    ? `No ${dimensionLabel.toLowerCase()} data found`
    : `No results match "${search}"`;
  const emptyDescription = noData
    ? `No values for ${dimension} were found in logs-* for the current time range.`
    : "Try a different search term.";

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 2 }}>
        <Button size="small" variant="text" startIcon={<ArrowBackIcon />} onClick={onBack}>
          Back
        </Button>
        <Box>
          <Typography variant="h6" component="h1">
            {dimensionPluralLabel}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ranked by log volume &mdash; click to explore in Query Lab
          </Typography>
        </Box>
      </Box>

      <TextField
        placeholder={`Search ${dimensionLabel.toLowerCase()} names\u2026`}
        aria-label={`Search ${dimensionLabel.toLowerCase()} names`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          },
        }}
      />

      {loading && <ContentSkeleton variant="list" />}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState heading={emptyHeading} description={emptyDescription} size="small" />
      )}

      {!loading && !error && filtered.length > 0 && (
        <RankedValueList
          rows={filtered}
          metricLabel="logs"
          maxMetric={rows[0]?.metric}
          onSelect={handleOpenInQueryLab}
        />
      )}
    </Paper>
  );
}
