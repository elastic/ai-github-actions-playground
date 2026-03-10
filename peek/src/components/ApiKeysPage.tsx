import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LoadingButton from "./LoadingButton";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import VpnKeyIcon from "@mui/icons-material/VpnKey";
import SearchIcon from "@mui/icons-material/Search";

import DataFetchAlert from "./DataFetchAlert";
import EmptyState from "./EmptyState";

import { useApiKeys } from "../hooks/useApiKeys";
import { useCopyFeedbackTimeout } from "../hooks/useCopyFeedbackTimeout";
import { usePageContextStore } from "../store/usePageContextStore";
import { INSIGHT_GUARDRAIL } from "../hooks/insightPromptUtils";
import { copyToClipboard } from "../utils/copyToClipboard";
import { formatTimestamp } from "../utils/formatDate";

import { ageLabel, riskLabel, riskLevel } from "./ApiKeysPage.utils";
import PageInsightBanner from "./PageInsightBanner";
import SecurityMasterDetailPage, { MASTER_LIST_ITEM_SX } from "./SecurityMasterDetailPage";

export default function ApiKeysPage() {
  const { keys, loading, error, accessNotice, refresh } = useApiKeys();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const scheduleCopyFeedbackReset = useCopyFeedbackTimeout(() => setCopied(false));

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

  const filteredKeys = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return keys;
    return keys.filter(
      (k) => k.name.toLowerCase().includes(term) || k.username.toLowerCase().includes(term),
    );
  }, [deferredSearch, keys]);

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

  const insightContext = useMemo(() => {
    if (keys.length === 0) return "";
    const noExpiration = keys.filter((k) => k.expiration == null).length;
    const highRisk = keys.filter(
      (k) => riskLevel(k) === "warning" || riskLevel(k) === "error",
    ).length;
    return JSON.stringify({
      totalKeys: keys.length,
      keysWithoutExpiration: noExpiration,
      highRiskKeys: highRisk,
    });
  }, [keys]);

  const insightCacheKey = `api-keys::${keys.length}`;

  const copyQuery = useCallback(async () => {
    const didCopy = await copyToClipboard("GET /_security/api_key");
    if (!didCopy) return;
    setCopied(true);
    scheduleCopyFeedbackReset();
  }, [scheduleCopyFeedbackReset]);

  return (
    <SecurityMasterDetailPage
      title="API Keys"
      actions={
        <>
          <LoadingButton variant="outlined" onClick={refresh} loading={loading}>
            Refresh
          </LoadingButton>
          <Button variant="contained" onClick={() => void copyQuery()}>
            {copied ? "Copied" : "Copy API call"}
          </Button>
        </>
      }
      alerts={
        <>
          {insightContext && (
            <PageInsightBanner
              context={insightContext}
              systemPrompt={`You are an API key security advisor for Elasticsearch. Summarize API key hygiene in one concise sentence. Mention total active keys, how many lack expiration (security risk), and any keys that are old and should be rotated.${INSIGHT_GUARDRAIL}`}
              cacheKey={insightCacheKey}
              severity="warning"
            />
          )}
          <DataFetchAlert error={error} />
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
                  sx={MASTER_LIST_ITEM_SX}
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
              <ListItem disablePadding>
                <EmptyState
                  icon={<SearchIcon sx={{ fontSize: 28 }} />}
                  heading="No API keys found"
                  description="Try adjusting your search or check that API keys exist in the cluster."
                  size="small"
                  verticalAlign="start"
                />
              </ListItem>
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
          <EmptyState
            icon={<VpnKeyIcon sx={{ fontSize: 28 }} />}
            heading="Select an API key"
            description="Choose an API key from the list to view its details and risk assessment."
            size="small"
          />
        )
      }
    />
  );
}
