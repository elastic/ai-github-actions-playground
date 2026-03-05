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
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { parseAsString, useQueryState } from "nuqs";

import { useCopyFeedbackTimeout } from "../hooks/useCopyFeedbackTimeout";
import { useSecurityUsers } from "../hooks/useSecurityUsers";
import { usePageContextStore } from "../store/usePageContextStore";
import { INSIGHT_GUARDRAIL } from "../hooks/insightPromptUtils";
import { copyToClipboard } from "../utils/copyToClipboard";

import PageInsightBanner from "./PageInsightBanner";
import SecurityMasterDetailPage from "./SecurityMasterDetailPage";

export default function UsersPage() {
  const { users, loading, error, accessNotice, refresh } = useSecurityUsers();
  const navigate = useNavigate();
  const [urlUsername, setUrlUsername] = useQueryState("username", parseAsString);
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault("").withOptions({ history: "replace" }),
  );
  const [copied, setCopied] = useState(false);
  const scheduleCopyFeedbackReset = useCopyFeedbackTimeout(() => setCopied(false));

  const selectedUsername = useMemo(() => {
    if (users.length === 0) return urlUsername;
    if (urlUsername && users.some((user) => user.username === urlUsername)) return urlUsername;
    return users[0]?.username ?? null;
  }, [users, urlUsername]);

  const selectedUser = useMemo(
    () => users.find((user) => user.username === selectedUsername) ?? null,
    [users, selectedUsername],
  );

  // Sync URL when the resolved selection differs from the URL param
  useEffect(() => {
    if (users.length === 0) return;
    if (selectedUsername !== urlUsername) {
      void setUrlUsername(selectedUsername);
    }
  }, [users, selectedUsername, urlUsername, setUrlUsername]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => user.username.toLowerCase().includes(term));
  }, [search, users]);

  const displayedUser = filteredUsers.some((user) => user.username === selectedUsername)
    ? selectedUser
    : null;

  const copyQuery = useCallback(async () => {
    const didCopy = await copyToClipboard("GET /_security/user");
    if (!didCopy) return;
    setCopied(true);
    scheduleCopyFeedbackReset();
  }, [scheduleCopyFeedbackReset]);

  const handleSelectUser = useCallback(
    (username: string) => {
      void setUrlUsername(username);
    },
    [setUrlUsername],
  );

  // Publish screen context for AI chat
  const setPageSection = usePageContextStore((s) => s.setPageSection);
  useEffect(() => {
    setPageSection("security", {
      pageType: "users",
      selectedItem: selectedUsername ?? null,
      totalItems: users.length,
    });
  }, [users, selectedUsername, setPageSection]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {users.length > 0 && (
        <PageInsightBanner
          context={JSON.stringify({
            totalUsers: users.length,
            disabledUsers: users.filter((u) => u.enabled === false).length,
          })}
          systemPrompt={`You are an Elasticsearch security posture analyst. Provide one concise user security posture insight and one least-privilege recommendation.${INSIGHT_GUARDRAIL}`}
          cacheKey={`users-security::${users.length}::${users.filter((u) => u.enabled === false).length}`}
        />
      )}
      <SecurityMasterDetailPage
        title="Users"
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
            {error && <Alert severity="error">{error}</Alert>}
            {accessNotice && <Alert severity="warning">{accessNotice}</Alert>}
          </>
        }
        showLoadingSkeleton={loading && users.length === 0}
        masterPane={
          <>
            <Box sx={{ p: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Search users"
                value={search}
                onChange={(event) => void setSearch(event.target.value)}
                inputProps={{ "aria-label": "Search users" }}
              />
            </Box>
            <Divider />
            <List dense sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              {filteredUsers.map((user) => (
                <ListItem key={user.username} disablePadding>
                  <ListItemButton
                    selected={user.username === selectedUsername}
                    onClick={() => handleSelectUser(user.username)}
                  >
                    <ListItemText
                      primary={user.username}
                      secondary={`${user.enabled === false ? "Disabled" : "Enabled"} • ${user.roles?.length ?? 0} roles`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
              {!loading && filteredUsers.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary="No users found."
                    primaryTypographyProps={{ variant: "body2", color: "text.secondary" }}
                  />
                </ListItem>
              )}
            </List>
          </>
        }
        detailPane={
          displayedUser ? (
            <>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="subtitle1">{displayedUser.username}</Typography>
                <Chip
                  size="small"
                  color={displayedUser.enabled === false ? "warning" : "success"}
                  label={displayedUser.enabled === false ? "Disabled" : "Enabled"}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Roles
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(displayedUser.roles ?? []).map((role) => (
                  <Tooltip key={role} title={`View role: ${role}`}>
                    <Chip
                      size="small"
                      label={role}
                      clickable
                      aria-label={`View role: ${role}`}
                      onClick={() => navigate(`/roles?role=${encodeURIComponent(role)}`)}
                    />
                  </Tooltip>
                ))}
                {(displayedUser.roles ?? []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No assigned roles.
                  </Typography>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Metadata
              </Typography>
              <Typography
                component="pre"
                variant="body2"
                sx={{ overflow: "auto", m: 0, p: 1, borderRadius: 1, bgcolor: "action.hover" }}
              >
                {JSON.stringify(displayedUser.metadata ?? {}, null, 2)}
              </Typography>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Select a user.
            </Typography>
          )
        }
      />
    </Box>
  );
}
