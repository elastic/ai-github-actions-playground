import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import DashboardIcon from "@mui/icons-material/Dashboard";
import SearchIcon from "@mui/icons-material/Search";
import ExploreIcon from "@mui/icons-material/Explore";
import TerminalIcon from "@mui/icons-material/Terminal";
import ChatIcon from "@mui/icons-material/Chat";
import DatasetIcon from "@mui/icons-material/Dataset";
import InfoIcon from "@mui/icons-material/Info";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SettingsIcon from "@mui/icons-material/Settings";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TimelineIcon from "@mui/icons-material/Timeline";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { PAGE_MANIFEST, NAV_SECTION_ORDER, type PageId } from "../routes/manifest";
import { useDashboardStore } from "../store/useDashboardStore";

interface NavItem {
  label: string;
  page: PageId;
  icon: React.ReactNode;
  requiresConnection?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface AppSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const NAV_ICONS: Record<PageId, React.ReactNode> = {
  dashboard: <DashboardIcon fontSize="small" />,
  discover: <SearchIcon fontSize="small" />,
  explore: <ExploreIcon fontSize="small" />,
  traces: <TimelineIcon fontSize="small" />,
  console: <TerminalIcon fontSize="small" />,
  chat: <ChatIcon fontSize="small" />,
  clusterOverview: <InfoIcon fontSize="small" />,
  dataStreams: <DatasetIcon fontSize="small" />,
  docs: <MenuBookIcon fontSize="small" />,
  settings: <SettingsIcon fontSize="small" />,
  dashboardManagement: <SettingsIcon fontSize="small" />,
};

function buildNavSections(): NavSection[] {
  const groups = new Map<string, NavItem[]>();

  for (const [page, config] of Object.entries(PAGE_MANIFEST) as Array<
    [PageId, (typeof PAGE_MANIFEST)[PageId]]
  >) {
    if (!config.nav.showInSidebar) continue;
    const items = groups.get(config.nav.group) ?? [];
    items.push({
      label: config.nav.label,
      page,
      icon: NAV_ICONS[page],
      requiresConnection: config.requiresConnection,
    });
    groups.set(config.nav.group, items);
  }

  return NAV_SECTION_ORDER.filter((group) => groups.has(group)).map((group) => ({
    label: group,
    items: groups
      .get(group)!
      .sort((a, b) => PAGE_MANIFEST[a.page].nav.order - PAGE_MANIFEST[b.page].nav.order),
  }));
}

const NAV_SECTIONS: NavSection[] = buildNavSections();

export default function AppSidebar({ collapsed = false, onToggleCollapse }: AppSidebarProps) {
  const connected = useDashboardStore((s) => s.connected);
  const themeMode = useDashboardStore((s) => s.themeMode);
  const setConnectionDialogOpen = useDashboardStore((s) => s.setConnectionDialogOpen);
  const setThemeMode = useDashboardStore((s) => s.setThemeMode);
  const navigate = useNavigate();
  const location = useLocation();
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
  const isSettingsPath =
    location.pathname === PAGE_MANIFEST.settings.path ||
    location.pathname === PAGE_MANIFEST.dashboardManagement.path;

  return (
    <Box
      component="nav"
      aria-label="Main navigation"
      sx={{
        width: collapsed ? 68 : 200,
        flexShrink: 0,
        borderRight: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
        transition: (theme) =>
          theme.transitions.create("width", { duration: theme.transitions.duration.shorter }),
      }}
    >
      <Box
        sx={{ display: "flex", justifyContent: collapsed ? "center" : "flex-end", px: 1, pt: 1 }}
      >
        <Tooltip title={collapsed ? "Expand navigation" : "Collapse navigation"}>
          <IconButton
            size="small"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={onToggleCollapse}
          >
            {collapsed ? (
              <ChevronRightIcon fontSize="small" />
            ) : (
              <ChevronLeftIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>
      {NAV_SECTIONS.map((section) => (
        <Box key={section.label} sx={{ pt: 1 }}>
          {!collapsed && (
            <Typography
              variant="caption"
              sx={{
                px: 2,
                py: 0.5,
                display: "block",
                color: "text.secondary",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontSize: "0.65rem",
              }}
            >
              {section.label}
            </Typography>
          )}
          <List dense disablePadding>
            {section.items.map((item) => {
              const isActive = location.pathname === PAGE_MANIFEST[item.page].path;
              const isDisabled = item.requiresConnection && !connected;
              const navButton = (
                <ListItemButton
                  key={item.page}
                  selected={isActive}
                  disabled={isDisabled}
                  onClick={() => navigate(PAGE_MANIFEST[item.page].path)}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                  sx={{
                    px: collapsed ? 1 : 2,
                    py: 0.75,
                    borderRadius: 1,
                    mx: 0.5,
                    justifyContent: collapsed ? "center" : "flex-start",
                    "&.Mui-selected": {
                      bgcolor: "action.selected",
                      "&:hover": { bgcolor: "action.selected" },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 0 : 32,
                      color: isActive ? "primary.main" : "inherit",
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {!collapsed && (
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
              return collapsed ? (
                <Tooltip key={item.page} title={item.label} placement="right">
                  {navButton}
                </Tooltip>
              ) : (
                navButton
              );
            })}
          </List>
        </Box>
      ))}
      <Box
        sx={{
          mt: "auto",
          p: 1,
          display: "flex",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        <Tooltip title="Settings" placement={collapsed ? "right" : "top"}>
          <IconButton
            size="small"
            color={isSettingsPath ? "primary" : "default"}
            aria-label="Settings"
            onClick={(e) => setSettingsAnchor(e.currentTarget)}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
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
          selected={location.pathname === PAGE_MANIFEST.settings.path}
          onClick={() => {
            navigate(PAGE_MANIFEST.settings.path);
            setSettingsAnchor(null);
          }}
        >
          LLM Settings
        </MenuItem>
        <MenuItem
          selected={location.pathname === PAGE_MANIFEST.dashboardManagement.path}
          onClick={() => {
            navigate(PAGE_MANIFEST.dashboardManagement.path);
            setSettingsAnchor(null);
          }}
        >
          Dashboard Management
        </MenuItem>
      </Menu>
    </Box>
  );
}
