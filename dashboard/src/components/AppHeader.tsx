import { useState, useCallback } from "react";
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
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import { useDashboardStore } from "../store/useDashboardStore";
import type { TimeRange } from "../types";

const TIME_PRESETS: Array<{ label: string; range: TimeRange }> = [
  { label: "Last 15m", range: { from: "now-15m", to: "now" } },
  { label: "Last 1h", range: { from: "now-1h", to: "now" } },
  { label: "Last 4h", range: { from: "now-4h", to: "now" } },
  { label: "Last 24h", range: { from: "now-24h", to: "now" } },
  { label: "Last 7d", range: { from: "now-7d", to: "now" } },
  { label: "Last 30d", range: { from: "now-30d", to: "now" } },
];

export default function AppHeader() {
  const themeMode = useDashboardStore((s) => s.themeMode);
  const setThemeMode = useDashboardStore((s) => s.setThemeMode);
  const connected = useDashboardStore((s) => s.connected);
  const dashboard = useDashboardStore((s) => s.dashboard);
  const setTimeRange = useDashboardStore((s) => s.setTimeRange);
  const setDashboardTitle = useDashboardStore((s) => s.setDashboardTitle);
  const setConnectionDialogOpen = useDashboardStore((s) => s.setConnectionDialogOpen);
  const setEditingPanelId = useDashboardStore((s) => s.setEditingPanelId);
  const addPanel = useDashboardStore((s) => s.addPanel);
  const exportDashboard = useDashboardStore((s) => s.exportDashboard);
  const importDashboard = useDashboardStore((s) => s.importDashboard);
  const loadDefaultDashboard = useDashboardStore((s) => s.loadDefaultDashboard);

  const [titleEditing, setTitleEditing] = useState(false);
  const [titleValue, setTitleValue] = useState(dashboard.title);
  const [timeAnchor, setTimeAnchor] = useState<null | HTMLElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

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
          ES|QL Dashboard
        </Typography>

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
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
