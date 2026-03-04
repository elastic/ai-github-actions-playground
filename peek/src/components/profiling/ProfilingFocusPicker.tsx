import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid2";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import AppsIcon from "@mui/icons-material/Apps";
import ComputerIcon from "@mui/icons-material/Computer";
import LayersIcon from "@mui/icons-material/Layers";
import MemoryIcon from "@mui/icons-material/Memory";
import TuneIcon from "@mui/icons-material/Tune";

import { interactiveCardSx } from "../interactiveCardSx";

import type { ProfilingFocusDimension } from "./profilingQueryBuilder";

interface FocusOption {
  dimension: ProfilingFocusDimension | null;
  label: string;
  subtext: string;
  icon: React.ReactNode;
}

const FOCUS_OPTIONS: FocusOption[] = [
  {
    dimension: "service.name",
    label: "A service",
    subtext: "Profile CPU usage broken down by service name",
    icon: <LayersIcon fontSize="large" color="primary" />,
  },
  {
    dimension: "host.name",
    label: "A host",
    subtext: "Profile CPU usage for a specific machine or host",
    icon: <ComputerIcon fontSize="large" color="primary" />,
  },
  {
    dimension: "process.executable.name",
    label: "A process",
    subtext: "Profile CPU usage for a specific executable",
    icon: <MemoryIcon fontSize="large" color="primary" />,
  },
  {
    dimension: "process.thread.name",
    label: "A thread",
    subtext: "Profile CPU usage for a specific thread name",
    icon: <TuneIcon fontSize="large" color="primary" />,
  },
  {
    dimension: null,
    label: "Everything",
    subtext: "Show a full cluster-wide flamegraph with no filter",
    icon: <AppsIcon fontSize="large" color="primary" />,
  },
];

interface ProfilingFocusPickerProps {
  onSelect: (dimension: ProfilingFocusDimension | null) => void;
}

export default function ProfilingFocusPicker({ onSelect }: ProfilingFocusPickerProps) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6">What are you investigating?</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Choose a focus area to find and profile the right data.
        </Typography>
      </Box>
      <Grid container spacing={2}>
        {FOCUS_OPTIONS.map((option) => (
          <Grid key={option.dimension ?? "all"} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card
              variant="outlined"
              sx={{
                height: "100%",
                ...interactiveCardSx,
              }}
            >
              <CardActionArea
                onClick={() => onSelect(option.dimension)}
                sx={{ height: "100%", p: 1 }}
              >
                <CardContent>
                  <Box sx={{ mb: 1 }}>{option.icon}</Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {option.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {option.subtext}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}
