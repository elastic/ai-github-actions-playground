import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid2";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ComputerIcon from "@mui/icons-material/Computer";
import DescriptionIcon from "@mui/icons-material/Description";
import LayersIcon from "@mui/icons-material/Layers";
import MemoryIcon from "@mui/icons-material/Memory";
import SubjectIcon from "@mui/icons-material/Subject";

import { interactiveCardSx } from "../interactiveCardSx";

export type LogsFocusDimension = "service.name" | "host.name" | "process.name" | "log.file.path";

interface FocusOption {
  dimension: LogsFocusDimension | null;
  label: string;
  subtext: string;
  example: string;
  icon: React.ReactNode;
}

const FOCUS_OPTIONS: FocusOption[] = [
  {
    dimension: "service.name",
    label: "A service",
    subtext: "Explore logs from a specific service or application",
    example: 'e.g. "checkout-service", "api-gateway"',
    icon: <LayersIcon fontSize="large" color="primary" />,
  },
  {
    dimension: "host.name",
    label: "A host",
    subtext: "Explore logs from a specific machine or host",
    example: 'e.g. "ip-10-0-1-10", "prod-web-01"',
    icon: <ComputerIcon fontSize="large" color="primary" />,
  },
  {
    dimension: "process.name",
    label: "A process",
    subtext: "Explore logs from a specific process or executable",
    example: 'e.g. "nginx", "java", "node"',
    icon: <MemoryIcon fontSize="large" color="primary" />,
  },
  {
    dimension: "log.file.path",
    label: "A file",
    subtext: "Explore logs from a specific log file path",
    example: 'e.g. "/var/log/syslog", "/var/log/nginx/access.log"',
    icon: <DescriptionIcon fontSize="large" color="primary" />,
  },
  {
    dimension: null,
    label: "All logs",
    subtext: "Browse all available logs with no filter",
    example: "Search across every log index",
    icon: <SubjectIcon fontSize="large" color="primary" />,
  },
];

interface LogsFocusPickerProps {
  onSelect: (dimension: LogsFocusDimension | null) => void;
}

export default function LogsFocusPicker({ onSelect }: LogsFocusPickerProps) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" component="h2">
          What are you investigating?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Choose a starting point to explore your logs. You can always refine your query later.
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
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5, display: "block" }}
                  >
                    {option.example}
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
