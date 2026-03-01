import { useState, useCallback, type MouseEvent } from "react";
import Chip from "@mui/material/Chip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import SettingsIcon from "@mui/icons-material/Settings";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useShallow } from "zustand/react/shallow";

import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { fetchCapabilitiesForConnection, isElasticsearchError } from "../services/es";
import type { ProfileHealth } from "../types";

function ProfileHealthBadge({ health }: { health: ProfileHealth | undefined }) {
  if (!health || health.status === "unknown") return null;
  if (health.status === "healthy") {
    return (
      <Tooltip title="Healthy">
        <CheckCircleIcon fontSize="small" sx={{ color: "success.main", ml: 0.5, flexShrink: 0 }} />
      </Tooltip>
    );
  }
  return (
    <Tooltip title={health.errorSummary ?? "Connection failed"}>
      <WarningAmberIcon fontSize="small" sx={{ color: "warning.main", ml: 0.5, flexShrink: 0 }} />
    </Tooltip>
  );
}

export default function ConnectionProfileSwitcher() {
  const {
    connected,
    connectionProfiles,
    activeProfileId,
    profileHealthMap,
    setConnection,
    setConnected,
    setCapabilities,
    setActiveProfileId,
    setProfileHealth,
  } = useConnectionStore(
    useShallow((s) => ({
      connected: s.connected,
      connectionProfiles: s.connectionProfiles,
      activeProfileId: s.activeProfileId,
      profileHealthMap: s.profileHealthMap,
      setConnection: s.setConnection,
      setConnected: s.setConnected,
      setCapabilities: s.setCapabilities,
      setActiveProfileId: s.setActiveProfileId,
      setProfileHealth: s.setProfileHealth,
    })),
  );
  const { setConnectionDialogOpen } = useUIStore(
    useShallow((s) => ({
      setConnectionDialogOpen: s.setConnectionDialogOpen,
    })),
  );

  const [profileAnchor, setProfileAnchor] = useState<null | HTMLElement>(null);
  const [switchingProfile, setSwitchingProfile] = useState(false);
  const [retestingProfileId, setRetestingProfileId] = useState<string | null>(null);
  const [profileFeedback, setProfileFeedback] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);

  const activeProfile = connectionProfiles.find((p) => p.id === activeProfileId);

  const handleSwitchProfile = useCallback(
    async (profileId: string) => {
      if (switchingProfile) return;
      const profile = connectionProfiles.find((p) => p.id === profileId);
      if (!profile) return;
      setProfileAnchor(null);
      setSwitchingProfile(true);
      const conn = profile.connection;
      try {
        const caps = await fetchCapabilitiesForConnection(conn);
        setConnection(conn);
        setConnected(true);
        setCapabilities(caps);
        setActiveProfileId(profileId);
        setProfileHealth(profileId, {
          status: "healthy",
          checkedAt: new Date().toISOString(),
          errorSummary: null,
        });
      } catch (err: unknown) {
        const message = isElasticsearchError(err) ? err.message : String(err);
        console.error("Profile switch failed:", message);
        setProfileHealth(profileId, {
          status: "needs_attention",
          checkedAt: new Date().toISOString(),
          errorSummary: message,
        });
        setConnectionDialogOpen(true);
      } finally {
        setSwitchingProfile(false);
      }
    },
    [
      switchingProfile,
      connectionProfiles,
      setConnection,
      setConnected,
      setCapabilities,
      setActiveProfileId,
      setProfileHealth,
      setConnectionDialogOpen,
    ],
  );

  const handleRetestProfile = useCallback(
    async (profileId: string, e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (retestingProfileId) return;
      const profile = connectionProfiles.find((p) => p.id === profileId);
      if (!profile) return;
      setRetestingProfileId(profileId);
      try {
        await fetchCapabilitiesForConnection(profile.connection);
        setProfileHealth(profileId, {
          status: "healthy",
          checkedAt: new Date().toISOString(),
          errorSummary: null,
        });
        setProfileFeedback({ message: `"${profile.name}" is healthy`, severity: "success" });
      } catch (err: unknown) {
        const message = isElasticsearchError(err) ? err.message : String(err);
        setProfileHealth(profileId, {
          status: "needs_attention",
          checkedAt: new Date().toISOString(),
          errorSummary: message,
        });
        setProfileFeedback({ message: `"${profile.name}" failed: ${message}`, severity: "error" });
      } finally {
        setRetestingProfileId(null);
      }
    },
    [retestingProfileId, connectionProfiles, setProfileHealth],
  );

  if (!connected || connectionProfiles.length === 0) return null;

  return (
    <>
      <Chip
        label={switchingProfile ? "Connecting…" : (activeProfile?.name ?? "No profile")}
        size="small"
        variant="outlined"
        onClick={(e) => setProfileAnchor(e.currentTarget)}
        disabled={switchingProfile}
        aria-label="Switch connection profile"
        sx={{ maxWidth: 180 }}
      />
      <Menu
        anchorEl={profileAnchor}
        open={Boolean(profileAnchor)}
        onClose={() => setProfileAnchor(null)}
      >
        {connectionProfiles.map((profile) => (
          <MenuItem
            key={profile.id}
            selected={profile.id === activeProfileId}
            disabled={switchingProfile}
            onClick={() => void handleSwitchProfile(profile.id)}
          >
            <ListItemText
              primary={profile.name}
              secondary={profile.connection.url}
              secondaryTypographyProps={{ fontSize: "0.7rem", noWrap: true }}
            />
            <ProfileHealthBadge health={profileHealthMap[profile.id]} />
            <Tooltip title={`Re-test ${profile.name}`}>
              <span>
                <IconButton
                  size="small"
                  aria-label={`Re-test ${profile.name}`}
                  disabled={retestingProfileId === profile.id}
                  onClick={(e) => void handleRetestProfile(profile.id, e)}
                  sx={{ ml: 0.5 }}
                >
                  <RefreshIcon
                    fontSize="inherit"
                    sx={
                      retestingProfileId === profile.id
                        ? {
                            animation: "spin 1s linear infinite",
                            "@keyframes spin": {
                              from: { rotate: "0deg" },
                              to: { rotate: "360deg" },
                            },
                            "@media (prefers-reduced-motion: reduce)": {
                              animation: "none",
                            },
                          }
                        : undefined
                    }
                  />
                </IconButton>
              </span>
            </Tooltip>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          onClick={() => {
            setProfileAnchor(null);
            setConnectionDialogOpen(true);
          }}
        >
          <ListItemText primary="Manage profiles…" />
          <SettingsIcon fontSize="small" sx={{ ml: 1, color: "text.secondary" }} />
        </MenuItem>
      </Menu>
      <Snackbar
        open={Boolean(profileFeedback)}
        autoHideDuration={4000}
        onClose={() => setProfileFeedback(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Alert
          severity={profileFeedback?.severity ?? "success"}
          onClose={() => setProfileFeedback(null)}
          sx={{ width: "100%" }}
        >
          {profileFeedback?.message}
        </Alert>
      </Snackbar>
    </>
  );
}
