import { useState, useCallback, useEffect } from "react";
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
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Collapse from "@mui/material/Collapse";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ExpandLess from "@mui/icons-material/ExpandLess";
import { useShallow } from "zustand/react/shallow";

import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { fetchCapabilitiesForConnection, isElasticsearchError } from "../services/es";
import { deriveDefaultOtlpEndpoint } from "../services/telemetry/browserTracing";
import { deriveOtlpEndpoint } from "../utils/addDataUtils";
import type { ElasticsearchConnection } from "../types";

import ConnectionProfilesList from "./ConnectionProfilesList";
import OtlpConfigPanel from "./OtlpConfigPanel";

type AuthType = "apiKey" | "userpass";

function deriveIngestUrlOrEmpty(url: string | undefined): string {
  return deriveOtlpEndpoint(url ?? "") ?? "";
}

function shouldShowTelemetryPanel(conn?: ElasticsearchConnection | null): boolean {
  if (!conn) return false;
  if (conn.otlpEnabled || Boolean(conn.otlpApiKey?.trim())) return true;
  const endpoint = conn.otlpEndpoint?.trim();
  if (!endpoint) return false;
  return endpoint !== deriveDefaultOtlpEndpoint(conn.url);
}

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

  const initialAuthType: AuthType = savedConn?.username ? "userpass" : "apiKey";

  const [url, setUrl] = useState(savedConn?.url ?? "");
  const [authType, setAuthType] = useState<AuthType>(initialAuthType);
  const [apiKey, setApiKey] = useState(savedConn?.apiKey ?? "");
  const [username, setUsername] = useState(savedConn?.username ?? "");
  const [password, setPassword] = useState(savedConn?.password ?? "");
  const [proxyUrl, setProxyUrl] = useState(savedConn?.proxyUrl ?? "");
  const [ingestUrl, setIngestUrl] = useState(
    savedConn?.ingestUrl ?? deriveIngestUrlOrEmpty(savedConn?.url),
  );
  const [showProxy, setShowProxy] = useState(Boolean(savedConn?.proxyUrl));
  const [showAdvanced, setShowAdvanced] = useState(Boolean(savedConn?.ingestUrl));
  const [otlpEnabled, setOtlpEnabled] = useState(savedConn?.otlpEnabled ?? false);
  const [otlpEndpoint, setOtlpEndpoint] = useState(
    savedConn?.otlpEndpoint ?? deriveDefaultOtlpEndpoint(savedConn?.url ?? ""),
  );
  const [otlpUseElasticAuth, setOtlpUseElasticAuth] = useState(
    savedConn?.otlpUseElasticAuth ?? Boolean(savedConn?.apiKey),
  );
  const [otlpApiKey, setOtlpApiKey] = useState(savedConn?.otlpApiKey ?? "");
  const [showTelemetry, setShowTelemetry] = useState(shouldShowTelemetryPanel(savedConn));
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [profileName, setProfileName] = useState("");
  const [savePin, setSavePin] = useState("");

  useEffect(() => {
    setUrl(savedConn?.url ?? "");
    setAuthType(savedConn?.username ? "userpass" : "apiKey");
    setApiKey(savedConn?.apiKey ?? "");
    setUsername(savedConn?.username ?? "");
    setPassword(savedConn?.password ?? "");
    setProxyUrl(savedConn?.proxyUrl ?? "");
    setIngestUrl(savedConn?.ingestUrl ?? deriveIngestUrlOrEmpty(savedConn?.url));
    setShowProxy(Boolean(savedConn?.proxyUrl));
    setShowAdvanced(Boolean(savedConn?.ingestUrl));
    setOtlpEnabled(savedConn?.otlpEnabled ?? false);
    setOtlpEndpoint(savedConn?.otlpEndpoint ?? deriveDefaultOtlpEndpoint(savedConn?.url ?? ""));
    setOtlpUseElasticAuth(savedConn?.otlpUseElasticAuth ?? Boolean(savedConn?.apiKey));
    setOtlpApiKey(savedConn?.otlpApiKey ?? "");
    setShowTelemetry(shouldShowTelemetryPanel(savedConn));
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

  const handleSaveProfile = useCallback(async () => {
    const trimmed = profileName.trim();
    if (!trimmed) return;
    const id = saveConnectionProfile(trimmed, buildConnection());
    if (id) {
      if (savePin.trim()) {
        await lockProfile(id, savePin.trim());
      }
      setProfileName("");
      setSavePin("");
    }
  }, [profileName, savePin, saveConnectionProfile, buildConnection, lockProfile]);

  const handleLoadProfile = useCallback(
    (profileId: string) => {
      const profile = getConnectionProfile(profileId);
      if (!profile) return;
      const conn = profile.connection;
      setUrl(conn.url);
      setAuthType(conn.username ? "userpass" : "apiKey");
      setApiKey(conn.apiKey ?? "");
      setUsername(conn.username ?? "");
      setPassword(conn.password ?? "");
      setProxyUrl(conn.proxyUrl ?? "");
      setIngestUrl(conn.ingestUrl ?? deriveIngestUrlOrEmpty(conn.url));
      setShowProxy(Boolean(conn.proxyUrl));
      setShowAdvanced(Boolean(conn.ingestUrl));
      setOtlpEnabled(conn.otlpEnabled ?? false);
      setOtlpEndpoint(conn.otlpEndpoint ?? deriveDefaultOtlpEndpoint(conn.url));
      setOtlpUseElasticAuth(conn.otlpUseElasticAuth ?? Boolean(conn.apiKey));
      setOtlpApiKey(conn.otlpApiKey ?? "");
      setShowTelemetry(shouldShowTelemetryPanel(conn));
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

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Elasticsearch Connection</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Enter your Elasticsearch endpoint and credentials. By default, the connection is made
            directly from your browser. If Proxy URL is configured, requests are sent through that
            proxy. Ensure CORS is configured on your cluster.
          </Typography>
          <Alert severity="warning" sx={{ py: 0 }}>
            Elasticsearch Serverless is not supported — it does not allow the CORS configuration
            required for direct browser connections.
          </Alert>

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
            onChange={(e) => {
              const nextUrl = e.target.value;
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
              // Keep ingest URL in sync unless the user has manually overridden it
              setIngestUrl((prev) => {
                const trimmed = prev.trim();
                if (!trimmed || trimmed === previousIngestDerived) {
                  return deriveIngestUrlOrEmpty(nextUrl);
                }
                return prev;
              });
            }}
            helperText="The full URL including protocol and port"
          />
          <Button
            size="small"
            onClick={() => setShowProxy(!showProxy)}
            endIcon={showProxy ? <ExpandLess /> : <ExpandMore />}
            sx={{ alignSelf: "flex-start" }}
          >
            Proxy Settings
          </Button>
          <Collapse in={showProxy} unmountOnExit>
            <TextField
              label="Proxy URL"
              placeholder="http://localhost:3000/_es"
              fullWidth
              value={proxyUrl}
              onChange={(e) => {
                setProxyUrl(e.target.value);
                setActiveProfileId(null);
              }}
              helperText="Requests are sent to this URL; the Elasticsearch URL is forwarded as a header"
            />
          </Collapse>
          <Button
            size="small"
            onClick={() => setShowAdvanced(!showAdvanced)}
            endIcon={showAdvanced ? <ExpandLess /> : <ExpandMore />}
            sx={{ alignSelf: "flex-start" }}
          >
            Advanced Settings
          </Button>
          <Collapse in={showAdvanced} unmountOnExit>
            <TextField
              label="Ingest URL"
              placeholder={
                deriveIngestUrlOrEmpty(url) ||
                "https://<id>.ingest.<region>.<provider>.elastic.cloud"
              }
              fullWidth
              value={ingestUrl}
              onChange={(e) => {
                setIngestUrl(e.target.value);
                setActiveProfileId(null);
              }}
              helperText="Auto-detected from the Elasticsearch URL for Elastic Cloud. Used as the OTLP ingest endpoint for collector setup."
            />
          </Collapse>
          <Button
            size="small"
            onClick={() => setShowTelemetry(!showTelemetry)}
            endIcon={showTelemetry ? <ExpandLess /> : <ExpandMore />}
            sx={{ alignSelf: "flex-start" }}
          >
            Browser Tracing (Experimental)
          </Button>
          <Collapse in={showTelemetry} unmountOnExit>
            <OtlpConfigPanel
              otlpEnabled={otlpEnabled}
              onOtlpEnabledChange={(enabled) => {
                setOtlpEnabled(enabled);
                setActiveProfileId(null);
              }}
              otlpEndpoint={otlpEndpoint}
              onOtlpEndpointChange={(endpoint) => {
                setOtlpEndpoint(endpoint);
                setActiveProfileId(null);
              }}
              otlpUseElasticAuth={otlpUseElasticAuth}
              onOtlpUseElasticAuthChange={(useElasticAuth) => {
                setOtlpUseElasticAuth(useElasticAuth);
                setActiveProfileId(null);
              }}
              otlpApiKey={otlpApiKey}
              onOtlpApiKeyChange={(key) => {
                setOtlpApiKey(key);
                setActiveProfileId(null);
              }}
              authType={authType}
              url={url}
            />
          </Collapse>
          <Tabs
            value={authType}
            onChange={(_, v: AuthType) => {
              setAuthType(v);
              setActiveProfileId(null);
              setResult(null);
            }}
          >
            <Tab label="API Key" value="apiKey" />
            <Tab label="Username / Password" value="userpass" />
          </Tabs>
          {authType === "apiKey" && (
            <TextField
              label="API Key"
              placeholder="base64-encoded API key"
              fullWidth
              type={showSecret ? "text" : "password"}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setActiveProfileId(null);
              }}
              helperText="In browser mode, stored in session storage and cleared when the tab closes; in Electron, stored in the OS credential store."
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        aria-label={showSecret ? "Hide credentials" : "Show credentials"}
                        onClick={() => setShowSecret(!showSecret)}
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
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setActiveProfileId(null);
                }}
              />
              <TextField
                label="Password"
                fullWidth
                type={showSecret ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setActiveProfileId(null);
                }}
                helperText="In browser mode, stored in session storage and cleared when the tab closes; in Electron, stored in the OS credential store."
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          aria-label={showSecret ? "Hide credentials" : "Show credentials"}
                          onClick={() => setShowSecret(!showSecret)}
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
          {result && <Alert severity={result.ok ? "success" : "error"}>{result.message}</Alert>}

          {(url || proxyUrl) && (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField
                size="small"
                label="Profile name"
                placeholder="e.g. Production"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSaveProfile();
                }}
                error={isDuplicateProfileName}
                helperText={
                  isDuplicateProfileName ? "A profile with this name already exists" : undefined
                }
                sx={{ flex: 1 }}
              />
              <Button
                size="small"
                variant="outlined"
                onClick={() => void handleSaveProfile()}
                disabled={!profileName.trim() || !url || isDuplicateProfileName}
              >
                Save Profile
              </Button>
              <TextField
                size="small"
                label="PIN (optional)"
                type="password"
                placeholder="Encrypt with PIN"
                value={savePin}
                onChange={(e) => setSavePin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSaveProfile();
                }}
                helperText={
                  savePin.trim()
                    ? "Credentials will be encrypted and stored locally"
                    : "Leave blank to use session storage only"
                }
                sx={{ flex: 1 }}
              />
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ pb: 2, px: 3 }}>
        {connected && (
          <Button onClick={handleDisconnect} color="warning" disabled={testing}>
            Disconnect
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => setOpen(false)}>Cancel</Button>
        <Button onClick={handleTest} disabled={testing || !url.trim()}>
          {testing ? <CircularProgress size={20} /> : "Test"}
        </Button>
        <Button variant="contained" onClick={handleConnect} disabled={testing || !url.trim()}>
          {testing ? <CircularProgress size={20} /> : "Connect"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
