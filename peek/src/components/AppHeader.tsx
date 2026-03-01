import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import { useShallow } from "zustand/react/shallow";

import { useDashboardStore } from "../store/useDashboardStore";
import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { PAGE_MANIFEST } from "../routes/manifest";
import { DEFAULT_REFRESH_INTERVAL } from "../types";
import { createDefaultPanel } from "../dashboards/panel";

import ConnectionProfileSwitcher from "./ConnectionProfileSwitcher";
import DateRangePicker from "./DateRangePicker";
import RefreshIntervalPicker from "./RefreshIntervalPicker";
import TimeZonePicker from "./TimeZonePicker";

const REFRESH_INTERVAL_PRESETS = [
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
    dashboard,
    setTimeRange,
    setRefreshInterval,
    setTimeZone,
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
      setTimeZone: s.setTimeZone,
      addPanel: s.addPanel,
      historyPast: s.historyPast,
      historyFuture: s.historyFuture,
      undoDashboardChange: s.undoDashboardChange,
      redoDashboardChange: s.redoDashboardChange,
    })),
  );
  const { connected } = useConnectionStore(
    useShallow((s) => ({
      connected: s.connected,
    })),
  );
  const { setEditingPanelId, setCommandPaletteOpen } = useUIStore(
    useShallow((s) => ({
      setEditingPanelId: s.setEditingPanelId,
      setCommandPaletteOpen: s.setCommandPaletteOpen,
    })),
  );

  const location = useLocation();
  const navigate = useNavigate();
  const activePage = Object.values(PAGE_MANIFEST).find((page) => page.path === location.pathname);
  const isDashboardView =
    location.pathname.startsWith("/dashboards/") && location.pathname !== "/dashboards";
  const showTimeControls = connected && (Boolean(activePage?.showTimeControls) || isDashboardView);

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
    const newPanel = createDefaultPanel();
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
            mr: 1,
          }}
        >
          Peek
        </Typography>
        {isDashboardView ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mr: 1 }}>
            <Chip
              label="Dashboards"
              size="small"
              variant="outlined"
              clickable
              onClick={() => navigate("/dashboards")}
            />
            <Typography variant="body2" color="text.secondary">
              /
            </Typography>
            <Chip
              label={dashboard.title}
              size="small"
              variant="outlined"
              sx={{
                maxWidth: 220,
                "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
              }}
            />
          </Box>
        ) : activePage ? (
          <Chip
            label={activePage.nav.label}
            size="small"
            variant="outlined"
            sx={{
              maxWidth: 220,
              mr: 1,
              "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
            }}
          />
        ) : null}

        <ConnectionProfileSwitcher />

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
            <DateRangePicker
              value={dashboard.timeRange}
              onChange={setTimeRange}
              timeZone={dashboard.timeZone}
            />
            <TimeZonePicker value={dashboard.timeZone} onChange={setTimeZone} />
            <RefreshIntervalPicker
              value={refreshInterval}
              options={REFRESH_INTERVAL_PRESETS}
              onChange={setRefreshInterval}
            />

            {isDashboardView && (
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
