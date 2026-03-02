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
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { parseAsString, useQueryState } from "nuqs";

import { ElasticsearchClient, type SecurityUser } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { copyToClipboard } from "../utils/copyToClipboard";

import ContentSkeleton from "./ContentSkeleton";
import PageHeader from "./PageHeader";
import { loadSecurityResource } from "./securityResourceLoader";

export default function UsersPage() {
  const connection = useConnectionStore((s) => s.connection);
  const navigate = useNavigate();
  const [urlUsername, setUrlUsername] = useQueryState("username", parseAsString);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<SecurityUser[]>([]);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    };
  }, []);

  const selectedUsername = useMemo(() => {
    if (users.length === 0) return urlUsername;
    if (urlUsername && users.some((user) => user.username === urlUsername)) return urlUsername;
    return users[0]?.username ?? null;
  }, [users, urlUsername]);

  const selectedUser = useMemo(
    () => users.find((user) => user.username === selectedUsername) ?? null,
    [users, selectedUsername],
  );

  const loadUsers = useCallback(async () => {
    if (!connection) return;
    setLoading(true);
    setError(null);
    setAccessNotice(null);
    try {
      const client = new ElasticsearchClient(connection);
      const result = await loadSecurityResource({
        client,
        fetchResource: (c) => c.getSecurityUsers(),
        canRead: (caps) => caps.canReadSecurityUsers,
        authDeniedNotice: "Your credentials cannot read all user data.",
      });
      setAccessNotice(result.notice);
      if (result.error !== null) {
        setError(result.error);
      } else if (result.data !== null) {
        const nextUsers = Object.entries(result.data)
          .map(([username, user]) => ({
            username: user.username ?? username,
            enabled: user.enabled,
            roles: user.roles ?? [],
            full_name: user.full_name ?? null,
            email: user.email ?? null,
            metadata: user.metadata ?? {},
          }))
          .sort((a, b) => a.username.localeCompare(b.username));
        setUsers(nextUsers);
      } else {
        setUsers([]);
      }
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

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

  const copyQuery = useCallback(async () => {
    const copied = await copyToClipboard("GET /_security/user");
    if (!copied) return;
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleSelectUser = useCallback(
    (username: string) => {
      void setUrlUsername(username);
    },
    [setUrlUsername],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Users"
          actions={
            <>
              <Button size="small" variant="outlined" onClick={loadUsers} disabled={loading}>
                {loading ? <CircularProgress size={16} /> : "Refresh"}
              </Button>
              <Button size="small" variant="contained" onClick={() => void copyQuery()}>
                {copied ? "Copied" : "Copy API call"}
              </Button>
            </>
          }
        />
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {accessNotice && <Alert severity="warning">{accessNotice}</Alert>}

      {loading && users.length === 0 ? (
        <Paper variant="outlined" sx={{ flex: 1, p: 1.5 }}>
          <ContentSkeleton variant="table" />
        </Paper>
      ) : (
        <Box sx={{ display: "flex", flex: 1, gap: 1, minHeight: 0 }}>
          <Paper
            variant="outlined"
            sx={{
              display: "flex",
              flexShrink: 0,
              flexDirection: "column",
              width: 320,
              minHeight: 0,
            }}
          >
            <Box sx={{ p: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Search users"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
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
          </Paper>

          <Paper
            variant="outlined"
            sx={{ display: "flex", flex: 1, flexDirection: "column", gap: 1, minHeight: 0, p: 1.5 }}
          >
            {selectedUser ? (
              <>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="subtitle1">{selectedUser.username}</Typography>
                  <Chip
                    size="small"
                    color={selectedUser.enabled === false ? "warning" : "success"}
                    label={selectedUser.enabled === false ? "Disabled" : "Enabled"}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Roles
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {(selectedUser.roles ?? []).map((role) => (
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
                  {(selectedUser.roles ?? []).length === 0 && (
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
                  {JSON.stringify(selectedUser.metadata ?? {}, null, 2)}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Select a user.
              </Typography>
            )}
          </Paper>
        </Box>
      )}
    </Box>
  );
}
