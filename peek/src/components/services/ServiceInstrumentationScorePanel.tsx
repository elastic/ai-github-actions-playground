import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import type { ServiceInstrumentationScore, ScoreCategory } from "../../instrumentation-score";

interface ServiceInstrumentationScorePanelProps {
  score: ServiceInstrumentationScore | null;
  loading: boolean;
  error: string | null;
}

const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  excellent: "Excellent",
  good: "Good",
  "needs-improvement": "Needs Improvement",
  poor: "Poor",
};

const CATEGORY_COLORS: Record<ScoreCategory, "success" | "info" | "warning" | "error"> = {
  excellent: "success",
  good: "info",
  "needs-improvement": "warning",
  poor: "error",
};

const IMPACT_LABELS: Record<string, string> = {
  critical: "Critical",
  important: "Important",
  normal: "Normal",
  low: "Low",
};

export default function ServiceInstrumentationScorePanel({
  score,
  loading,
  error,
}: ServiceInstrumentationScorePanelProps) {
  const formattedScore = score ? score.score.toFixed(2) : null;

  return (
    <Paper variant="outlined" sx={{ minHeight: 120, overflow: "auto" }}>
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Instrumentation Score
        </Typography>
        <Typography variant="caption" color="text.secondary">
          OpenTelemetry instrumentation quality based on the{" "}
          <Link
            href="https://github.com/instrumentation-score/spec"
            target="_blank"
            rel="noopener noreferrer"
          >
            instrumentation-score spec
          </Link>
        </Typography>
      </Box>

      {loading && !score && (
        <Box sx={{ px: 2, py: 1 }}>
          <LinearProgress />
        </Box>
      )}

      {error && !score && (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="error">
            Failed to evaluate instrumentation score: {error}
          </Typography>
        </Box>
      )}

      {error && score && (
        <Box sx={{ px: 2, pt: 1 }}>
          <Typography variant="caption" color="warning.main">
            Some checks may be incomplete: {error}
          </Typography>
        </Box>
      )}

      {score && (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              px: 2,
              py: 1.5,
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <Typography variant="h5" component="p" sx={{ fontWeight: 700, minWidth: 56 }}>
              {formattedScore}
            </Typography>
            <Box>
              <Chip
                size="small"
                label={CATEGORY_LABELS[score.category]}
                color={CATEGORY_COLORS[score.category]}
                variant="filled"
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {score.passed}/{score.total} checks passed
              </Typography>
            </Box>
          </Box>

          <Table size="small" aria-label="Instrumentation score checks">
            <TableHead>
              <TableRow>
                <TableCell>Rule</TableCell>
                <TableCell>Impact</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {score.rules.map((rule) => (
                <TableRow key={rule.id} hover>
                  <TableCell>
                    <Link
                      href={rule.specUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="body2"
                      underline="hover"
                      sx={{ fontWeight: 500 }}
                    >
                      {rule.id}
                    </Link>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {rule.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {IMPACT_LABELS[rule.impact] ?? rule.impact}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={rule.passed ? "Pass" : "Fail"}
                      color={rule.passed ? "success" : "error"}
                      variant={rule.passed ? "outlined" : "filled"}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{rule.summary}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Paper>
  );
}
