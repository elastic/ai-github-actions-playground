import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { useConnectionForm } from "../hooks/useConnectionForm";

import ConnectionProfilesList from "./ConnectionProfilesList";
import ConnectionAuthFields from "./ConnectionAuthFields";
import ConnectionAdvancedSettings from "./ConnectionAdvancedSettings";
import ConnectionSavePrompt from "./ConnectionSavePrompt";

export default function ConnectionDialog() {
  const {
    open,
    setOpen,
    connected,
    connectionProfiles,
    activeProfileId,
    deleteConnectionProfile,
    unlockProfile,
    url,
    authType,
    apiKey,
    setApiKey,
    username,
    setUsername,
    password,
    setPassword,
    proxyUrl,
    setProxyUrl,
    ingestUrl,
    setIngestUrl,
    showAdvanced,
    setShowAdvanced,
    showSecret,
    setShowSecret,
    testing,
    result,
    profileName,
    setProfileName,
    savePin,
    setSavePin,
    savePromptOpen,
    setSavePromptOpen,
    isDuplicateProfileName,
    canAttemptConnection,
    canConfirmConnectAndSave,
    likelyServerless,
    setActiveProfileId,
    handleTest,
    handleConnect,
    handleDisconnect,
    handleConnectAndSave,
    handleLoadProfile,
    handleRenameProfile,
    handleUrlChange,
    handleAuthTypeChange,
  } = useConnectionForm();

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Elasticsearch Connection</DialogTitle>
      <DialogContent>
        <Box
          component="form"
          onSubmit={(e: React.FormEvent) => e.preventDefault()}
          autoComplete="on"
          sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
        >
          <Typography variant="caption" color="text.secondary">
            Enter your endpoint and credentials. Connections are direct from the browser unless a
            proxy URL is configured.
          </Typography>
          {likelyServerless && (
            <Alert severity="warning" sx={{ py: 0 }}>
              This endpoint looks like Elasticsearch Serverless (<code>*.elastic.cloud</code>).
              Direct browser access typically fails because required CORS settings are unavailable.
            </Alert>
          )}

          <ConnectionProfilesList
            connectionProfiles={connectionProfiles}
            activeProfileId={activeProfileId}
            onLoadProfile={handleLoadProfile}
            onDeleteProfile={deleteConnectionProfile}
            onRenameProfile={handleRenameProfile}
            unlockProfile={unlockProfile}
          />

          <TextField
            label="Elasticsearch URL"
            placeholder="https://my-cluster.es.us-east-1.aws.elastic.cloud:443"
            fullWidth
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            helperText="The full URL including protocol and port"
          />
          <ConnectionAuthFields
            authType={authType}
            onAuthTypeChange={handleAuthTypeChange}
            apiKey={apiKey}
            onApiKeyChange={(v) => {
              setApiKey(v);
              setActiveProfileId(null);
            }}
            username={username}
            onUsernameChange={(v) => {
              setUsername(v);
              setActiveProfileId(null);
            }}
            password={password}
            onPasswordChange={(v) => {
              setPassword(v);
              setActiveProfileId(null);
            }}
            showSecret={showSecret}
            onToggleShowSecret={() => setShowSecret(!showSecret)}
          />
          <ConnectionAdvancedSettings
            showAdvanced={showAdvanced}
            onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
            proxyUrl={proxyUrl}
            onProxyUrlChange={(v) => {
              setProxyUrl(v);
              setActiveProfileId(null);
            }}
            ingestUrl={ingestUrl}
            onIngestUrlChange={(v) => {
              setIngestUrl(v);
              setActiveProfileId(null);
            }}
            url={url}
          />
          {result && <Alert severity={result.ok ? "success" : "error"}>{result.message}</Alert>}
          <ConnectionSavePrompt
            open={savePromptOpen}
            profileName={profileName}
            onProfileNameChange={setProfileName}
            savePin={savePin}
            onSavePinChange={setSavePin}
            isDuplicateProfileName={isDuplicateProfileName}
            testing={testing}
            canConfirmConnectAndSave={canConfirmConnectAndSave}
            onConnectAndSave={() => void handleConnectAndSave()}
            onCancel={() => {
              setSavePromptOpen(false);
              setProfileName("");
              setSavePin("");
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions disableSpacing sx={{ flexWrap: "wrap", gap: 1, pb: 2, px: 3 }}>
        {connected && (
          <Button onClick={handleDisconnect} color="warning" disabled={testing}>
            Disconnect
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => setOpen(false)}>Cancel</Button>
        <Button onClick={handleTest} disabled={!canAttemptConnection}>
          {testing ? <CircularProgress size={20} /> : "Test"}
        </Button>
        <Button
          variant="outlined"
          onClick={() => setSavePromptOpen((v) => !v)}
          disabled={!canAttemptConnection}
        >
          Connect & Save
        </Button>
        <Button variant="contained" onClick={handleConnect} disabled={!canAttemptConnection}>
          {testing ? <CircularProgress size={20} /> : "Connect"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
