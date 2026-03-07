import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { HealthReportIndicator } from "../../services/es";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type IndicatorStatus = "green" | "yellow" | "red" | "unknown";

function indicatorStatusColor(
  status: IndicatorStatus | undefined,
): "success" | "warning" | "error" | "default" {
  if (status === "green") return "success";
  if (status === "yellow") return "warning";
  if (status === "red") return "error";
  return "default";
}

export interface DiagnosticsIndicatorRow {
  key: string;
  name: string;
  status: IndicatorStatus;
  symptom: string;
  indicator: HealthReportIndicator;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  selected: DiagnosticsIndicatorRow | null;
  onClose: () => void;
}

export default function DiagnosticsDetailDrawer({ selected, onClose }: Props) {
  return (
    <Drawer
      anchor="right"
      open={Boolean(selected)}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: "100%", sm: 560 },
            p: 2,
            gap: 1.5,
            display: "flex",
            flexDirection: "column",
          },
        },
      }}
    >
      {selected && (
        <>
          <Typography variant="h6">{selected.name}</Typography>
          <Chip
            size="small"
            color={indicatorStatusColor(selected.status)}
            label={selected.status.toUpperCase()}
          />
          <Typography variant="body2" color="text.secondary">
            {selected.symptom}
          </Typography>

          {/* Impacts */}
          {selected.indicator.impacts && selected.indicator.impacts.length > 0 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Impacts
              </Typography>
              <Stack spacing={1}>
                {selected.indicator.impacts.map((impact) => (
                  <Paper
                    key={`impact-${impact.id ?? impact.description}`}
                    variant="outlined"
                    sx={{ p: 1 }}
                  >
                    <Stack direction="row" spacing={0.5} alignItems="center" mb={0.5}>
                      <Chip
                        size="small"
                        label={`Severity ${impact.severity ?? "?"}`}
                        color={
                          (impact.severity ?? 0) >= 3
                            ? "error"
                            : (impact.severity ?? 0) >= 2
                              ? "warning"
                              : "default"
                        }
                      />
                      {impact.impact_areas?.map((area) => (
                        <Chip key={area} size="small" label={area} variant="outlined" />
                      ))}
                    </Stack>
                    <Typography variant="body2">{impact.description}</Typography>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}

          {/* Diagnoses */}
          {selected.indicator.diagnosis && selected.indicator.diagnosis.length > 0 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Diagnoses
              </Typography>
              <Stack spacing={1}>
                {selected.indicator.diagnosis.map((diag) => (
                  <Paper key={`diag-${diag.id ?? diag.cause}`} variant="outlined" sx={{ p: 1 }}>
                    {diag.cause && (
                      <Typography variant="body2" fontWeight="bold">
                        Cause: {diag.cause}
                      </Typography>
                    )}
                    {diag.action && <Typography variant="body2">Action: {diag.action}</Typography>}
                    {diag.help_url && (
                      <Link
                        href={diag.help_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="body2"
                      >
                        View documentation
                      </Link>
                    )}
                    {diag.affected_resources && Object.keys(diag.affected_resources).length > 0 && (
                      <Box
                        component="pre"
                        sx={{
                          mt: 0.5,
                          p: 1,
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 1,
                          overflow: "auto",
                          fontSize: 12,
                        }}
                      >
                        {JSON.stringify(diag.affected_resources, null, 2)}
                      </Box>
                    )}
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}

          {/* Raw details */}
          {selected.indicator.details && Object.keys(selected.indicator.details).length > 0 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Details (raw)
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                  overflow: "auto",
                  fontSize: 12,
                }}
              >
                {JSON.stringify(selected.indicator.details, null, 2)}
              </Box>
            </Box>
          )}

          <Button size="small" onClick={onClose}>
            Close
          </Button>
        </>
      )}
    </Drawer>
  );
}
