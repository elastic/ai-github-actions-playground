import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import CircularProgress from "@mui/material/CircularProgress";

interface ConnectionSavePromptProps {
  open: boolean;
  profileName: string;
  onProfileNameChange: (v: string) => void;
  savePin: string;
  onSavePinChange: (v: string) => void;
  isDuplicateProfileName: boolean;
  testing: boolean;
  canConfirmConnectAndSave: boolean;
  onConnectAndSave: () => void;
  onCancel: () => void;
}

export default function ConnectionSavePrompt({
  open,
  profileName,
  onProfileNameChange,
  savePin,
  onSavePinChange,
  isDuplicateProfileName,
  testing,
  canConfirmConnectAndSave,
  onConnectAndSave,
  onCancel,
}: ConnectionSavePromptProps) {
  return (
    <Collapse in={open} unmountOnExit>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <TextField
          size="small"
          label="Profile name"
          placeholder="e.g. Production"
          value={profileName}
          onChange={(e) => onProfileNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onConnectAndSave();
          }}
          error={isDuplicateProfileName}
          helperText={isDuplicateProfileName ? "A profile with this name already exists" : " "}
        />
        <TextField
          size="small"
          label="PIN (optional)"
          type="password"
          placeholder="Encrypt credentials with PIN"
          value={savePin}
          onChange={(e) => onSavePinChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onConnectAndSave();
          }}
          helperText={
            savePin.trim()
              ? "Credentials will be encrypted and stored locally."
              : "Leave blank to keep credentials in session storage."
          }
        />
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button size="small" onClick={onCancel} disabled={testing}>
            Cancel Save
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={onConnectAndSave}
            disabled={!canConfirmConnectAndSave}
          >
            {testing ? <CircularProgress size={18} /> : "Confirm Connect & Save"}
          </Button>
        </Box>
      </Box>
    </Collapse>
  );
}
