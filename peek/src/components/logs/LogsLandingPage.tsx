import { useCallback } from "react";
import { parseAsString, useQueryState } from "nuqs";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid2";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import AppsIcon from "@mui/icons-material/Apps";
import ComputerIcon from "@mui/icons-material/Computer";
import DescriptionIcon from "@mui/icons-material/Description";
import LayersIcon from "@mui/icons-material/Layers";
import TerminalIcon from "@mui/icons-material/Terminal";

import { useConnectionStore } from "../../store/useConnectionStore";
import { useDashboardEditorStore } from "../../store/useDashboardEditorStore";
import { useOpenInDiscover } from "../../hooks/useOpenInDiscover";
import { useLogsTileCounts } from "../../hooks/useLogsTileCounts";
import { interactiveCardSx } from "../interactiveCardSx";

import LogsDimensionListPage from "./LogsDimensionListPage";
import { LOGS_DIMENSION_LABELS, type LogsFocusDimension } from "./logsDimensions";
import { timeRangeToEsqlFilter } from "./logsQueryBuilder";

interface FocusOption {
  dimension: LogsFocusDimension | null;
  label: string;
  subtext: string;
  icon: React.ReactNode;
}

const FOCUS_OPTIONS: FocusOption[] = [
  {
    dimension: "service.name",
    label: "Services",
    subtext: "Browse log volume by service name",
    icon: <LayersIcon fontSize="large" color="primary" />,
  },
  {
    dimension: "host.name",
    label: "Hosts",
    subtext: "Browse log volume by host",
    icon: <ComputerIcon fontSize="large" color="primary" />,
  },
  {
    dimension: "process.name",
    label: "Processes",
    subtext: "Browse log volume by process name",
    icon: <TerminalIcon fontSize="large" color="primary" />,
  },
  {
    dimension: "log.file.path",
    label: "Files",
    subtext: "Browse log volume by file path",
    icon: <DescriptionIcon fontSize="large" color="primary" />,
  },
  {
    dimension: null,
    label: "All logs",
    subtext: "Open all logs in Query Lab",
    icon: <AppsIcon fontSize="large" color="primary" />,
  },
];

function isLogsFocusDimension(value: string | null): value is LogsFocusDimension {
  return !!value && Object.prototype.hasOwnProperty.call(LOGS_DIMENSION_LABELS, value);
}

export default function LogsLandingPage() {
  const connection = useConnectionStore((s) => s.connection);
  const timeRange = useDashboardEditorStore((s) => s.dashboard.timeRange);
  const openInDiscover = useOpenInDiscover();
  const { counts, subtexts } = useLogsTileCounts(connection, timeRange);

  const [urlDimension, setUrlDimension] = useQueryState("focus", parseAsString);
  const dimension = isLogsFocusDimension(urlDimension) ? urlDimension : null;

  const handleSelect = useCallback(
    async (dim: LogsFocusDimension | null) => {
      if (dim === null) {
        const timeFilter = timeRangeToEsqlFilter(timeRange);
        openInDiscover(`FROM logs-* | WHERE ${timeFilter} | SORT @timestamp DESC | LIMIT 500`);
        return;
      }
      await setUrlDimension(dim);
    },
    [openInDiscover, setUrlDimension, timeRange],
  );

  const handleBack = useCallback(async () => {
    await setUrlDimension(null);
  }, [setUrlDimension]);

  if (dimension && !connection) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Connect to Elasticsearch to browse {LOGS_DIMENSION_LABELS[dimension].plural.toLowerCase()}
          .
        </Alert>
        <Button variant="outlined" size="small" onClick={() => void handleBack()}>
          Back
        </Button>
      </Paper>
    );
  }

  // Step 2: Show dimension list
  if (dimension && connection) {
    return (
      <LogsDimensionListPage dimension={dimension} connection={connection} onBack={handleBack} />
    );
  }

  // Step 1: Focus picker
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" component="h1">
          What logs are you looking for?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Pick a dimension to browse, or open all logs in Query Lab.
        </Typography>
      </Box>
      <Grid container spacing={2}>
        {FOCUS_OPTIONS.map((option) => {
          const dim = option.dimension;
          // "All logs" always visible; dimension tiles show based on count state
          if (dim !== null && counts[dim] === "hidden") return null;

          const isLoading = dim !== null && counts[dim] === "loading";
          const subtext = dim !== null && subtexts[dim] ? subtexts[dim] : option.subtext;

          return (
            <Grid key={option.dimension ?? "all"} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant="outlined" sx={{ height: "100%", ...interactiveCardSx }}>
                <CardActionArea
                  onClick={() => void handleSelect(option.dimension)}
                  sx={{ height: "100%", p: 1 }}
                >
                  <CardContent>
                    <Box sx={{ mb: 1 }}>{option.icon}</Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {option.label}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                      {isLoading ? (
                        <>
                          <CircularProgress size={10} thickness={5} />
                          <Skeleton variant="text" width={80} sx={{ fontSize: "body2.fontSize" }} />
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {subtext}
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Paper>
  );
}
