import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import type { ExtractMethod } from "./logsUtils";

interface ExtractFieldsDialogProps {
  open: boolean;
  onClose: () => void;
  extractMethod: ExtractMethod;
  onExtractMethodChange: (method: ExtractMethod) => void;
  extractPattern: string;
  onExtractPatternChange: (pattern: string) => void;
  extractSource: string;
  onApply: () => void;
}

export default function ExtractFieldsDialog({
  open,
  onClose,
  extractMethod,
  onExtractMethodChange,
  extractPattern,
  onExtractPatternChange,
  extractSource,
  onApply,
}: ExtractFieldsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Extract fields from message</DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary">
          Selected message: {extractSource.slice(0, 240)}
        </Typography>
        <FormControl fullWidth size="small" sx={{ mt: 1 }}>
          <InputLabel id="logs-extract-method-label">Method</InputLabel>
          <Select
            labelId="logs-extract-method-label"
            label="Method"
            value={extractMethod}
            onChange={(event) => {
              const method = event.target.value as ExtractMethod;
              onExtractMethodChange(method);
              onExtractPatternChange(
                method === "DISSECT" ? "%{extracted.value}" : "%{GREEDYDATA:extracted.value}",
              );
            }}
          >
            <MenuItem value="DISSECT">DISSECT</MenuItem>
            <MenuItem value="GROK">GROK</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          fullWidth
          label="Extraction pattern"
          sx={{ mt: 1 }}
          value={extractPattern}
          onChange={(event) => onExtractPatternChange(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose}>
          Cancel
        </Button>
        <Button size="small" variant="contained" onClick={onApply}>
          Apply {extractMethod}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
