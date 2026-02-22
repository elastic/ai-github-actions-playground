import { useState, useCallback, useEffect, useRef } from "react";
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
import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";
import { useShallow } from "zustand/react/shallow";

import { useDashboardStore } from "../store/useDashboardStore";
import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import type { TimeRange } from "../types";
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

export default function AppHeader() {
  const {
    connected,
    currentPage,
    dashboard,
    connectionProfiles,
    activeProfileId,
    setTimeRange,
    setRefreshInterval,
    setEditingPanelId,
    addPanel,
    setConnection,
    setConnected,
    setCapabilities,
    setActiveProfileId,
    setConnectionDialogOpen,
  } = useDashboardStore(
    useShallow((s) => ({
      connected: s.connected,
      currentPage: s.currentPage,
      dashboard: s.dashboard,
      connectionProfiles: s.connectionProfiles,
      activeProfileId: s.activeProfileId,
      setTimeRange: s.setTimeRange,
      setRefreshInterval: s.setRefreshInterval,
      setEditingPanelId: s.setEditingPanelId,
      addPanel: s.addPanel,
      setConnection: s.setConnection,
      setConnected: s.setConnected,
      setCapabilities: s.setCapabilities,
      setActiveProfileId: s.setActiveProfileId,
      setConnectionDialogOpen: s.setConnectionDialogOpen,
    })),
  );

  const [timeAnchor, setTimeAnchor] = useState<null | HTMLElement>(null);
  const [refreshAnchor, setRefreshAnchor] = useState<null | HTMLElement>(null);
  const [profileAnchor, setProfileAnchor] = useState<null | HTMLElement>(null);
  const [switchingProfile, setSwitchingProfile] = useState(false);
  const showTimeControls =
    connected &&
    (currentPage === "dashboard" || currentPage === "discover" || currentPage === "explore");

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
      } catch (err: unknown) {
        const message = isElasticsearchError(err) ? err.message : String(err);
        console.error("Profile switch failed:", message);
        setConnected(false);
        setCapabilities(null);
        setConnection(conn);
        setActiveProfileId(profileId);
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
      setConnectionDialogOpen,
    ],
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
        )}

        <Box sx={{ flex: 1 }} />

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

            {currentPage === "dashboard" && (
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddPanel}
              >
                Add Panel
              </Button>
            )}
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}
