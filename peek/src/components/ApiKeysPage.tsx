import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { ElasticsearchClient, type ApiKeyInfo } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { copyToClipboard } from "../utils/copyToClipboard";

import { ageLabel, riskLabel, riskLevel } from "./ApiKeysPage.utils";
import { loadSecurityResource } from "./securityResourceLoader";

export default function ApiKeysPage() {
  const connection = useConnectionStore((s) => s.connection);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedKey = useMemo(
    () => keys.find((k) => k.id === selectedKeyId) ?? null,
    [keys, selectedKeyId],
  );
  const selectedKeyRisk = useMemo(
    () =>
      selectedKey === null
        ? null
        : {
            level: riskLevel(selectedKey),
            label: riskLabel(selectedKey),
          },
    [selectedKey],
  );

  const loadKeys = useCallback(async () => {
    if (!connection) return;
    setLoading(true);
    setError(null);
    setAccessNotice(null);
    try {
      const client = new ElasticsearchClient(connection);
      const result = await loadSecurityResource({
        client,
        fetchResource: (c) => c.getApiKeys(),
        canRead: (caps) => caps.canReadApiKeys,
        authDeniedNotice: "Your credentials cannot list API keys.",
      });
      setAccessNotice(result.notice);
      if (result.error !== null) {
        setError(result.error);
      } else if (result.data !== null) {
        const nextKeys = (result.data.api_keys ?? [])
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name));
        setKeys(nextKeys);
        setSelectedKeyId((current) =>
          current && nextKeys.some((k) => k.id === current) ? current : (nextKeys[0]?.id ?? null),
        );
      } else {
        setKeys([]);
        setSelectedKeyId(null);
      }
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const filteredKeys = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return keys;
    return keys.filter(
      (k) => k.name.toLowerCase().includes(term) || k.username.toLowerCase().includes(term),
    );
  }, [search, keys]);

  const copyQuery = useCallback(async () => {
    const copied = await copyToClipboard("GET /_security/api_key");
    if (!copied) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: 0, height: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" component="h1" sx={{ flex: 1 }}>
            API Keys
          </Typography>
          <Button size="small" variant="outlined" onClick={loadKeys} disabled={loading}>
            {loading ? <CircularProgress size={16} /> : "Refresh"}
          </Button>
          <Button size="small" variant="contained" onClick={() => void copyQuery()}>
            {copied ? "Copied" : "Copy API call"}
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {accessNotice && <Alert severity="warning">{accessNotice}</Alert>}

      <Box sx={{ display: "flex", gap: 1, minHeight: 0, flex: 1 }}>
        <Paper
          variant="outlined"
          sx={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}
        >
          <Box sx={{ p: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search API keys"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Box>
          <Divider />
          <List dense sx={{ overflow: "auto", minHeight: 0, flex: 1 }}>
            {filteredKeys.map((key) => (
              <ListItem key={key.id} disablePadding>
                <ListItemButton
                  selected={key.id === selectedKeyId}
                  onClick={() => setSelectedKeyId(key.id)}
                >
                  <ListItemText
                    primary={key.name}
                    secondary={`Owner: ${key.username} • Age: ${ageLabel(key.creation)}`}
                    sx={key.invalidated ? { opacity: 0.5 } : undefined}
                  />
                </ListItemButton>
              </ListItem>
            ))}
            {!loading && filteredKeys.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No API keys found.
              </Typography>
            )}
          </List>
        </Paper>

        <Paper
          variant="outlined"
          sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, p: 1.5, gap: 1 }}
        >
          {selectedKey ? (
            <>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h6">{selectedKey.name}</Typography>
                {selectedKeyRisk !== null && selectedKeyRisk.label !== "" && (
                  <Chip size="small" label={selectedKeyRisk.label} color={selectedKeyRisk.level} />
                )}
              </Stack>

              <Typography variant="caption" color="text.secondary">
                Owner
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Tooltip title={`View user: ${selectedKey.username}`}>
                  <Chip
                    size="small"
                    label={selectedKey.username}
                    clickable
                    aria-label={`View user: ${selectedKey.username}`}
                    onClick={() =>
                      navigate(`/users?username=${encodeURIComponent(selectedKey.username)}`)
                    }
                  />
                </Tooltip>
              </Stack>

              <Typography variant="caption" color="text.secondary">
                Details
              </Typography>
              <Typography variant="body2">
                <strong>ID:</strong> {selectedKey.id}
              </Typography>
              <Typography variant="body2">
                <strong>Created:</strong> {new Date(selectedKey.creation).toLocaleString()} (
                {ageLabel(selectedKey.creation)} ago)
              </Typography>
              <Typography variant="body2">
                <strong>Expires:</strong>{" "}
                {selectedKey.expiration != null
                  ? new Date(selectedKey.expiration).toLocaleString()
                  : "Never"}
              </Typography>
              {selectedKey.realm && (
                <Typography variant="body2">
                  <strong>Realm:</strong> {selectedKey.realm}
                </Typography>
              )}

              <Typography variant="caption" color="text.secondary">
                Metadata
              </Typography>
              <Typography
                component="pre"
                variant="body2"
                sx={{ m: 0, p: 1, bgcolor: "action.hover", borderRadius: 1, overflow: "auto" }}
              >
                {JSON.stringify(selectedKey.metadata ?? {}, null, 2)}
              </Typography>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Select an API key.
            </Typography>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
