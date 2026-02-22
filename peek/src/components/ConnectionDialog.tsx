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
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import Divider from "@mui/material/Divider";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { useDashboardStore } from "../store/useDashboardStore";
import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import type { ElasticsearchConnection } from "../types";

type AuthType = "apiKey" | "userpass";

export default function ConnectionDialog() {
  const open = useDashboardStore((s) => s.connectionDialogOpen);
  const setOpen = useDashboardStore((s) => s.setConnectionDialogOpen);
  const savedConn = useDashboardStore((s) => s.connection);
  const setConnection = useDashboardStore((s) => s.setConnection);
  const setConnected = useDashboardStore((s) => s.setConnected);
  const setCapabilities = useDashboardStore((s) => s.setCapabilities);
  const connectionProfiles = useDashboardStore((s) => s.connectionProfiles);
  const activeProfileId = useDashboardStore((s) => s.activeProfileId);
  const saveConnectionProfile = useDashboardStore((s) => s.saveConnectionProfile);
  const deleteConnectionProfile = useDashboardStore((s) => s.deleteConnectionProfile);
  const renameConnectionProfile = useDashboardStore((s) => s.renameConnectionProfile);
  const setActiveProfileId = useDashboardStore((s) => s.setActiveProfileId);

  const initialAuthType: AuthType = savedConn?.username ? "userpass" : "apiKey";

  const [url, setUrl] = useState(savedConn?.url ?? "");
  const [authType, setAuthType] = useState<AuthType>(initialAuthType);
  const [apiKey, setApiKey] = useState(savedConn?.apiKey ?? "");
  const [username, setUsername] = useState(savedConn?.username ?? "");
  const [password, setPassword] = useState(savedConn?.password ?? "");
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [profileName, setProfileName] = useState("");
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setUrl(savedConn?.url ?? "");
    setAuthType(savedConn?.username ? "userpass" : "apiKey");
    setApiKey(savedConn?.apiKey ?? "");
    setUsername(savedConn?.username ?? "");
    setPassword(savedConn?.password ?? "");
  }, [savedConn]);

  const buildConnection = useCallback((): ElasticsearchConnection => {
    if (authType === "userpass") {
      return { url: url.trim(), username: username.trim(), password: password.trim() };
    }
    return { url: url.trim(), apiKey: apiKey.trim() };
  }, [url, authType, apiKey, username, password]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setResult(null);
    const conn = buildConnection();
    try {
      const client = new ElasticsearchClient(conn);
      await client.getClusterInfo();
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
      const client = new ElasticsearchClient(conn);
      await client.getClusterInfo();
      const caps = await client.getCapabilities();
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
  }, [setConnected, setCapabilities]);

  const isDuplicateProfileName = profileName.trim()
    ? connectionProfiles.some((p) => p.name === profileName.trim())
    : false;

  const handleSaveProfile = useCallback(() => {
    const trimmed = profileName.trim();
    if (!trimmed) return;
    const id = saveConnectionProfile(trimmed, buildConnection());
    if (id) setProfileName("");
  }, [profileName, saveConnectionProfile, buildConnection]);

  const handleLoadProfile = useCallback(
    (profileId: string) => {
      const profile = connectionProfiles.find((p) => p.id === profileId);
      if (!profile) return;
      const conn = profile.connection;
      setUrl(conn.url);
      setAuthType(conn.username ? "userpass" : "apiKey");
      setApiKey(conn.apiKey ?? "");
      setUsername(conn.username ?? "");
      setPassword(conn.password ?? "");
      setActiveProfileId(profileId);
      setResult(null);
    },
    [connectionProfiles, setActiveProfileId],
  );

  const handleRenameProfile = useCallback(
    (id: string) => {
      const trimmed = editingProfileName.trim();
      if (!trimmed) return;
      renameConnectionProfile(id, trimmed);
      setEditingProfileId(null);
      setEditingProfileName("");
    },
    [editingProfileName, renameConnectionProfile],
  );

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Elasticsearch Connection</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Enter your Elasticsearch endpoint and credentials. The connection is made directly from
            your browser — no data passes through any intermediary server. Ensure CORS is configured
            on your cluster.
          </Typography>
          <Alert severity="warning" sx={{ py: 0 }}>
            Elasticsearch Serverless is not supported — it does not allow the CORS configuration
            required for direct browser connections.
          </Alert>

          {connectionProfiles.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Saved Profiles
              </Typography>
              <List dense disablePadding sx={{ bgcolor: "action.hover", borderRadius: 1 }}>
                {connectionProfiles.map((profile) => (
                  <ListItemButton
                    key={profile.id}
                    selected={profile.id === activeProfileId}
                    onClick={() => handleLoadProfile(profile.id)}
                    data-testid={`profile-${profile.id}`}
                  >
                    {editingProfileId === profile.id ? (
                      <TextField
                        size="small"
                        value={editingProfileName}
                        onChange={(e) => setEditingProfileName(e.target.value)}
                        onBlur={() => handleRenameProfile(profile.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameProfile(profile.id);
                          if (e.key === "Escape") setEditingProfileId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        sx={{ mr: 1 }}
                      />
                    ) : (
                      <ListItemText
                        primary={profile.name}
                        secondary={profile.connection.url}
                        onDoubleClick={() => {
                          setEditingProfileId(profile.id);
                          setEditingProfileName(profile.name);
                        }}
                      />
                    )}
                    <ListItemSecondaryAction>
                      {confirmDeleteId === profile.id ? (
                        <Button
                          size="small"
                          color="error"
                          variant="contained"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConnectionProfile(profile.id);
                            setConfirmDeleteId(null);
                          }}
                          onBlur={() => setConfirmDeleteId(null)}
                        >
                          Confirm
                        </Button>
                      ) : (
                        <>
                          <IconButton
                            edge="end"
                            size="small"
                            aria-label={`Rename profile ${profile.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProfileId(profile.id);
                              setEditingProfileName(profile.name);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            edge="end"
                            size="small"
                            aria-label={`Delete profile ${profile.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(profile.id);
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </ListItemSecondaryAction>
                  </ListItemButton>
                ))}
              </List>
              <Divider />
            </>
          )}

          <TextField
            label="Elasticsearch URL"
            placeholder="https://my-cluster.es.us-east-1.aws.elastic.cloud:443"
            fullWidth
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setActiveProfileId(null);
            }}
            helperText="The full URL including protocol and port"
          />
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
              helperText="Stored in session storage — cleared when the browser tab closes"
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
                helperText="Stored in session storage — cleared when the browser tab closes"
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

          {url && (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField
                size="small"
                label="Profile name"
                placeholder="e.g. Production"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveProfile();
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
                onClick={handleSaveProfile}
                disabled={!profileName.trim() || !url || isDuplicateProfileName}
              >
                Save Profile
              </Button>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleDisconnect} color="warning">
          Disconnect
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => setOpen(false)}>Cancel</Button>
        <Button onClick={handleTest} disabled={testing || !url}>
          {testing ? <CircularProgress size={20} /> : "Test"}
        </Button>
        <Button variant="contained" onClick={handleConnect} disabled={testing || !url}>
          {testing ? <CircularProgress size={20} /> : "Connect"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
