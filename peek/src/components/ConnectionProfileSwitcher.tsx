import { useState, useCallback, type MouseEvent } from "react";
import Chip from "@mui/material/Chip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import SettingsIcon from "@mui/icons-material/Settings";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import RefreshIcon from "@mui/icons-material/Refresh";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import type { ProfileHealth } from "../types";

function ProfileHealthBadge({ health }: { health: ProfileHealth | undefined }) {
  if (!health || health.status === "unknown") return null;
  if (health.status === "healthy") {
    return (
      <Tooltip title="Healthy">
        <CheckCircleIcon
          fontSize="small"
          titleAccess="Healthy"
          sx={{ flexShrink: 0, ml: 0.5, color: "success.main" }}
        />
      </Tooltip>
    );
  }
  return (
    <Tooltip title={health.errorSummary ?? "Connection failed"}>
      <WarningAmberIcon
        fontSize="small"
        titleAccess={health.errorSummary ?? "Connection failed"}
        sx={{ flexShrink: 0, ml: 0.5, color: "warning.main" }}
      />
    </Tooltip>
  );
}

export default function ConnectionProfileSwitcher() {
  const {
    connected,
    connectionProfiles,
    activeProfileId,
    profileHealthMap,
    switchConnectionProfile,
    retestConnectionProfile,
  } = useConnectionStore(
    useShallow((s) => ({
      connected: s.connected,
      connectionProfiles: s.connectionProfiles,
      activeProfileId: s.activeProfileId,
      profileHealthMap: s.profileHealthMap,
      switchConnectionProfile: s.switchConnectionProfile,
      retestConnectionProfile: s.retestConnectionProfile,
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

  const activeProfile = connectionProfiles.find((p) => p.id === activeProfileId);

  const handleSwitchProfile = useCallback(
    async (profileId: string) => {
      if (switchingProfile) return;
      const profile = connectionProfiles.find((p) => p.id === profileId);
      if (!profile) return;
      setProfileAnchor(null);
      setSwitchingProfile(true);
      try {
        const result = await switchConnectionProfile(profileId);
        if (!result.ok) {
          console.error("Profile switch failed:", result.message);
          setConnectionDialogOpen(true);
        }
      } finally {
        setSwitchingProfile(false);
      }
    },
    [switchingProfile, connectionProfiles, switchConnectionProfile, setConnectionDialogOpen],
  );

  const handleRetestProfile = useCallback(
    async (profileId: string, e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (retestingProfileId) return;
      const profile = connectionProfiles.find((p) => p.id === profileId);
      if (!profile) return;
      setRetestingProfileId(profileId);
      try {
        const result = await retestConnectionProfile(profileId);
        if (result.ok) {
          toast.success(`"${profile.name}" is healthy`);
        } else {
          toast.error(`"${profile.name}" failed: ${result.message}`);
        }
      } finally {
        setRetestingProfileId(null);
      }
    },
    [retestingProfileId, connectionProfiles, retestConnectionProfile],
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
    </>
  );
}
