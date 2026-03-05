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
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import MenuIcon from "@mui/icons-material/Menu";
import { useShallow } from "zustand/react/shallow";

import { useDashboardEditorStore } from "../store/useDashboardEditorStore";
import { useDashboardHistoryStore } from "../store/useDashboardHistoryStore";
import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { useCommandPaletteStore } from "../store/useCommandPaletteStore";
import { PAGE_MANIFEST } from "../routes/manifest";
import { DEFAULT_REFRESH_INTERVAL } from "../types";
import { COMPONENT_HEIGHTS } from "../types/tokens";
import { createDefaultPanel } from "../dashboards/panel";

import ConnectionProfileSwitcher from "./ConnectionProfileSwitcher";
import DateRangePicker from "./DateRangePicker";
import RefreshIntervalPicker from "./RefreshIntervalPicker";

const REFRESH_INTERVAL_PRESETS = [
  { label: "Off", seconds: 0 },
  { label: "10s", seconds: 10 },
  { label: "15s", seconds: 15 },
  { label: "30s", seconds: 30 },
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
];

const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

interface AppHeaderProps {
  showMobileNavToggle?: boolean;
  onToggleMobileNav?: () => void;
}

export default function AppHeader({
  showMobileNavToggle = false,
  onToggleMobileNav,
}: AppHeaderProps) {
  const { dashboard, setTimeRange, setRefreshInterval, setTimeZone, addPanel } =
    useDashboardEditorStore(
      useShallow((s) => ({
        dashboard: s.dashboard,
        setTimeRange: s.setTimeRange,
        setRefreshInterval: s.setRefreshInterval,
        setTimeZone: s.setTimeZone,
        addPanel: s.addPanel,
      })),
    );
  const { historyPast, historyFuture, undoDashboardChange, redoDashboardChange } =
    useDashboardHistoryStore(
      useShallow((s) => ({
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
  const setEditingPanelId = useUIStore((s) => s.setEditingPanelId);
  const setCommandPaletteOpen = useCommandPaletteStore((s) => s.setCommandPaletteOpen);

  const location = useLocation();
  const navigate = useNavigate();
  const activePage = Object.values(PAGE_MANIFEST).find((page) => page.path === location.pathname);
  const isDashboardView =
    location.pathname.startsWith("/dashboards/") && location.pathname !== "/dashboards";
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("md"));
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
    <AppBar position="static" color="default" sx={{ zIndex: 1201, borderColor: "border.subtle" }}>
      <Toolbar
        disableGutters
        variant={isNarrow ? "regular" : "dense"}
        sx={{ flexWrap: isNarrow ? "wrap" : "nowrap", gap: 1, px: 0.5 }}
      >
        {/* Left section: logo, title, breadcrumbs, connection switcher. flex:"1 1 0"
            balances with the right section so the center search bar stays fixed. */}
        <Box
          sx={{
            display: "flex",
            flex: "1 1 0",
            gap: 1,
            alignItems: "center",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {showMobileNavToggle && (
            <IconButton aria-label="Open navigation menu" size="small" onClick={onToggleMobileNav}>
              <MenuIcon />
            </IconButton>
          )}
          <Box
            sx={{
              display: "flex",
              flexShrink: 0,
              justifyContent: "center",
              alignItems: "center",
              width: 68,
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
            variant="subtitle1"
            sx={{
              flexShrink: 0,
              color: "primary.main",
              lineHeight: 1,
              fontWeight: 700,
            }}
          >
            Peek
          </Typography>
          {!isNarrow && isDashboardView ? (
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", overflow: "hidden" }}>
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
          ) : !isNarrow && activePage ? (
            <Chip
              label={activePage.nav.label}
              size="small"
              variant="outlined"
              sx={{
                maxWidth: 220,
                "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
              }}
            />
          ) : null}

          <ConnectionProfileSwitcher />
        </Box>

        {/* Center: search / command palette. flexShrink:0 keeps it stable. */}
        {connected && !isNarrow ? (
          <ButtonBase
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Open command palette"
            sx={{
              display: "flex",
              flexShrink: 0,
              gap: 1,
              justifyContent: "flex-start",
              alignItems: "center",
              width: "100%",
              maxWidth: 360,
              height: COMPONENT_HEIGHTS.buttonSmall,
              py: 0,
              px: 1.5,
              border: 1,
              borderColor: "border.default",
              borderRadius: 1,
              bgcolor: "background.subtle",
              "&:hover": { borderColor: "border.strong" },
            }}
          >
            <SearchIcon sx={{ color: "text.secondary", fontSize: "1rem" }} />
            <Typography
              variant="body2"
              sx={{ flex: 1, color: "text.secondary", textAlign: "left", fontSize: "0.8rem" }}
            >
              Search commands…
            </Typography>
            <Chip
              label="Ctrl/Cmd+K"
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: "0.65rem" }}
            />
          </ButtonBase>
        ) : connected && isNarrow ? (
          <Tooltip title="Search commands">
            <IconButton
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Open command palette"
              size="small"
            >
              <SearchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}

        {/* Right section: time controls. flex:"1 1 0" mirrors the left section so
            the center search bar stays at 50% of the toolbar regardless of what
            controls appear or disappear on different pages. */}
        <Box
          sx={{
            display: "flex",
            flex: "1 1 0",
            gap: 1,
            justifyContent: "flex-end",
            alignItems: "center",
            minWidth: 0,
          }}
        >
          {showTimeControls && (
            <>
              <DateRangePicker
                value={dashboard.timeRange}
                onChange={setTimeRange}
                timeZone={dashboard.timeZone}
                onTimeZoneChange={setTimeZone}
              />
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
        </Box>
      </Toolbar>
    </AppBar>
  );
}
