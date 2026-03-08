import { useCallback } from "react";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { useShallow } from "zustand/react/shallow";

import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";

import ConnectionDialogForm from "./ConnectionDialogForm";
import { useConnectionDialogActions } from "./useConnectionDialogActions";
import {
  isLikelyServerlessUrl,
  useConnectionDialogForm,
  type AuthType,
} from "./useConnectionDialogForm";

export default function ConnectionDialog() {
  const { connectionDialogOpen: open, setConnectionDialogOpen: setOpen } = useUIStore(
    useShallow((s) => ({
      connectionDialogOpen: s.connectionDialogOpen,
      setConnectionDialogOpen: s.setConnectionDialogOpen,
    })),
  );
  const {
    connection: savedConn,
    connected,
    setConnection,
    setConnected,
    setCapabilities,
    connectionProfiles,
    activeProfileId,
    saveConnectionProfile,
    deleteConnectionProfile,
    renameConnectionProfile,
    setActiveProfileId,
    getConnectionProfile,
    lockProfile,
    unlockProfile,
  } = useConnectionStore(
    useShallow((s) => ({
      connection: s.connection,
      connected: s.connected,
      setConnection: s.setConnection,
      setConnected: s.setConnected,
      setCapabilities: s.setCapabilities,
      connectionProfiles: s.connectionProfiles,
      activeProfileId: s.activeProfileId,
      saveConnectionProfile: s.saveConnectionProfile,
      deleteConnectionProfile: s.deleteConnectionProfile,
      renameConnectionProfile: s.renameConnectionProfile,
      setActiveProfileId: s.setActiveProfileId,
      getConnectionProfile: s.getConnectionProfile,
      lockProfile: s.lockProfile,
      unlockProfile: s.unlockProfile,
    })),
  );

  const form = useConnectionDialogForm(savedConn, () => setActiveProfileId(null));
  const actions = useConnectionDialogActions({
    formState: form.form,
    buildConnection: form.buildConnection,
    connectionProfiles,
    saveConnectionProfile,
    deleteConnectionProfile,
    lockProfile,
    setConnection,
    setConnected,
    setCapabilities,
    closeDialog: () => setOpen(false),
  });

  /** Wrap a form setter so any connection-affecting edit clears a stale test result. */
  const clearResultAnd = useCallback(
    <T,>(fn: (value: T) => void) =>
      (value: T) => {
        fn(value);
        actions.setResult(null);
      },
    [actions],
  );

  const handleAuthTypeChange = useCallback(
    (nextAuthType: AuthType) => {
      form.updateAuthType(nextAuthType);
      actions.setResult(null);
    },
    [actions, form],
  );

  const handleLoadProfile = useCallback(
    (profileId: string) => {
      const profile = getConnectionProfile(profileId);
      if (!profile) return;
      form.setHydratedConnection(profile.connection);
      setActiveProfileId(profileId);
      actions.setResult(null);
    },
    [actions, form, getConnectionProfile, setActiveProfileId],
  );

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Elasticsearch Connection</DialogTitle>
      <DialogContent>
        <ConnectionDialogForm
          authType={form.form.authType}
          url={form.form.url}
          apiKey={form.form.apiKey}
          username={form.form.username}
          password={form.form.password}
          proxyUrl={form.form.proxyUrl}
          ingestUrl={form.form.ingestUrl}
          showAdvanced={form.form.showAdvanced}
          showSecret={form.form.showSecret}
          likelyServerless={isLikelyServerlessUrl(form.form.url)}
          connectionProfiles={connectionProfiles}
          activeProfileId={activeProfileId}
          result={actions.result}
          savePromptOpen={actions.savePromptOpen}
          profileName={actions.profileName}
          savePin={actions.savePin}
          testing={actions.testing}
          isDuplicateProfileName={actions.isDuplicateProfileName}
          canConfirmConnectAndSave={actions.canConfirmConnectAndSave}
          onLoadProfile={handleLoadProfile}
          onDeleteProfile={deleteConnectionProfile}
          onRenameProfile={renameConnectionProfile}
          onUnlockProfile={unlockProfile}
          onUrlChange={clearResultAnd(form.updateUrl)}
          onAuthTypeChange={handleAuthTypeChange}
          onApiKeyChange={clearResultAnd(form.setApiKey)}
          onUsernameChange={clearResultAnd(form.setUsername)}
          onPasswordChange={clearResultAnd(form.setPassword)}
          onProxyUrlChange={clearResultAnd(form.setProxyUrl)}
          onIngestUrlChange={clearResultAnd(form.setIngestUrl)}
          onToggleShowSecret={() => form.setShowSecret(!form.form.showSecret)}
          onToggleAdvanced={() => form.setShowAdvanced(!form.form.showAdvanced)}
          onProfileNameChange={actions.setProfileName}
          onSavePinChange={actions.setSavePin}
          onCancelSave={() => {
            actions.setSavePromptOpen(false);
            actions.setProfileName("");
            actions.setSavePin("");
          }}
          onConfirmConnectAndSave={actions.handleConnectAndSave}
        />
      </DialogContent>
      <DialogActions disableSpacing sx={{ flexWrap: "wrap", gap: 1, pb: 2, px: 3 }}>
        {connected && (
          <Button onClick={actions.handleDisconnect} color="warning" disabled={actions.testing}>
            Disconnect
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => setOpen(false)}>Cancel</Button>
        <Button onClick={() => void actions.handleTest()} disabled={!actions.canAttemptConnection}>
          {actions.testing ? <CircularProgress size={20} /> : "Test"}
        </Button>
        <Button
          variant="outlined"
          onClick={() => actions.setSavePromptOpen((value) => !value)}
          disabled={!actions.canAttemptConnection}
        >
          Connect & Save
        </Button>
        <Button
          variant="contained"
          onClick={() => void actions.handleConnect()}
          disabled={!actions.canAttemptConnection}
        >
          {actions.testing ? <CircularProgress size={20} /> : "Connect"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
