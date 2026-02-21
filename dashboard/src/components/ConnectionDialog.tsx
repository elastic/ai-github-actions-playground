import { useState, useCallback } from "react";
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
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useDashboardStore } from "../store/useDashboardStore";
import { testConnection } from "../services/elasticsearch";
import type { ElasticsearchConnection } from "../types";

type AuthType = "apiKey" | "userpass";

export default function ConnectionDialog() {
  const open = useDashboardStore((s) => s.connectionDialogOpen);
  const setOpen = useDashboardStore((s) => s.setConnectionDialogOpen);
  const savedConn = useDashboardStore((s) => s.connection);
  const setConnection = useDashboardStore((s) => s.setConnection);
  const setConnected = useDashboardStore((s) => s.setConnected);

  const initialAuthType: AuthType = savedConn?.username ? "userpass" : "apiKey";

  const [url, setUrl] = useState(savedConn?.url ?? "");
  const [authType, setAuthType] = useState<AuthType>(initialAuthType);
  const [apiKey, setApiKey] = useState(savedConn?.apiKey ?? "");
  const [username, setUsername] = useState(savedConn?.username ?? "");
  const [password, setPassword] = useState(savedConn?.password ?? "");
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

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
    const res = await testConnection(conn);
    if (res.ok) {
      setResult({ ok: true, message: "Connected successfully." });
    } else {
      setResult({ ok: false, message: res.error });
    }
    setTesting(false);
  }, [buildConnection]);

  const handleConnect = useCallback(async () => {
    const conn = buildConnection();
    setConnection(conn);
    setTesting(true);
    setResult(null);
    const res = await testConnection(conn);
    setTesting(false);
    if (res.ok) {
      setConnected(true);
      setOpen(false);
    } else {
      setResult({ ok: false, message: res.error });
    }
  }, [buildConnection, setConnection, setConnected, setOpen]);

  const handleDisconnect = useCallback(() => {
    setConnected(false);
    setResult(null);
  }, [setConnected]);

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
          <TextField
            label="Elasticsearch URL"
            placeholder="https://my-cluster.es.us-east-1.aws.elastic.cloud:443"
            fullWidth
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            helperText="The full URL including protocol and port"
          />
          <Tabs
            value={authType}
            onChange={(_, v: AuthType) => {
              setAuthType(v);
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
              onChange={(e) => setApiKey(e.target.value)}
              helperText="Stored in session storage — cleared when the browser tab closes"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowSecret(!showSecret)}>
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
                onChange={(e) => setUsername(e.target.value)}
              />
              <TextField
                label="Password"
                fullWidth
                type={showSecret ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                helperText="Stored in session storage — cleared when the browser tab closes"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowSecret(!showSecret)}>
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
