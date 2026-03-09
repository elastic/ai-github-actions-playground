import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";

interface Props {
  open: boolean;
  onClose: () => void;
  onPickDirectory: () => void;
}

export default function WorkspaceDialog({ open, onClose, onPickDirectory }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-describedby="workspace-dialog-description"
    >
      <DialogTitle>Pick a Package Workspace</DialogTitle>
      <DialogContent>
        <Typography
          id="workspace-dialog-description"
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2 }}
        >
          Choose a directory to use as your <strong>Package Workspace</strong>. All edits you make
          will be live edits within the granted workspace — files are written directly to the folder
          you select, and every change is saved automatically in real time.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" startIcon={<FolderOpenIcon />} onClick={onPickDirectory}>
          Choose Directory
        </Button>
      </DialogActions>
    </Dialog>
  );
}
