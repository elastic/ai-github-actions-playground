import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import BackupIcon from "@mui/icons-material/Backup";
import BugReportIcon from "@mui/icons-material/BugReport";
import SettingsIcon from "@mui/icons-material/Settings";
import ChatIcon from "@mui/icons-material/Chat";
import CloudIcon from "@mui/icons-material/Cloud";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DatasetIcon from "@mui/icons-material/Dataset";
import DescriptionIcon from "@mui/icons-material/Description";
import DnsIcon from "@mui/icons-material/Dns";
import ExploreIcon from "@mui/icons-material/Explore";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import InfoIcon from "@mui/icons-material/Info";
import MemoryIcon from "@mui/icons-material/Memory";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import MiscellaneousServicesIcon from "@mui/icons-material/MiscellaneousServices";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import PeopleIcon from "@mui/icons-material/People";
import PolicyIcon from "@mui/icons-material/Policy";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import QuizIcon from "@mui/icons-material/Quiz";
import SearchIcon from "@mui/icons-material/Search";
import SecurityIcon from "@mui/icons-material/Security";
import ShieldIcon from "@mui/icons-material/Shield";
import SpeedIcon from "@mui/icons-material/Speed";
import StorageIcon from "@mui/icons-material/Storage";
import SubjectIcon from "@mui/icons-material/Subject";
import TerminalIcon from "@mui/icons-material/Terminal";
import TimelineIcon from "@mui/icons-material/Timeline";
import TransformIcon from "@mui/icons-material/Transform";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import Collapse from "@mui/material/Collapse";
import ButtonBase from "@mui/material/ButtonBase";

import {
  PAGE_PATHS,
  NAV_SECTION_ORDER,
  isHiddenByCapability,
  type PageId,
  type PagePathConfig,
} from "../routes/paths";
import type { UserCapabilities } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { useThemeStore } from "../store/useThemeStore";
import { useUIStore } from "../store/useUIStore";

interface NavItem {
  label: string;
  page: PageId;
  icon: React.ReactNode;
  requiresConnection?: boolean;
  requiredCapability?: keyof UserCapabilities;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface AppSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobile?: boolean;
  onNavigate?: () => void;
  onRequestReset?: () => void;
}

const NAV_ICON_COMPONENTS = {
  AccountTreeIcon,
  AdminPanelSettingsIcon,
  BackupIcon,
  BugReportIcon,
  ChatIcon,
  CloudIcon,
  DashboardIcon,
  DatasetIcon,
  DescriptionIcon,
  DnsIcon,
  ExploreIcon,
  HealthAndSafetyIcon,
  InfoIcon,
  MemoryIcon,
  MenuBookIcon,
  MiscellaneousServicesIcon,
  PendingActionsIcon,
  PeopleIcon,
  PolicyIcon,
  QuizIcon,
  RocketLaunchIcon,
  SearchIcon,
  SecurityIcon,
  SettingsIcon,
  ShieldIcon,
  SpeedIcon,
  StorageIcon,
  SubjectIcon,
  TerminalIcon,
  TimelineIcon,
  TransformIcon,
  ViewModuleIcon,
  VpnKeyIcon,
} as const;

function renderNavIcon(iconKey: string | undefined): React.ReactNode {
  if (!iconKey) return null;
  const Icon = NAV_ICON_COMPONENTS[iconKey as keyof typeof NAV_ICON_COMPONENTS];
  return Icon ? <Icon fontSize="small" /> : null;
}

function buildNavSections(): NavSection[] {
  const groups = new Map<string, NavItem[]>();

  for (const [page, config] of Object.entries(PAGE_PATHS) as Array<[PageId, PagePathConfig]>) {
    if (!config.nav.showInSidebar) continue;
    const items = groups.get(config.nav.group) ?? [];
    items.push({
      label: config.nav.label,
      page,
      icon: renderNavIcon(config.nav.iconKey),
      requiresConnection: config.requiresConnection,
      requiredCapability: config.requiredCapability,
    });
    groups.set(config.nav.group, items);
  }

  return NAV_SECTION_ORDER.filter((group) => groups.has(group)).map((group) => ({
    label: group,
    items: groups
      .get(group)!
      .sort((a, b) => PAGE_PATHS[a.page].nav.order - PAGE_PATHS[b.page].nav.order),
  }));
}

const NAV_SECTIONS: NavSection[] = buildNavSections();

const SIDEBAR_COLLAPSED_KEY = "peek:sidebar-collapsed-sections";

function sectionLabelToId(label: string): string {
  const slug = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `nav-section-${slug || "section"}`;
}

function loadCollapsedSections(): Set<string> {
  try {
    const raw = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((value) => typeof value === "string")) {
        return new Set(parsed);
      }
    }
  } catch {
    /* ignore malformed data */
  }
  return new Set();
}

function saveCollapsedSections(collapsed: Set<string>) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify([...collapsed]));
  } catch {
    /* quota or private-browsing errors */
  }
}

export default function AppSidebar({
  collapsed = false,
  onToggleCollapse,
  mobile = false,
  onNavigate,
  onRequestReset,
}: AppSidebarProps) {
  const isCollapsed = mobile ? false : collapsed;
  const { connected, capabilities } = useConnectionStore(
    useShallow((s) => ({ connected: s.connected, capabilities: s.capabilities })),
  );
  const { themeMode, setThemeMode } = useThemeStore(
    useShallow((s) => ({
      themeMode: s.themeMode,
      setThemeMode: s.setThemeMode,
    })),
  );
  const { setConnectionDialogOpen, aiPanelOpen, setAiPanelOpen } = useUIStore(
    useShallow((s) => ({
      setConnectionDialogOpen: s.setConnectionDialogOpen,
      aiPanelOpen: s.aiPanelOpen,
      setAiPanelOpen: s.setAiPanelOpen,
    })),
  );
  const navigate = useNavigate();
  const location = useLocation();
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
  const isSettingsPath = location.pathname === PAGE_PATHS.settings.path;
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(loadCollapsedSections);

  const toggleSection = useCallback((label: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      saveCollapsedSections(next);
      return next;
    });
  }, []);

  const hiddenItems = useMemo(
    () =>
      NAV_SECTIONS.flatMap((section) =>
        section.items.filter((item) => isHiddenByCapability(item.requiredCapability, capabilities)),
      ),
    [capabilities],
  );
  const hiddenCount = hiddenItems.length;
  const hiddenLabel =
    hiddenCount > 0
      ? `${hiddenCount} nav ${hiddenCount === 1 ? "item" : "items"} hidden due to insufficient permissions: ${hiddenItems.map((i) => i.label).join(", ")}`
      : "";

  return (
    <Box
      component="nav"
      aria-label="Main navigation"
      sx={{
        display: "flex",
        flexShrink: 0,
        flexDirection: "column",
        width: mobile ? 260 : isCollapsed ? 68 : 200,
        height: mobile ? "100%" : undefined,
        minHeight: 0,
        overflow: "hidden",
        borderRight: mobile ? 0 : 1,
        borderColor: "border.subtle",
        bgcolor: "background.paper",
        transition: (theme) =>
          theme.transitions.create("width", { duration: theme.transitions.duration.shorter }),
      }}
    >
      <Box sx={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto" }}>
        {!mobile && (
          <Box
            sx={{
              display: "flex",
              justifyContent: isCollapsed ? "center" : "flex-end",
              pt: 1,
              px: 1,
            }}
          >
            <Tooltip title={isCollapsed ? "Expand navigation" : "Collapse navigation"}>
              <IconButton
                size="small"
                aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
                onClick={onToggleCollapse}
              >
                {isCollapsed ? (
                  <ChevronRightIcon fontSize="small" />
                ) : (
                  <ChevronLeftIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </Box>
        )}
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !isHiddenByCapability(item.requiredCapability, capabilities),
          );
          if (visibleItems.length === 0) return null;
          const isSectionExpanded = !collapsedSections.has(section.label);
          const sectionId = sectionLabelToId(section.label);
          return (
            <Box key={section.label} sx={{ pt: 1 }}>
              {!isCollapsed && (
                <ButtonBase
                  onClick={() => toggleSection(section.label)}
                  aria-expanded={isSectionExpanded}
                  aria-controls={sectionId}
                  sx={{
                    display: "flex",
                    width: "100%",
                    justifyContent: "space-between",
                    alignItems: "center",
                    py: 0.5,
                    px: 2,
                    textAlign: "left",
                    borderRadius: 0.5,
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      fontSize: "0.6875rem",
                    }}
                  >
                    {section.label}
                  </Typography>
                  <ExpandMoreIcon
                    sx={{
                      fontSize: 16,
                      color: "text.secondary",
                      transform: isSectionExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: (theme) =>
                        theme.transitions.create("transform", {
                          duration: theme.transitions.duration.shortest,
                        }),
                    }}
                  />
                </ButtonBase>
              )}
              <Collapse in={isCollapsed || isSectionExpanded} id={sectionId}>
                <List dense={!mobile} disablePadding>
                  {visibleItems.map((item) => {
                    const itemPath = PAGE_PATHS[item.page].path;
                    const isActive =
                      location.pathname === itemPath ||
                      location.pathname.startsWith(`${itemPath}/`);
                    const isDisabled = item.requiresConnection && !connected;
                    const button = (
                      <ListItemButton
                        selected={isActive}
                        disabled={isDisabled}
                        onClick={() => {
                          navigate(PAGE_PATHS[item.page].path);
                          onNavigate?.();
                        }}
                        aria-current={isActive ? "page" : undefined}
                        aria-label={item.label}
                        sx={{
                          position: "relative",
                          justifyContent: isCollapsed ? "center" : "flex-start",
                          mx: 0.5,
                          py: mobile ? 1.125 : 0.75,
                          px: isCollapsed ? 1 : 2,
                          borderRadius: 1,
                          "&.Mui-selected": {
                            bgcolor: "action.selected",
                            "&::before": {
                              position: "absolute",
                              top: "25%",
                              bottom: "25%",
                              left: 0,
                              width: 3,
                              borderRadius: 1,
                              bgcolor: "primary.main",
                              content: '""',
                            },
                            "&:hover": { bgcolor: "action.selected" },
                          },
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: isCollapsed ? 0 : 32,
                            color: isActive ? "primary.main" : "inherit",
                          }}
                        >
                          {item.icon}
                        </ListItemIcon>
                        {!isCollapsed && (
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{
                              fontSize: "0.875rem",
                              fontWeight: isActive ? 600 : 400,
                              color: isActive ? "primary.main" : "inherit",
                            }}
                          />
                        )}
                      </ListItemButton>
                    );
                    return (
                      <ListItem key={item.page} disablePadding>
                        {isCollapsed ? (
                          <Tooltip title={item.label} placement="right">
                            {button}
                          </Tooltip>
                        ) : (
                          button
                        )}
                      </ListItem>
                    );
                  })}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </Box>
      <Divider />
      <Box
        sx={{
          display: "flex",
          gap: 0.5,
          justifyContent: isCollapsed ? "center" : "flex-start",
          alignItems: "center",
          p: 1,
        }}
      >
        <Tooltip title="Settings" placement={isCollapsed ? "right" : "top"}>
          <IconButton
            size={mobile ? "medium" : "small"}
            color={isSettingsPath ? "primary" : "default"}
            aria-label="Settings"
            onClick={(e) => setSettingsAnchor(e.currentTarget)}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="AI Assistant" placement={isCollapsed ? "right" : "top"}>
          <IconButton
            size={mobile ? "medium" : "small"}
            color={aiPanelOpen ? "primary" : "default"}
            aria-label="Toggle AI assistant panel"
            onClick={() => setAiPanelOpen(!aiPanelOpen)}
          >
            <ChatIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        {hiddenCount > 0 && (
          <Tooltip title={hiddenLabel} placement={isCollapsed ? "right" : "top"}>
            <WarningAmberIcon
              fontSize="small"
              titleAccess={hiddenLabel}
              sx={{ color: "text.secondary" }}
            />
          </Tooltip>
        )}
      </Box>
      <Menu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={() => setSettingsAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setConnectionDialogOpen(true);
            setSettingsAnchor(null);
          }}
        >
          Connection Settings
        </MenuItem>
        <MenuItem
          onClick={() => {
            setThemeMode(themeMode === "dark" ? "light" : "dark");
            setSettingsAnchor(null);
          }}
        >
          Dark/Light Mode
        </MenuItem>
        <MenuItem
          selected={location.pathname === PAGE_PATHS.settings.path}
          onClick={() => {
            navigate(PAGE_PATHS.settings.path);
            onNavigate?.();
            setSettingsAnchor(null);
          }}
        >
          LLM Settings
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            onRequestReset?.();
            setSettingsAnchor(null);
          }}
          sx={{ color: "error.main" }}
        >
          Reset All State…
        </MenuItem>
      </Menu>
    </Box>
  );
}
