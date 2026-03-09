import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import { deriveOtlpEndpoint } from "../utils/addDataUtils";
import type { ConnectionProfile } from "../types";

import ConnectionProfilesList from "./ConnectionProfilesList";
import type { AuthType } from "./useConnectionDialogForm";

interface ConnectionDialogFormProps {
  authType: AuthType;
  url: string;
  apiKey: string;
  username: string;
  password: string;
  proxyUrl: string;
  ingestUrl: string;
  showAdvanced: boolean;
  showSecret: boolean;
  likelyServerless: boolean;
  connectionProfiles: ConnectionProfile[];
  activeProfileId: string | null;
  result: { ok: boolean; message: string } | null;
  savePromptOpen: boolean;
  profileName: string;
  savePin: string;
  testing: boolean;
  isDuplicateProfileName: boolean;
  canConfirmConnectAndSave: boolean;
  onLoadProfile: (profileId: string) => void;
  onDeleteProfile: (profileId: string) => void;
  onRenameProfile: (profileId: string, newName: string) => void;
  onUnlockProfile: (profileId: string, pin: string) => Promise<boolean>;
  onUrlChange: (value: string) => void;
  onAuthTypeChange: (value: AuthType) => void;
  onApiKeyChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onProxyUrlChange: (value: string) => void;
  onIngestUrlChange: (value: string) => void;
  onToggleShowSecret: () => void;
  onToggleAdvanced: () => void;
  onProfileNameChange: (value: string) => void;
  onSavePinChange: (value: string) => void;
  onCancelSave: () => void;
  onConfirmConnectAndSave: () => Promise<void>;
}

export default function ConnectionDialogForm({
  authType,
  url,
  apiKey,
  username,
  password,
  proxyUrl,
  ingestUrl,
  showAdvanced,
  showSecret,
  likelyServerless,
  connectionProfiles,
  activeProfileId,
  result,
  savePromptOpen,
  profileName,
  savePin,
  testing,
  isDuplicateProfileName,
  canConfirmConnectAndSave,
  onLoadProfile,
  onDeleteProfile,
  onRenameProfile,
  onUnlockProfile,
  onUrlChange,
  onAuthTypeChange,
  onApiKeyChange,
  onUsernameChange,
  onPasswordChange,
  onProxyUrlChange,
  onIngestUrlChange,
  onToggleShowSecret,
  onToggleAdvanced,
  onProfileNameChange,
  onSavePinChange,
  onCancelSave,
  onConfirmConnectAndSave,
}: ConnectionDialogFormProps) {
  return (
    <Box
      component="form"
      onSubmit={(e: React.FormEvent) => e.preventDefault()}
      autoComplete="on"
      sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
    >
      <Typography variant="caption" color="text.secondary">
        Enter your endpoint and credentials. Connections are direct from the browser unless a proxy
        URL is configured.
      </Typography>
      {likelyServerless && (
        <Alert severity="warning" sx={{ py: 0 }}>
          This endpoint looks like Elasticsearch Serverless (<code>*.elastic.cloud</code>). Direct
          browser access typically fails because required CORS settings are unavailable.
        </Alert>
      )}

      <ConnectionProfilesList
        connectionProfiles={connectionProfiles}
        activeProfileId={activeProfileId}
        onLoadProfile={onLoadProfile}
        onDeleteProfile={onDeleteProfile}
        onRenameProfile={onRenameProfile}
        unlockProfile={onUnlockProfile}
      />

      <TextField
        label="Elasticsearch URL"
        placeholder="https://my-cluster.es.us-east-1.aws.elastic.cloud:443"
        fullWidth
        value={url}
        onChange={(event) => onUrlChange(event.target.value)}
        helperText="The full URL including protocol and port"
      />
      <Tabs value={authType} onChange={(_, value: AuthType) => onAuthTypeChange(value)}>
        <Tab label="API Key" value="apiKey" />
        <Tab label="Username / Password" value="userpass" />
        <Tab label="No Auth" value="none" />
      </Tabs>
      {authType === "apiKey" && (
        <TextField
          label="API Key"
          placeholder="base64-encoded API key"
          fullWidth
          type={showSecret ? "text" : "password"}
          value={apiKey}
          onChange={(event) => onApiKeyChange(event.target.value)}
          helperText="In browser mode, credentials are stored in session storage and cleared when the tab closes; in Electron, credentials are stored in the OS credential store."
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label={showSecret ? "Hide credentials" : "Show credentials"}
                    onClick={onToggleShowSecret}
                  >
                    {showSecret ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      )}
      {authType === "userpass" && (
        <>
          <TextField
            label="Username"
            fullWidth
            autoComplete="username"
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
          />
          <TextField
            label="Password"
            fullWidth
            autoComplete="current-password"
            type={showSecret ? "text" : "password"}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            helperText="In browser mode, credentials are stored in session storage and cleared when the tab closes; in Electron, credentials are stored in the OS credential store."
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      aria-label={showSecret ? "Hide credentials" : "Show credentials"}
                      onClick={onToggleShowSecret}
                    >
                      {showSecret ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </>
      )}
      <Button
        size="small"
        onClick={onToggleAdvanced}
        endIcon={showAdvanced ? <ExpandLess /> : <ExpandMore />}
        sx={{ alignSelf: "flex-start" }}
      >
        Advanced Connection Settings
      </Button>
      <Collapse in={showAdvanced} unmountOnExit>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <TextField
            label="Proxy URL"
            placeholder="http://localhost:3000/_es"
            fullWidth
            value={proxyUrl}
            onChange={(event) => onProxyUrlChange(event.target.value)}
            helperText="Requests are sent to this URL; the Elasticsearch URL is forwarded as a header."
          />
          <TextField
            label="Ingest URL"
            placeholder={deriveIngestPlaceholder(url)}
            fullWidth
            value={ingestUrl}
            onChange={(event) => onIngestUrlChange(event.target.value)}
            helperText="Override OTLP ingest base URL (optional). Browser Tracing settings are now in Settings."
          />
        </Box>
      </Collapse>
      {result && <Alert severity={result.ok ? "success" : "error"}>{result.message}</Alert>}

      <Collapse in={savePromptOpen} unmountOnExit>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <TextField
            size="small"
            label="Profile name"
            placeholder="e.g. Production"
            value={profileName}
            onChange={(event) => onProfileNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void onConfirmConnectAndSave();
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
            onChange={(event) => onSavePinChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void onConfirmConnectAndSave();
            }}
            helperText={
              savePin.trim()
                ? "Credentials will be encrypted and stored locally."
                : "Leave blank to keep credentials in session storage."
            }
          />
          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
            <Button size="small" onClick={onCancelSave} disabled={testing}>
              Cancel Save
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => void onConfirmConnectAndSave()}
              disabled={!canConfirmConnectAndSave}
              aria-label={testing ? "Confirm Connect & Save" : undefined}
            >
              {testing ? <CircularProgress size={18} /> : "Confirm Connect & Save"}
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}

function deriveIngestPlaceholder(url: string): string {
  return deriveOtlpEndpoint(url) || "https://<id>.ingest.<region>.<provider>.elastic.cloud";
}
