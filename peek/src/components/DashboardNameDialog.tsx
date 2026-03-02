import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";

interface DashboardNameDialogProps {
  open: boolean;
  mode: "create" | "rename";
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DashboardNameDialog({
  open,
  mode,
  value,
  onChange,
  onConfirm,
  onCancel,
}: DashboardNameDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{mode === "create" ? "New Dashboard" : "Rename Dashboard"}</DialogTitle>
      <DialogContent>
        <TextField
          // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: user just triggered create/rename
          autoFocus
          label="Dashboard name"
          fullWidth
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (value.trim()) onConfirm();
            }
            if (e.key === "Escape") onCancel();
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={onConfirm} disabled={!value.trim()}>
          {mode === "create" ? "Create" : "Rename"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
