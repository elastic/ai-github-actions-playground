import { useCallback, useState } from "react";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

interface DashboardDetailsDialogProps {
  open: boolean;
  description: string;
  tags: string[];
  onConfirm: (details: { description: string; tags: string[] }) => void;
  onCancel: () => void;
}

export default function DashboardDetailsDialog({
  open,
  description,
  tags,
  onConfirm,
  onCancel,
}: DashboardDetailsDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      {open && (
        <DashboardDetailsForm
          description={description}
          tags={tags}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </Dialog>
  );
}

function DashboardDetailsForm({
  description,
  tags,
  onConfirm,
  onCancel,
}: Omit<DashboardDetailsDialogProps, "open">) {
  const [localDescription, setLocalDescription] = useState(description);
  const [localTags, setLocalTags] = useState<string[]>(tags);
  const [tagInput, setTagInput] = useState("");

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    setLocalTags((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setTagInput("");
  }, [tagInput]);

  const handleRemoveTag = useCallback((tag: string) => {
    setLocalTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm({ description: localDescription, tags: localTags });
  }, [localDescription, localTags, onConfirm]);

  return (
    <>
      <DialogTitle>Edit Dashboard Details</DialogTitle>
      <DialogContent>
        <TextField
          // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: user just triggered edit details
          autoFocus
          label="Description"
          fullWidth
          multiline
          minRows={2}
          maxRows={4}
          value={localDescription}
          onChange={(e) => setLocalDescription(e.target.value)}
          sx={{ mt: 1 }}
        />
        <TextField
          label="Add tag"
          fullWidth
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddTag();
            }
          }}
          helperText="Press Enter to add a tag"
          sx={{ mt: 2 }}
        />
        {localTags.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            {localTags.map((tag) => (
              <Chip key={tag} label={tag} size="small" onDelete={() => handleRemoveTag(tag)} />
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm}>
          Save
        </Button>
      </DialogActions>
    </>
  );
}
