import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { ElasticsearchClient, isElasticsearchError, type SecurityUser } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";

export default function UsersPage() {
  const connection = useConnectionStore((s) => s.connection);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<SecurityUser[]>([]);
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      const [capsResult, usersResult] = await Promise.allSettled([
        client.getCapabilities(),
        client.getSecurityUsers(),
      ]);
      if (capsResult.status === "fulfilled" && !capsResult.value.canReadSecurityUsers) {
        setAccessNotice("Your credentials may have partial access to security APIs.");
      }
      if (usersResult.status === "fulfilled") {
        const nextUsers = Object.entries(usersResult.value)
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
        setSelectedUsername((current) =>
          current && nextUsers.some((user) => user.username === current)
            ? current
            : (nextUsers[0]?.username ?? null),
        );
      } else {
        const reason = usersResult.reason;
        if (isElasticsearchError(reason) && (reason.status === 401 || reason.status === 403)) {
          setAccessNotice("Your credentials cannot read all Users data.");
          setUsers([]);
          setSelectedUsername(null);
        } else {
          setError(isElasticsearchError(reason) ? reason.message : String(reason));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => user.username.toLowerCase().includes(term));
  }, [search, users]);

  const copyQuery = useCallback(async () => {
    await navigator.clipboard.writeText("GET /_security/user");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: 0, height: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" sx={{ flex: 1 }}>
            Users
          </Typography>
          <Button size="small" variant="outlined" onClick={loadUsers} disabled={loading}>
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
              placeholder="Search users"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Box>
          <Divider />
          <List dense sx={{ overflow: "auto", minHeight: 0, flex: 1 }}>
            {filteredUsers.map((user) => (
              <ListItemButton
                key={user.username}
                selected={user.username === selectedUsername}
                onClick={() => setSelectedUsername(user.username)}
              >
                <ListItemText
                  primary={user.username}
                  secondary={`${user.enabled === false ? "Disabled" : "Enabled"} • ${user.roles?.length ?? 0} roles`}
                />
              </ListItemButton>
            ))}
            {!loading && filteredUsers.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No users found.
              </Typography>
            )}
          </List>
        </Paper>

        <Paper
          variant="outlined"
          sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, p: 1.5, gap: 1 }}
        >
          {selectedUser ? (
            <>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h6">{selectedUser.username}</Typography>
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
                sx={{ m: 0, p: 1, bgcolor: "action.hover", borderRadius: 1, overflow: "auto" }}
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
    </Box>
  );
}
