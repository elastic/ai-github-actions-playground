import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

import { ElasticsearchClient, type SecurityRole, type SecurityUser } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { copyToClipboard } from "../utils/copyToClipboard";

import { loadSecurityResource } from "./securityResourceLoader";

type RoleEntry = { name: string; role: SecurityRole };

export default function RolesPage() {
  const connection = useConnectionStore((s) => s.connection);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roles, setRoles] = useState<RoleEntry[]>([]);
  const [users, setUsers] = useState<SecurityUser[]>([]);
  const [selectedRoleName, setSelectedRoleName] = useState<string | null>(searchParams.get("role"));
  const [copied, setCopied] = useState(false);

  const selectedRole = useMemo(
    () => roles.find((entry) => entry.name === selectedRoleName) ?? null,
    [roles, selectedRoleName],
  );

  const loadRoles = useCallback(async () => {
    if (!connection) return;
    setLoading(true);
    setError(null);
    setAccessNotice(null);
    try {
      const client = new ElasticsearchClient(connection);
      const [rolesResult, usersResult] = await Promise.allSettled([
        loadSecurityResource({
          client,
          fetchResource: (c) => c.getSecurityRoles(),
          canRead: (caps) => caps.canReadSecurityRoles,
          authDeniedNotice: "Your credentials cannot read all role data.",
        }),
        client.getSecurityUsers(),
      ]);
      if (rolesResult.status === "fulfilled") {
        const result = rolesResult.value;
        setAccessNotice(result.notice);
        if (result.error !== null) {
          setError(result.error);
        } else if (result.data !== null) {
          const nextRoles = Object.entries(result.data)
            .map(([name, role]) => ({ name, role }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setRoles(nextRoles);
          setSelectedRoleName((current) =>
            current && nextRoles.some((entry) => entry.name === current)
              ? current
              : (nextRoles[0]?.name ?? null),
          );
        } else {
          setRoles([]);
          setSelectedRoleName(null);
        }
      }
      if (usersResult.status === "fulfilled") {
        setUsers(
          Object.entries(usersResult.value).map(([username, user]) => ({
            username: user.username ?? username,
            enabled: user.enabled,
            roles: user.roles ?? [],
          })),
        );
      } else {
        setUsers([]);
      }
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    setSelectedRoleName(searchParams.get("role"));
  }, [searchParams]);

  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return roles;
    return roles.filter((entry) => entry.name.toLowerCase().includes(term));
  }, [roles, search]);

  const assignedUsers = useMemo(
    () =>
      selectedRoleName ? users.filter((user) => (user.roles ?? []).includes(selectedRoleName)) : [],
    [users, selectedRoleName],
  );

  const copyQuery = useCallback(async () => {
    const copied = await copyToClipboard("GET /_security/role");
    if (!copied) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: 0, height: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" component="h1" sx={{ flex: 1 }}>
            Roles
          </Typography>
          <Button size="small" variant="outlined" onClick={loadRoles} disabled={loading}>
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
              placeholder="Search roles"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Box>
          <Divider />
          <List dense sx={{ overflow: "auto", minHeight: 0, flex: 1 }}>
            {filteredRoles.map((entry) => (
              <ListItem key={entry.name} disablePadding>
                <ListItemButton
                  selected={entry.name === selectedRoleName}
                  onClick={() => setSelectedRoleName(entry.name)}
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
        </Paper>

        <Paper
          variant="outlined"
          sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, p: 1.5, gap: 1 }}
        >
          {selectedRole ? (
            <>
              <Typography variant="h6">{selectedRole.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                Cluster privileges
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(selectedRole.role.cluster ?? []).map((privilege) => (
                  <Chip key={privilege} size="small" label={privilege} />
                ))}
                {(selectedRole.role.cluster ?? []).length === 0 && (
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
                sx={{ m: 0, p: 1, bgcolor: "action.hover", borderRadius: 1, overflow: "auto" }}
              >
                {JSON.stringify(selectedRole.role.indices ?? [], null, 2)}
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
                      onClick={() =>
                        navigate(`/users?username=${encodeURIComponent(user.username)}`)
                      }
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
          )}
        </Paper>
      </Box>
    </Box>
  );
}
