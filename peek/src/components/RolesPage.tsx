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
import { useSecurityRoles } from "../hooks/useSecurityRoles";
import { usePageContextStore } from "../store/usePageContextStore";
import { copyToClipboard } from "../utils/copyToClipboard";

import SecurityMasterDetailPage from "./SecurityMasterDetailPage";

export default function RolesPage() {
  const { roles, users, loading, error, accessNotice, usersError, refresh } = useSecurityRoles();
  const navigate = useNavigate();
  const [urlRole, setUrlRole] = useQueryState("role", parseAsString);
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault("").withOptions({ history: "replace" }),
  );
  const [copied, setCopied] = useState(false);
  const scheduleCopyFeedbackReset = useCopyFeedbackTimeout(() => setCopied(false));

  const selectedRoleName = useMemo(() => {
    if (roles.length === 0) return urlRole;
    if (urlRole && roles.some((entry) => entry.name === urlRole)) return urlRole;
    return roles[0]?.name ?? null;
  }, [roles, urlRole]);

  const selectedRole = useMemo(
    () => roles.find((entry) => entry.name === selectedRoleName) ?? null,
    [roles, selectedRoleName],
  );

  // Sync URL when the resolved selection differs from the URL param
  useEffect(() => {
    if (roles.length === 0) return;
    if (selectedRoleName !== urlRole) {
      void setUrlRole(selectedRoleName);
    }
  }, [roles, selectedRoleName, urlRole, setUrlRole]);

  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return roles;
    return roles.filter((entry) => entry.name.toLowerCase().includes(term));
  }, [roles, search]);

  // When filtered results don't include the selected role (e.g. search
  // excludes it), hide the detail panel while keeping the selection so it
  // restores when the search is cleared.
  const displayedRole = filteredRoles.some((entry) => entry.name === selectedRoleName)
    ? selectedRole
    : null;

  const assignedUsers = useMemo(
    () =>
      selectedRoleName ? users.filter((user) => (user.roles ?? []).includes(selectedRoleName)) : [],
    [users, selectedRoleName],
  );

  const copyQuery = useCallback(async () => {
    const copied = await copyToClipboard("GET /_security/role");
    if (!copied) return;
    setCopied(true);
    scheduleCopyFeedbackReset();
  }, [scheduleCopyFeedbackReset]);

  // Publish screen context for AI chat
  const setPageSection = usePageContextStore((s) => s.setPageSection);
  useEffect(() => {
    setPageSection("security", {
      pageType: "roles",
      selectedItem: selectedRoleName ?? null,
      totalItems: roles.length,
    });
  }, [roles, selectedRoleName, setPageSection]);

  return (
    <SecurityMasterDetailPage
      title="Roles"
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
          {usersError && (
            <Alert severity="warning">
              Unable to load users for role assignment display: {usersError}
            </Alert>
          )}
        </>
      }
      masterPane={
        <>
          <Box sx={{ p: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search roles"
              value={search}
              onChange={(event) => void setSearch(event.target.value)}
            />
          </Box>
          <Divider />
          <List dense sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            {filteredRoles.map((entry) => (
              <ListItem key={entry.name} disablePadding>
                <ListItemButton
                  selected={entry.name === selectedRoleName}
                  onClick={() => void setUrlRole(entry.name)}
                >
                  <ListItemText
                    primary={entry.name}
                    secondary={`${entry.role.cluster?.length ?? 0} cluster privileges • ${entry.role.indices?.length ?? 0} index rules`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
            {!loading && filteredRoles.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No roles found.
              </Typography>
            )}
          </List>
        </>
      }
      detailPane={
        displayedRole ? (
          <>
            <Typography variant="subtitle1">{displayedRole.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              Cluster privileges
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {(displayedRole.role.cluster ?? []).map((privilege) => (
                <Chip key={privilege} size="small" label={privilege} />
              ))}
              {(displayedRole.role.cluster ?? []).length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No cluster privileges.
                </Typography>
              )}
            </Stack>

            <Typography variant="caption" color="text.secondary">
              Index privileges
            </Typography>
            <Typography
              component="pre"
              variant="body2"
              sx={{ overflow: "auto", m: 0, p: 1, borderRadius: 1, bgcolor: "action.hover" }}
            >
              {JSON.stringify(displayedRole.role.indices ?? [], null, 2)}
            </Typography>

            <Typography variant="caption" color="text.secondary">
              Assigned users
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {assignedUsers.map((user) => (
                <Tooltip key={user.username} title={`View user: ${user.username}`}>
                  <Chip
                    size="small"
                    label={user.username}
                    clickable
                    aria-label={`View user: ${user.username}`}
                    onClick={() => navigate(`/users?username=${encodeURIComponent(user.username)}`)}
                  />
                </Tooltip>
              ))}
              {assignedUsers.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No users assigned.
                </Typography>
              )}
            </Stack>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Select a role.
          </Typography>
        )
      }
    />
  );
}
