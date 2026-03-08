import { useState, useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { fetchCapabilitiesForConnection, isElasticsearchError } from "../services/es";
import { deriveDefaultOtlpEndpoint } from "../services/telemetry/browserTracing";
import { deriveOtlpEndpoint } from "../utils/addDataUtils";
import type { ElasticsearchConnection } from "../types";

export type AuthType = "apiKey" | "userpass" | "none";

export function deriveAuthType(
  conn: Pick<ElasticsearchConnection, "username" | "apiKey"> | null | undefined,
): AuthType {
  if (conn?.username) return "userpass";
  if (conn?.apiKey) return "apiKey";
  return conn ? "none" : "apiKey";
}

export function deriveIngestUrlOrEmpty(url: string | undefined): string {
  return deriveOtlpEndpoint(url ?? "") ?? "";
}

export function isLikelyServerlessUrl(rawUrl: string): boolean {
  try {
    const hostname = new URL(rawUrl.trim()).hostname.toLowerCase();
    return hostname.endsWith(".elastic.cloud") || hostname === "elastic.cloud";
  } catch {
    return false;
  }
}

export function useConnectionForm() {
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

  const [url, setUrl] = useState(savedConn?.url ?? "");
  const [authType, setAuthType] = useState<AuthType>(deriveAuthType(savedConn));
  const [apiKey, setApiKey] = useState(savedConn?.apiKey ?? "");
  const [username, setUsername] = useState(savedConn?.username ?? "");
  const [password, setPassword] = useState(savedConn?.password ?? "");
  const [proxyUrl, setProxyUrl] = useState(savedConn?.proxyUrl ?? "");
  const [ingestUrl, setIngestUrl] = useState(
    savedConn?.ingestUrl ?? deriveIngestUrlOrEmpty(savedConn?.url),
  );
  const [showAdvanced, setShowAdvanced] = useState(Boolean(savedConn?.ingestUrl));
  const [otlpEnabled, setOtlpEnabled] = useState(savedConn?.otlpEnabled ?? false);
  const [otlpEndpoint, setOtlpEndpoint] = useState(
    savedConn?.otlpEndpoint ?? deriveDefaultOtlpEndpoint(savedConn?.url ?? ""),
  );
  const [otlpUseElasticAuth, setOtlpUseElasticAuth] = useState(
    savedConn?.otlpUseElasticAuth ?? Boolean(savedConn?.apiKey),
  );
  const [otlpApiKey, setOtlpApiKey] = useState(savedConn?.otlpApiKey ?? "");
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [profileName, setProfileName] = useState("");
  const [savePin, setSavePin] = useState("");
  const [savePromptOpen, setSavePromptOpen] = useState(false);

  useEffect(() => {
    setUrl(savedConn?.url ?? "");
    setAuthType(deriveAuthType(savedConn));
    setApiKey(savedConn?.apiKey ?? "");
    setUsername(savedConn?.username ?? "");
    setPassword(savedConn?.password ?? "");
    setProxyUrl(savedConn?.proxyUrl ?? "");
    setIngestUrl(savedConn?.ingestUrl ?? deriveIngestUrlOrEmpty(savedConn?.url));
    setShowAdvanced(Boolean(savedConn?.ingestUrl));
    setOtlpEnabled(savedConn?.otlpEnabled ?? false);
    setOtlpEndpoint(savedConn?.otlpEndpoint ?? deriveDefaultOtlpEndpoint(savedConn?.url ?? ""));
    setOtlpUseElasticAuth(savedConn?.otlpUseElasticAuth ?? Boolean(savedConn?.apiKey));
    setOtlpApiKey(savedConn?.otlpApiKey ?? "");
  }, [savedConn]);

  useEffect(() => {
    if (authType !== "apiKey" && otlpUseElasticAuth) {
      setOtlpUseElasticAuth(false);
    }
  }, [authType, otlpUseElasticAuth]);

  const buildConnection = useCallback((): ElasticsearchConnection => {
    const nextOtlpUseElasticAuth = authType === "apiKey" && otlpUseElasticAuth;
    const trimmedIngestUrl = ingestUrl.trim();
    const derived = deriveIngestUrlOrEmpty(url.trim());
    // Only persist ingestUrl when it differs from what we would auto-derive
    const effectiveIngestUrl =
      trimmedIngestUrl && trimmedIngestUrl !== derived ? trimmedIngestUrl : undefined;
    if (authType === "userpass") {
      return {
        url: url.trim(),
        username: username.trim(),
        password: password.trim(),
        proxyUrl: proxyUrl.trim(),
        ingestUrl: effectiveIngestUrl,
        otlpEnabled,
        otlpEndpoint: otlpEndpoint.trim(),
        otlpUseElasticAuth: nextOtlpUseElasticAuth,
        otlpApiKey: otlpApiKey.trim(),
      };
    }
    if (authType === "none") {
      return {
        url: url.trim(),
        proxyUrl: proxyUrl.trim(),
        ingestUrl: effectiveIngestUrl,
        otlpEnabled,
        otlpEndpoint: otlpEndpoint.trim(),
        otlpUseElasticAuth: false,
        otlpApiKey: "",
      };
    }
    return {
      url: url.trim(),
      apiKey: apiKey.trim(),
      proxyUrl: proxyUrl.trim(),
      ingestUrl: effectiveIngestUrl,
      otlpEnabled,
      otlpEndpoint: otlpEndpoint.trim(),
      otlpUseElasticAuth: nextOtlpUseElasticAuth,
      otlpApiKey: otlpApiKey.trim(),
    };
  }, [
    url,
    authType,
    apiKey,
    username,
    password,
    proxyUrl,
    ingestUrl,
    otlpEnabled,
    otlpEndpoint,
    otlpUseElasticAuth,
    otlpApiKey,
  ]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setResult(null);
    const conn = buildConnection();
    try {
      await fetchCapabilitiesForConnection(conn);
      setResult({ ok: true, message: "Connected successfully." });
    } catch (err: unknown) {
      const message = isElasticsearchError(err) ? err.message : String(err);
      setResult({ ok: false, message });
    } finally {
      setTesting(false);
    }
  }, [buildConnection]);

  const handleConnect = useCallback(async () => {
    const conn = buildConnection();
    setTesting(true);
    setResult(null);
    try {
      const caps = await fetchCapabilitiesForConnection(conn);
      setConnection(conn);
      setConnected(true);
      setCapabilities(caps);
      setOpen(false);
    } catch (err: unknown) {
      const message = isElasticsearchError(err) ? err.message : String(err);
      setResult({ ok: false, message });
    } finally {
      setTesting(false);
    }
  }, [buildConnection, setConnection, setConnected, setCapabilities, setOpen]);

  const handleDisconnect = useCallback(() => {
    setConnected(false);
    setCapabilities(null);
    setResult(null);
    setOpen(false);
  }, [setConnected, setCapabilities, setOpen]);

  const isDuplicateProfileName = profileName.trim()
    ? connectionProfiles.some((p) => p.name === profileName.trim())
    : false;
  const hasCredentials =
    authType === "none" ||
    (authType === "apiKey" ? Boolean(apiKey.trim()) : Boolean(username.trim() && password.trim()));
  const hasUrl = Boolean(url.trim());
  const canAttemptConnection = !testing && hasUrl && hasCredentials;
  const canConfirmConnectAndSave =
    canAttemptConnection && Boolean(profileName.trim()) && !isDuplicateProfileName;
  const likelyServerless = isLikelyServerlessUrl(url);

  const handleConnectAndSave = useCallback(async () => {
    const trimmed = profileName.trim();
    if (!canConfirmConnectAndSave) return;
    const conn = buildConnection();
    setTesting(true);
    setResult(null);
    try {
      const caps = await fetchCapabilitiesForConnection(conn);
      const id = saveConnectionProfile(trimmed, conn);
      if (id && savePin.trim()) {
        await lockProfile(id, savePin.trim());
      }
      setConnection(conn);
      setConnected(true);
      setCapabilities(caps);
      setProfileName("");
      setSavePin("");
      setSavePromptOpen(false);
      setOpen(false);
    } catch (err: unknown) {
      const message = isElasticsearchError(err) ? err.message : String(err);
      setResult({ ok: false, message });
    } finally {
      setTesting(false);
    }
  }, [
    profileName,
    canConfirmConnectAndSave,
    buildConnection,
    saveConnectionProfile,
    savePin,
    lockProfile,
    setConnection,
    setConnected,
    setCapabilities,
    setOpen,
  ]);

  const handleLoadProfile = useCallback(
    (profileId: string) => {
      const profile = getConnectionProfile(profileId);
      if (!profile) return;
      const conn = profile.connection;
      setUrl(conn.url);
      setAuthType(deriveAuthType(conn));
      setApiKey(conn.apiKey ?? "");
      setUsername(conn.username ?? "");
      setPassword(conn.password ?? "");
      setProxyUrl(conn.proxyUrl ?? "");
      setIngestUrl(conn.ingestUrl ?? deriveIngestUrlOrEmpty(conn.url));
      setShowAdvanced(Boolean(conn.ingestUrl));
      setOtlpEnabled(conn.otlpEnabled ?? false);
      setOtlpEndpoint(conn.otlpEndpoint ?? deriveDefaultOtlpEndpoint(conn.url));
      setOtlpUseElasticAuth(conn.otlpUseElasticAuth ?? Boolean(conn.apiKey));
      setOtlpApiKey(conn.otlpApiKey ?? "");
      setActiveProfileId(profileId);
      setResult(null);
    },
    [getConnectionProfile, setActiveProfileId],
  );

  const handleRenameProfile = useCallback(
    (id: string, newName: string) => {
      renameConnectionProfile(id, newName);
    },
    [renameConnectionProfile],
  );

  const handleUrlChange = useCallback(
    (nextUrl: string) => {
      const previousDerived = deriveDefaultOtlpEndpoint(url);
      const previousIngestDerived = deriveIngestUrlOrEmpty(url);
      setUrl(nextUrl);
      setActiveProfileId(null);
      setOtlpEndpoint((prev) => {
        const trimmed = prev.trim();
        if (!trimmed || trimmed === previousDerived) {
          return deriveDefaultOtlpEndpoint(nextUrl);
        }
        return prev;
      });
      setIngestUrl((prev) => {
        const trimmed = prev.trim();
        if (!trimmed || trimmed === previousIngestDerived) {
          return deriveIngestUrlOrEmpty(nextUrl);
        }
        return prev;
      });
    },
    [url, setActiveProfileId],
  );

  const handleAuthTypeChange = useCallback(
    (v: AuthType) => {
      setAuthType(v);
      setActiveProfileId(null);
      setResult(null);
    },
    [setActiveProfileId],
  );

  return {
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
  };
}
