import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { useApiKeys } from "../hooks/useApiKeys";
import { usePageContextStore } from "../store/usePageContextStore";
import { copyToClipboard } from "../utils/copyToClipboard";
import { formatTimestamp } from "../utils/formatDate";

import { ageLabel, riskLabel, riskLevel } from "./ApiKeysPage.utils";
import PageInsightBanner from "./PageInsightBanner";
import SecurityMasterDetailPage from "./SecurityMasterDetailPage";

export default function ApiKeysPage() {
  const { keys, loading, error, accessNotice, refresh } = useApiKeys();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve the selected key: keep the user's pick if it still exists in the
  // loaded keys, otherwise fall back to the first key.
  const effectiveKeyId = useMemo(() => {
    if (selectedKeyId && keys.some((k) => k.id === selectedKeyId)) return selectedKeyId;
    return keys[0]?.id ?? null;
  }, [keys, selectedKeyId]);

  const selectedKey = useMemo(
    () => keys.find((k) => k.id === effectiveKeyId) ?? null,
    [keys, effectiveKeyId],
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

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const filteredKeys = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return keys;
    return keys.filter(
      (k) => k.name.toLowerCase().includes(term) || k.username.toLowerCase().includes(term),
    );
  }, [search, keys]);

  // When filtered results don't include the selected key (e.g. search
  // excludes it), hide the detail panel while keeping the selection so it
  // restores when the search is cleared.
  const displayedKey = filteredKeys.some((k) => k.id === effectiveKeyId) ? selectedKey : null;
  const displayedKeyRisk = displayedKey !== null ? selectedKeyRisk : null;

  // Publish screen context for AI chat
  const setPageSection = usePageContextStore((s) => s.setPageSection);
  useEffect(() => {
    setPageSection("security", {
      pageType: "apiKeys",
      selectedItem: effectiveKeyId,
      totalItems: keys.length,
    });
  }, [keys, effectiveKeyId, setPageSection]);

  const insightStats = useMemo(() => {
    if (keys.length === 0) return null;
    const noExpiration = keys.filter((k) => k.expiration == null).length;
    const highRisk = keys.filter(
      (k) => riskLevel(k) === "warning" || riskLevel(k) === "error",
    ).length;
    const oldKeys = keys.filter((k) => riskLevel(k) === "warning").length;
    return {
      totalKeys: keys.length,
      keysWithoutExpiration: noExpiration,
      highRiskKeys: highRisk,
      oldKeys,
    };
  }, [keys]);

  const insightContext = insightStats ? JSON.stringify(insightStats) : "";
  const insightCacheKey = `api-keys::${insightContext}`;

  const copyQuery = useCallback(async () => {
    const copied = await copyToClipboard("GET /_security/api_key");
    if (!copied) return;
    setCopied(true);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <SecurityMasterDetailPage
      title="API Keys"
      actions={
        <>
          <Button size="small" variant="outlined" onClick={refresh} disabled={loading}>
            {loading ? <CircularProgress size={16} /> : "Refresh"}
          </Button>
          <Button size="small" variant="contained" onClick={() => void copyQuery()}>
            {copied ? "Copied" : "Copy API call"}
          </Button>
        </>
      }
      alerts={
        <>
          {insightContext && (
            <PageInsightBanner
              context={insightContext}
              systemPrompt="You are an API key security advisor for Elasticsearch. Summarize API key hygiene in one concise sentence. Mention total active keys, keys without expiration, and keys older than policy threshold that should be rotated."
              cacheKey={insightCacheKey}
              severity="warning"
            />
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {accessNotice && <Alert severity="warning">{accessNotice}</Alert>}
        </>
      }
      showLoadingSkeleton={loading && keys.length === 0}
      masterPane={
        <>
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
          <List dense sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            {filteredKeys.map((key) => (
              <ListItem key={key.id} disablePadding>
                <ListItemButton
                  selected={key.id === effectiveKeyId}
                  onClick={() => setSelectedKeyId(key.id)}
                >
                  <ListItemText
                    primary={key.name}
                    secondary={`Owner: ${key.username.trim() || "No owner"} • Age: ${ageLabel(key.creation)}`}
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
        </>
      }
      detailPane={
        displayedKey ? (
          <>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle1">{displayedKey.name}</Typography>
              {displayedKeyRisk !== null && displayedKeyRisk.label !== "" && (
                <Chip size="small" label={displayedKeyRisk.label} color={displayedKeyRisk.level} />
              )}
            </Stack>

            <Typography variant="caption" color="text.secondary">
              Owner
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              {displayedKey.username ? (
                <Tooltip title={`View user: ${displayedKey.username}`}>
                  <Chip
                    size="small"
                    label={displayedKey.username}
                    clickable
                    aria-label={`View user: ${displayedKey.username}`}
                    onClick={() =>
                      navigate(`/users?username=${encodeURIComponent(displayedKey.username)}`)
                    }
                  />
                </Tooltip>
              ) : (
                <Chip size="small" label="No owner" aria-label="No owner" />
              )}
            </Stack>

            <Typography variant="caption" color="text.secondary">
              Details
            </Typography>
            <Typography variant="body2">
              <strong>ID:</strong> {displayedKey.id}
            </Typography>
            <Typography variant="body2">
              <strong>Created:</strong> {formatTimestamp(displayedKey.creation)} (
              {ageLabel(displayedKey.creation)} ago)
            </Typography>
            <Typography variant="body2">
              <strong>Expires:</strong>{" "}
              {displayedKey.expiration != null ? formatTimestamp(displayedKey.expiration) : "Never"}
            </Typography>
            {displayedKey.realm && (
              <Typography variant="body2">
                <strong>Realm:</strong> {displayedKey.realm}
              </Typography>
            )}

            <Typography variant="caption" color="text.secondary">
              Metadata
            </Typography>
            <Typography
              component="pre"
              variant="body2"
              sx={{ overflow: "auto", m: 0, p: 1, borderRadius: 1, bgcolor: "action.hover" }}
            >
              {JSON.stringify(displayedKey.metadata ?? {}, null, 2)}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Select an API key.
          </Typography>
        )
      }
    />
  );
}
