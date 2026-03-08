import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { EvaluatedHealthCheck, HealthSeverity, HealthStatus } from "../health-checks";

function statusColor(status: HealthStatus): "success" | "warning" | "error" | "default" {
  if (status === "pass") return "success";
  if (status === "warn") return "warning";
  if (status === "fail") return "error";
  return "default";
}

function statusAlertSeverity(status: HealthStatus): "success" | "warning" | "error" | "info" {
  const color = statusColor(status);
  return color === "default" ? "info" : color;
}

function severityColor(severity: HealthSeverity | null): "error" | "warning" | "info" | "default" {
  if (severity === "critical" || severity === "high") return "error";
  if (severity === "medium") return "warning";
  if (severity === "low") return "info";
  return "default";
}

interface HealthCheckDrawerProps {
  check: EvaluatedHealthCheck | null;
  onClose: () => void;
}

export default function HealthCheckDrawer({ check, onClose }: HealthCheckDrawerProps) {
  const navigate = useNavigate();

  return (
    <Drawer
      anchor="right"
      open={Boolean(check)}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: "100%", sm: 520 },
            p: 2.5,
            gap: 1.5,
            display: "flex",
            flexDirection: "column",
          },
        },
      }}
    >
      {check && (
        <>
          <Typography variant="h6">{check.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {check.description}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip size="small" label={check.domain} />
            <Chip
              size="small"
              color={statusColor(check.status)}
              label={check.status.toUpperCase()}
            />
            {check.severity && (
              <Chip
                size="small"
                color={severityColor(check.severity)}
                variant="outlined"
                label={check.severity}
              />
            )}
          </Stack>

          <Alert severity={statusAlertSeverity(check.status)}>{check.summary}</Alert>

          {check.reason && <Alert severity="info">{check.reason}</Alert>}

          {(check.definitionRecommendation || check.recommendation) && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Recommendation
              </Typography>
              <Typography variant="body2">
                {check.recommendation ?? check.definitionRecommendation}
              </Typography>
            </Box>
          )}

          {check.observed && Object.keys(check.observed).length > 0 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Observed data
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1.5,
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  overflow: "auto",
                  fontSize: 12,
                  maxHeight: 200,
                }}
              >
                {JSON.stringify(check.observed, null, 2)}
              </Box>
            </Box>
          )}

          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
            {check.links?.map((link) => (
              <Button
                key={`${link.to}-${link.label}`}
                size="small"
                variant="contained"
                onClick={() => {
                  onClose();
                  navigate(link.to);
                }}
              >
                {link.label}
              </Button>
            ))}
            {check.docsUrl && (
              <Button
                size="small"
                variant="outlined"
                component={Link}
                href={check.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Elastic Docs
              </Button>
            )}
            <Button size="small" onClick={onClose}>
              Close
            </Button>
          </Stack>
        </>
      )}
    </Drawer>
  );
}
