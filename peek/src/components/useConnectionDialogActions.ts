import { useCallback, useState } from "react";

import { fetchCapabilitiesForConnection, isElasticsearchError } from "../services/es";
import type { UserCapabilities } from "../services/es";
import type { ConnectionProfile, ElasticsearchConnection } from "../types";
import type { AuthType } from "./useConnectionDialogForm";

interface Params {
  formState: {
    authType: AuthType;
    apiKey: string;
    username: string;
    password: string;
    url: string;
  };
  buildConnection: () => ElasticsearchConnection;
  connectionProfiles: ConnectionProfile[];
  saveConnectionProfile: (name: string, connection: ElasticsearchConnection) => string | null;
  lockProfile: (id: string, pin: string) => Promise<void>;
  setConnection: (connection: ElasticsearchConnection) => void;
  setConnected: (connected: boolean) => void;
  setCapabilities: (capabilities: UserCapabilities | null) => void;
  closeDialog: () => void;
}

export function useConnectionDialogActions({
  formState,
  buildConnection,
  connectionProfiles,
  saveConnectionProfile,
  lockProfile,
  setConnection,
  setConnected,
  setCapabilities,
  closeDialog,
}: Params) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [profileName, setProfileName] = useState("");
  const [savePin, setSavePin] = useState("");
  const [savePromptOpen, setSavePromptOpen] = useState(false);

  const hasCredentials =
    formState.authType === "none" ||
    (formState.authType === "apiKey"
      ? Boolean(formState.apiKey.trim())
      : Boolean(formState.username.trim() && formState.password.trim()));
  const canAttemptConnection = !testing && Boolean(formState.url.trim()) && hasCredentials;
  const isDuplicateProfileName = profileName.trim()
    ? connectionProfiles.some((profile) => profile.name === profileName.trim())
    : false;
  const canConfirmConnectAndSave =
    canAttemptConnection && Boolean(profileName.trim()) && !isDuplicateProfileName;

  const runConnectionAction = useCallback(
    async (onSuccess: (caps: UserCapabilities) => void | Promise<void>) => {
      setTesting(true);
      setResult(null);
      try {
        const caps = await fetchCapabilitiesForConnection(buildConnection());
        await onSuccess(caps);
      } catch (error: unknown) {
        const message = isElasticsearchError(error) ? error.message : String(error);
        setResult({ ok: false, message });
      } finally {
        setTesting(false);
      }
    },
    [buildConnection],
  );

  const handleConnect = useCallback(async () => {
    await runConnectionAction((caps) => {
      const connection = buildConnection();
      setConnection(connection);
      setConnected(true);
      setCapabilities(caps);
      closeDialog();
    });
  }, [
    buildConnection,
    closeDialog,
    runConnectionAction,
    setCapabilities,
    setConnected,
    setConnection,
  ]);

  const handleConnectAndSave = useCallback(async () => {
    if (!canConfirmConnectAndSave) return;
    const trimmedName = profileName.trim();
    await runConnectionAction(async (caps) => {
      const connection = buildConnection();
      const id = saveConnectionProfile(trimmedName, connection);
      if (id && savePin.trim()) await lockProfile(id, savePin.trim());
      setConnection(connection);
      setConnected(true);
      setCapabilities(caps);
      setProfileName("");
      setSavePin("");
      setSavePromptOpen(false);
      closeDialog();
    });
  }, [
    buildConnection,
    canConfirmConnectAndSave,
    closeDialog,
    lockProfile,
    profileName,
    runConnectionAction,
    saveConnectionProfile,
    savePin,
    setCapabilities,
    setConnected,
    setConnection,
  ]);

  const handleTest = useCallback(async () => {
    await runConnectionAction(() => setResult({ ok: true, message: "Connected successfully." }));
  }, [runConnectionAction]);

  const handleDisconnect = useCallback(() => {
    setConnected(false);
    setCapabilities(null);
    setResult(null);
    closeDialog();
  }, [closeDialog, setCapabilities, setConnected]);

  return {
    testing,
    result,
    setResult,
    profileName,
    setProfileName,
    savePin,
    setSavePin,
    savePromptOpen,
    setSavePromptOpen,
    isDuplicateProfileName,
    canAttemptConnection,
    canConfirmConnectAndSave,
    handleConnect,
    handleConnectAndSave,
    handleTest,
    handleDisconnect,
  };
}
