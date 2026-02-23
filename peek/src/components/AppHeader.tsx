import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import RefreshIcon from "@mui/icons-material/Refresh";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import { useShallow } from "zustand/react/shallow";

import { useDashboardStore } from "../store/useDashboardStore";
import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { PAGE_MANIFEST } from "../routes/manifest";
import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import type { ProfileHealth, TimeRange } from "../types";
import { DEFAULT_REFRESH_INTERVAL } from "../types";

const TIME_PRESETS: Array<{ label: string; range: TimeRange }> = [
  { label: "Last 15m", range: { from: "now-15m", to: "now" } },
  { label: "Last 1h", range: { from: "now-1h", to: "now" } },
  { label: "Last 4h", range: { from: "now-4h", to: "now" } },
  { label: "Last 24h", range: { from: "now-24h", to: "now" } },
  { label: "Last 7d", range: { from: "now-7d", to: "now" } },
  { label: "Last 30d", range: { from: "now-30d", to: "now" } },
];

const REFRESH_INTERVAL_PRESETS: Array<{ label: string; seconds: number }> = [
  { label: "Off", seconds: 0 },
  { label: "10s", seconds: 10 },
  { label: "15s", seconds: 15 },
  { label: "30s", seconds: 30 },
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
];

const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

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

export default function AppHeader() {
  const {
    dashboard,
    setTimeRange,
    setRefreshInterval,
    addPanel,
    historyPast,
    historyFuture,
    undoDashboardChange,
    redoDashboardChange,
  } = useDashboardStore(
    useShallow((s) => ({
      dashboard: s.dashboard,
      setTimeRange: s.setTimeRange,
      setRefreshInterval: s.setRefreshInterval,
      addPanel: s.addPanel,
      historyPast: s.historyPast,
      historyFuture: s.historyFuture,
      undoDashboardChange: s.undoDashboardChange,
      redoDashboardChange: s.redoDashboardChange,
    })),
  );
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
  const { setEditingPanelId, setConnectionDialogOpen, setCommandPaletteOpen } = useUIStore(
    useShallow((s) => ({
      setEditingPanelId: s.setEditingPanelId,
      setConnectionDialogOpen: s.setConnectionDialogOpen,
      setCommandPaletteOpen: s.setCommandPaletteOpen,
    })),
  );

  const location = useLocation();
  const [timeAnchor, setTimeAnchor] = useState<null | HTMLElement>(null);
  const [refreshAnchor, setRefreshAnchor] = useState<null | HTMLElement>(null);
  const [profileAnchor, setProfileAnchor] = useState<null | HTMLElement>(null);
  const [switchingProfile, setSwitchingProfile] = useState(false);
  const [retestingProfileId, setRetestingProfileId] = useState<string | null>(null);
  const [profileFeedback, setProfileFeedback] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);
  const activePage = Object.values(PAGE_MANIFEST).find((page) => page.path === location.pathname);
  const showTimeControls = connected && Boolean(activePage?.showTimeControls);

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
        const client = new ElasticsearchClient(conn);
        await client.getClusterInfo();
        const caps = await client.getCapabilities();
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
        setConnected(false);
        setCapabilities(null);
        setConnection(conn);
        setActiveProfileId(profileId);
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
    async (profileId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (retestingProfileId) return;
      const profile = connectionProfiles.find((p) => p.id === profileId);
      if (!profile) return;
      setRetestingProfileId(profileId);
      try {
        const client = new ElasticsearchClient(profile.connection);
        await client.getClusterInfo();
        await client.getCapabilities();
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

  const refreshInterval = dashboard.refreshInterval ?? DEFAULT_REFRESH_INTERVAL;
  const timeRangeRef = useRef(dashboard.timeRange);
  useEffect(() => {
    timeRangeRef.current = dashboard.timeRange;
  }, [dashboard.timeRange]);

  useEffect(() => {
    if (!refreshInterval || !showTimeControls) return;
    const id = setInterval(() => {
      // Spread into a new object so PanelContainers detect the change and re-fetch
      setTimeRange({ ...timeRangeRef.current });
    }, refreshInterval * 1000);
    return () => clearInterval(id);
  }, [refreshInterval, showTimeControls, setTimeRange]);

  const handleAddPanel = useCallback(() => {
    const newPanel = {
      id: crypto.randomUUID(),
      title: "New Panel",
      query: "FROM logs-* | STATS count = COUNT(*) BY @timestamp | SORT @timestamp | LIMIT 50",
      visualization: "timeseries" as const,
      layout: { x: 0, y: Infinity, w: 6, h: 4 },
    };
    addPanel(newPanel);
    setEditingPanelId(newPanel.id);
  }, [addPanel, setEditingPanelId]);

  return (
    <AppBar position="static" color="default" elevation={1} sx={{ zIndex: 1201 }}>
      <Toolbar disableGutters variant="dense" sx={{ gap: 1, px: 0 }}>
        <Box
          sx={{
            width: 68,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Box
            component="img"
            src={logoUrl}
            alt="Peek"
            sx={{ width: 48, height: 48, objectFit: "contain" }}
          />
        </Box>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            background: "linear-gradient(135deg, #0077CC 0%, #00BFB3 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
            WebkitTextFillColor: "transparent",
            lineHeight: 1,
            mr: 2,
          }}
        >
          Peek
        </Typography>

        {connected && connectionProfiles.length > 0 && (
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
        )}

        {connected ? (
          <Box sx={{ flex: 1, display: "flex", justifyContent: "center", px: 2 }}>
            <ButtonBase
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Open command palette"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                border: 1,
                borderColor: "divider",
                bgcolor: "action.hover",
                maxWidth: 360,
                width: "100%",
                justifyContent: "flex-start",
                "&:hover": { borderColor: "text.secondary" },
              }}
            >
              <SearchIcon sx={{ fontSize: "1rem", color: "text.secondary" }} />
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", flex: 1, textAlign: "left", fontSize: "0.8rem" }}
              >
                Search commands…
              </Typography>
              <Chip
                label="Ctrl/Cmd+K"
                size="small"
                variant="outlined"
                sx={{ fontSize: "0.65rem", height: 20 }}
              />
            </ButtonBase>
          </Box>
        ) : (
          <Box sx={{ flex: 1 }} />
        )}

        {showTimeControls && (
          <>
            <Button size="small" variant="outlined" onClick={(e) => setTimeAnchor(e.currentTarget)}>
              {TIME_PRESETS.find(
                (p) =>
                  p.range.from === dashboard.timeRange.from &&
                  p.range.to === dashboard.timeRange.to,
              )?.label ?? `${dashboard.timeRange.from} → ${dashboard.timeRange.to}`}
            </Button>
            <Menu
              anchorEl={timeAnchor}
              open={Boolean(timeAnchor)}
              onClose={() => setTimeAnchor(null)}
            >
              {TIME_PRESETS.map((preset) => (
                <MenuItem
                  key={preset.label}
                  selected={
                    preset.range.from === dashboard.timeRange.from &&
                    preset.range.to === dashboard.timeRange.to
                  }
                  onClick={() => {
                    setTimeRange(preset.range);
                    setTimeAnchor(null);
                  }}
                >
                  {preset.label}
                </MenuItem>
              ))}
            </Menu>

            <Button
              size="small"
              variant="outlined"
              onClick={(e) => setRefreshAnchor(e.currentTarget)}
            >
              {REFRESH_INTERVAL_PRESETS.find((p) => p.seconds === refreshInterval)?.label ??
                `${refreshInterval}s`}
            </Button>
            <Menu
              anchorEl={refreshAnchor}
              open={Boolean(refreshAnchor)}
              onClose={() => setRefreshAnchor(null)}
            >
              {REFRESH_INTERVAL_PRESETS.map((preset) => (
                <MenuItem
                  key={preset.label}
                  selected={preset.seconds === refreshInterval}
                  onClick={() => {
                    setRefreshInterval(preset.seconds);
                    setRefreshAnchor(null);
                  }}
                >
                  {preset.label}
                </MenuItem>
              ))}
            </Menu>

            {location.pathname === PAGE_MANIFEST.dashboard.path && (
              <>
                <Tooltip
                  title={
                    historyPast.length > 0
                      ? `Undo: ${historyPast[historyPast.length - 1]?.label ?? ""}`
                      : "Nothing to undo"
                  }
                >
                  <span>
                    <IconButton
                      size="small"
                      aria-label="Undo"
                      disabled={historyPast.length === 0}
                      onClick={undoDashboardChange}
                    >
                      <UndoIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip
                  title={
                    historyFuture.length > 0
                      ? `Redo: ${historyFuture[0]?.label ?? ""}`
                      : "Nothing to redo"
                  }
                >
                  <span>
                    <IconButton
                      size="small"
                      aria-label="Redo"
                      disabled={historyFuture.length === 0}
                      onClick={redoDashboardChange}
                    >
                      <RedoIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddPanel}
                >
                  Add Panel
                </Button>
              </>
            )}
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}
