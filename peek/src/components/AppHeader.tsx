import { useState, useCallback, useEffect, useRef } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
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

const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

export default function AppHeader() {
  const {
    connected,
    dashboard,
    setTimeRange,
    setRefreshInterval,
    setEditingPanelId,
    addPanel,
    exportDashboard,
    importDashboard,
    loadDefaultDashboard,
  } = useDashboardStore(
    useShallow((s) => ({
      connected: s.connected,
      dashboard: s.dashboard,
      setTimeRange: s.setTimeRange,
      setRefreshInterval: s.setRefreshInterval,
      setEditingPanelId: s.setEditingPanelId,
      addPanel: s.addPanel,
      exportDashboard: s.exportDashboard,
      importDashboard: s.importDashboard,
      loadDefaultDashboard: s.loadDefaultDashboard,
    })),
  );

  const [timeAnchor, setTimeAnchor] = useState<null | HTMLElement>(null);
  const [refreshAnchor, setRefreshAnchor] = useState<null | HTMLElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const refreshInterval = dashboard.refreshInterval ?? DEFAULT_REFRESH_INTERVAL;
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
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            lineHeight: 1,
            mr: 2,
          }}
        >
          Peek
        </Typography>

        <Box sx={{ flex: 1 }} />

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

        {connected && (
          <>
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              aria-label="Dashboard actions"
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
            >
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
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}
