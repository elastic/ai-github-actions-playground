import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

interface ResetConfirmationDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const AFFECTED_STATE = [
  "Connection settings and credentials",
  "Dashboard layouts and state",
  "Query Lab filters and queries",
  "Traces, metrics, and fleet filters",
  "LLM and AI assistant configuration",
  "UI preferences (theme, panel state)",
];

export default function ResetConfirmationDialog({
  open,
  onConfirm,
  onCancel,
}: ResetConfirmationDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Reset all application state?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          This will clear all locally stored data, including:
        </Typography>
        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
          {AFFECTED_STATE.map((item) => (
            <li key={item}>
              <Typography variant="body2">{item}</Typography>
            </li>
          ))}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          This action cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button color="error" variant="contained" onClick={onConfirm}>
          Reset
        </Button>
      </DialogActions>
    </Dialog>
  );
}
