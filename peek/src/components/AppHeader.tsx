import { useState, useCallback, useEffect, useRef } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import DashboardIcon from "@mui/icons-material/Dashboard";
import SearchIcon from "@mui/icons-material/Search";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import ExploreIcon from "@mui/icons-material/Explore";
import DatasetIcon from "@mui/icons-material/Dataset";
import ChatIcon from "@mui/icons-material/Chat";
import SettingsApplicationsIcon from "@mui/icons-material/SettingsApplications";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "../store/useDashboardStore";
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

export default function AppHeader() {
  const {
    themeMode,
    setThemeMode,
    connected,
    dashboard,
    setTimeRange,
    setRefreshInterval,
    setDashboardTitle,
    setConnectionDialogOpen,
    setEditingPanelId,
    addPanel,
    exportDashboard,
    importDashboard,
    loadDefaultDashboard,
    resetState,
    currentPage,
    setCurrentPage,
  } = useDashboardStore(
    useShallow((s) => ({
      themeMode: s.themeMode,
      setThemeMode: s.setThemeMode,
      connected: s.connected,
      dashboard: s.dashboard,
      setTimeRange: s.setTimeRange,
      setRefreshInterval: s.setRefreshInterval,
      setDashboardTitle: s.setDashboardTitle,
      setConnectionDialogOpen: s.setConnectionDialogOpen,
      setEditingPanelId: s.setEditingPanelId,
      addPanel: s.addPanel,
      exportDashboard: s.exportDashboard,
      importDashboard: s.importDashboard,
      loadDefaultDashboard: s.loadDefaultDashboard,
      resetState: s.resetState,
      currentPage: s.currentPage,
      setCurrentPage: s.setCurrentPage,
    })),
  );

  const [titleEditing, setTitleEditing] = useState(false);
  const [titleValue, setTitleValue] = useState(dashboard.title);
  const [timeAnchor, setTimeAnchor] = useState<null | HTMLElement>(null);
  const [refreshAnchor, setRefreshAnchor] = useState<null | HTMLElement>(null);
  const [systemAnchor, setSystemAnchor] = useState<null | HTMLElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const refreshInterval = dashboard.refreshInterval ?? DEFAULT_REFRESH_INTERVAL;
  const tabValue = currentPage === "dataStreams" ? false : currentPage;
  const timeRangeRef = useRef(dashboard.timeRange);
  useEffect(() => {
    timeRangeRef.current = dashboard.timeRange;
  }, [dashboard.timeRange]);

  useEffect(() => {
    if (!refreshInterval || !connected) return;
    const id = setInterval(() => {
      // Spread into a new object so PanelContainers detect the change and re-fetch
      setTimeRange({ ...timeRangeRef.current });
    }, refreshInterval * 1000);
    return () => clearInterval(id);
  }, [refreshInterval, connected, setTimeRange]);

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

  const handleExport = useCallback(() => {
    const json = exportDashboard();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dashboard.title.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuAnchor(null);
  }, [exportDashboard, dashboard.title]);

  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => importDashboard(reader.result as string);
      reader.readAsText(file);
    };
    input.click();
    setMenuAnchor(null);
  }, [importDashboard]);

  return (
    <AppBar position="static" color="default" elevation={1} sx={{ zIndex: 1201 }}>
      <Toolbar variant="dense" sx={{ gap: 1 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            background: "linear-gradient(135deg, #0077CC 0%, #00BFB3 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            mr: 2,
            flexShrink: 0,
          }}
        >
          Elastic Peek
        </Typography>

        {connected && (
          <>
            {titleEditing ? (
              <TextField
                size="small"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={() => {
                  setDashboardTitle(titleValue);
                  setTitleEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setDashboardTitle(titleValue);
                    setTitleEditing(false);
                  }
                }}
                autoFocus
                sx={{ width: 240 }}
              />
            ) : (
              <Typography
                variant="subtitle1"
                sx={{ cursor: "pointer", "&:hover": { opacity: 0.8 } }}
                onClick={() => {
                  setTitleValue(dashboard.title);
                  setTitleEditing(true);
                }}
              >
                {dashboard.title}
              </Typography>
            )}
          </>
        )}

        {connected && (
          <Tabs
            value={tabValue}
            onChange={(_, v: "dashboard" | "discover" | "explore" | "docs" | "chat" | "settings") =>
              setCurrentPage(v)
            }
            sx={{ ml: 2, minHeight: 48 }}
            TabIndicatorProps={{ style: { height: 3 } }}
          >
            <Tab
              value="dashboard"
              label="Dashboard"
              icon={<DashboardIcon fontSize="small" />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: "none", fontSize: "0.875rem" }}
            />
            <Tab
              value="discover"
              label="Query Lab"
              icon={<SearchIcon fontSize="small" />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: "none", fontSize: "0.875rem" }}
            />
            <Tab
              value="explore"
              label="Metrics"
              icon={<ExploreIcon fontSize="small" />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: "none", fontSize: "0.875rem" }}
            />
            <Tab
              value="chat"
              label="Chat"
              icon={<ChatIcon fontSize="small" />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: "none", fontSize: "0.875rem" }}
            />
            <Tab
              value="docs"
              label="Docs"
              icon={<MenuBookIcon fontSize="small" />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: "none", fontSize: "0.875rem" }}
            />
            <Tab
              value="settings"
              label="Settings"
              icon={<SettingsApplicationsIcon fontSize="small" />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: "none", fontSize: "0.875rem" }}
            />
          </Tabs>
        )}

        {!connected && (
          <Tabs
            value={["chat", "docs", "settings"].includes(currentPage) ? currentPage : false}
            onChange={(_, v: "docs" | "chat" | "settings") => setCurrentPage(v)}
            sx={{ ml: 2, minHeight: 48 }}
            TabIndicatorProps={{ style: { height: 3 } }}
          >
            <Tab
              value="chat"
              label="Chat"
              icon={<ChatIcon fontSize="small" />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: "none", fontSize: "0.875rem" }}
            />
            <Tab
              value="docs"
              label="Docs"
              icon={<MenuBookIcon fontSize="small" />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: "none", fontSize: "0.875rem" }}
            />
            <Tab
              value="settings"
              label="Settings"
              icon={<SettingsApplicationsIcon fontSize="small" />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: "none", fontSize: "0.875rem" }}
            />
          </Tabs>
        )}
        {connected && (
          <>
            <Button
              size="small"
              variant={currentPage === "dataStreams" ? "contained" : "text"}
              color={currentPage === "dataStreams" ? "primary" : "inherit"}
              startIcon={<DatasetIcon fontSize="small" />}
              endIcon={<ExpandMoreIcon fontSize="small" />}
              onClick={(e) => setSystemAnchor(e.currentTarget)}
              sx={{ minHeight: 48, textTransform: "none", fontSize: "0.875rem", ml: 0.5 }}
            >
              System
            </Button>
            <Menu
              anchorEl={systemAnchor}
              open={Boolean(systemAnchor)}
              onClose={() => setSystemAnchor(null)}
            >
              <MenuItem
                selected={currentPage === "dataStreams"}
                onClick={() => {
                  setCurrentPage("dataStreams");
                  setSystemAnchor(null);
                }}
              >
                Data Streams
              </MenuItem>
            </Menu>
          </>
        )}

        <Box sx={{ flex: 1 }} />

        <Chip
          icon={connected ? <CloudDoneIcon /> : <CloudOffIcon />}
          label={connected ? "Connected" : "Disconnected"}
          color={connected ? "success" : "default"}
          size="small"
          onClick={() => setConnectionDialogOpen(true)}
          sx={{ cursor: "pointer" }}
        />

        {connected && (
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

        <Tooltip title="Connection settings">
          <IconButton size="small" onClick={() => setConnectionDialogOpen(true)}>
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title={themeMode === "dark" ? "Light mode" : "Dark mode"}>
          <IconButton
            size="small"
            onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
          >
            {themeMode === "dark" ? (
              <LightModeIcon fontSize="small" />
            ) : (
              <DarkModeIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>

        <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          <MenuItem onClick={handleExport}>Export Dashboard</MenuItem>
          <MenuItem onClick={handleImport}>Import Dashboard</MenuItem>
          <MenuItem
            onClick={() => {
              loadDefaultDashboard();
              setMenuAnchor(null);
            }}
          >
            Load Default Dashboard
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setResetDialogOpen(true);
            }}
            sx={{ color: "error.main" }}
          >
            Reset All State
          </MenuItem>
        </Menu>

        <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)}>
          <DialogTitle>Reset All State</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will clear all settings, connection details, and dashboard panels, restoring the
              application to its default state. This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
            <Button
              color="error"
              onClick={() => {
                resetState();
                setResetDialogOpen(false);
              }}
            >
              Reset
            </Button>
          </DialogActions>
        </Dialog>
      </Toolbar>
    </AppBar>
  );
}
