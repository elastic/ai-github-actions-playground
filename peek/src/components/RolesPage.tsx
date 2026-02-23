import { useCallback, useEffect, useMemo, useState } from "react";
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
import Typography from "@mui/material/Typography";

import { ElasticsearchClient, isElasticsearchError, type SecurityRole } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { copyToClipboard } from "../utils/copyToClipboard";

type RoleEntry = { name: string; role: SecurityRole };

export default function RolesPage() {
  const connection = useConnectionStore((s) => s.connection);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roles, setRoles] = useState<RoleEntry[]>([]);
  const [selectedRoleName, setSelectedRoleName] = useState<string | null>(null);
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
      const [capsResult, rolesResult] = await Promise.allSettled([
        client.getCapabilities(),
        client.getSecurityRoles(),
      ]);
      if (capsResult.status === "fulfilled" && !capsResult.value.canReadSecurityRoles) {
        setAccessNotice("Your credentials may have partial access to security APIs.");
      }
      if (rolesResult.status === "fulfilled") {
        const nextRoles = Object.entries(rolesResult.value)
          .map(([name, role]) => ({ name, role }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setRoles(nextRoles);
        setSelectedRoleName((current) =>
          current && nextRoles.some((entry) => entry.name === current)
            ? current
            : (nextRoles[0]?.name ?? null),
        );
      } else {
        const reason = rolesResult.reason;
        if (isElasticsearchError(reason) && (reason.status === 401 || reason.status === 403)) {
          setAccessNotice("Your credentials cannot read all Roles data.");
          setRoles([]);
          setSelectedRoleName(null);
        } else {
          setError(isElasticsearchError(reason) ? reason.message : String(reason));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return roles;
    return roles.filter((entry) => entry.name.toLowerCase().includes(term));
  }, [roles, search]);

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
          <Typography variant="h6" sx={{ flex: 1 }}>
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
              <ListItemButton
                key={entry.name}
                selected={entry.name === selectedRoleName}
                onClick={() => setSelectedRoleName(entry.name)}
              >
                <ListItemText
                  primary={entry.name}
                  secondary={`${entry.role.cluster?.length ?? 0} cluster privs • ${entry.role.indices?.length ?? 0} index rules`}
                />
              </ListItemButton>
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
