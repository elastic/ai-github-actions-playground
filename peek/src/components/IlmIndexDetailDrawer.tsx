import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";

import type { IlmIndexRow, IlmPolicyRow } from "../services/es/ilmTypes";

const PHASE_COLORS: Record<string, "info" | "success" | "warning" | "error" | "default"> = {
  hot: "error",
  warm: "warning",
  cold: "info",
  frozen: "info",
  delete: "default",
};

interface IlmIndexDetailDrawerProps {
  selectedRow: IlmIndexRow | null;
  selectedPolicyRow: IlmPolicyRow | null;
  onClose: () => void;
}

export default function IlmIndexDetailDrawer({
  selectedRow,
  selectedPolicyRow,
  onClose,
}: IlmIndexDetailDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={Boolean(selectedRow)}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", md: 560 },
          p: 1,
          backgroundColor: "background.default",
        },
      }}
    >
      {selectedRow && (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 1,
            }}
          >
            <Typography variant="subtitle1">ILM Index Details</Typography>
            <IconButton size="small" aria-label="Close ILM details" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 1, py: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              INDEX
            </Typography>
            <Typography variant="body2" gutterBottom sx={{ fontFamily: "monospace" }}>
              {selectedRow.index}
            </Typography>

            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              POLICY
            </Typography>
            <Typography variant="body2" gutterBottom>
              {selectedRow.policy}
            </Typography>

            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              PHASE
            </Typography>
            <Chip
              label={selectedRow.phase || "\u2014"}
              size="small"
              color={PHASE_COLORS[selectedRow.phase] ?? "default"}
              variant="outlined"
              sx={{ mb: 1 }}
            />

            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              ACTION
            </Typography>
            <Typography variant="body2" gutterBottom>
              {selectedRow.action || "\u2014"}
            </Typography>

            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              STEP
            </Typography>
            <Typography variant="body2" gutterBottom>
              {selectedRow.step || "\u2014"}
            </Typography>

            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              AGE
            </Typography>
            <Typography variant="body2" gutterBottom>
              {selectedRow.age || "\u2014"}
            </Typography>

            {selectedRow.isError && (
              <Alert severity="error" sx={{ mt: 1, mb: 1 }}>
                <Typography variant="body2" fontWeight={600}>
                  Failed Step: {selectedRow.failedStep}
                </Typography>
                <Typography variant="body2">{selectedRow.stepReason}</Typography>
              </Alert>
            )}

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                RAW JSON
              </Typography>
              <Paper
                variant="outlined"
                sx={{ p: 1, maxHeight: 300, overflow: "auto", fontSize: "0.75rem" }}
              >
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {JSON.stringify(
                    {
                      explain: selectedRow.raw ?? selectedRow,
                      policy: selectedPolicyRow?.raw ?? null,
                    },
                    null,
                    2,
                  )}
                </pre>
              </Paper>
            </Box>
          </Box>
        </>
      )}
    </Drawer>
  );
}
