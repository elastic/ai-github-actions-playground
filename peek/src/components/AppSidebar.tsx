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
import { useState } from "react";
import { useDashboardStore } from "../store/useDashboardStore";

type Page =
  | "dashboard"
  | "discover"
  | "dataStreams"
  | "explore"
  | "docs"
  | "console"
  | "chat"
  | "settings"
  | "clusterOverview";

interface NavItem {
  label: string;
  page: Page;
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

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Workspace",
    items: [
      {
        label: "Dashboard",
        page: "dashboard",
        icon: <DashboardIcon fontSize="small" />,
        requiresConnection: true,
      },
      {
        label: "Query Lab",
        page: "discover",
        icon: <SearchIcon fontSize="small" />,
        requiresConnection: true,
      },
      {
        label: "Metrics",
        page: "explore",
        icon: <ExploreIcon fontSize="small" />,
        requiresConnection: true,
      },
      {
        label: "Console",
        page: "console",
        icon: <TerminalIcon fontSize="small" />,
        requiresConnection: true,
      },
      {
        label: "Chat",
        page: "chat",
        icon: <ChatIcon fontSize="small" />,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Cluster Overview",
        page: "clusterOverview",
        icon: <InfoIcon fontSize="small" />,
        requiresConnection: true,
      },
      {
        label: "Data Streams",
        page: "dataStreams",
        icon: <DatasetIcon fontSize="small" />,
        requiresConnection: true,
      },
    ],
  },
  {
    label: "Help",
    items: [
      {
        label: "Docs",
        page: "docs",
        icon: <MenuBookIcon fontSize="small" />,
      },
    ],
  },
];

export default function AppSidebar({ collapsed = false, onToggleCollapse }: AppSidebarProps) {
  const connected = useDashboardStore((s) => s.connected);
  const themeMode = useDashboardStore((s) => s.themeMode);
  const currentPage = useDashboardStore((s) => s.currentPage);
  const setCurrentPage = useDashboardStore((s) => s.setCurrentPage);
  const setConnectionDialogOpen = useDashboardStore((s) => s.setConnectionDialogOpen);
  const setThemeMode = useDashboardStore((s) => s.setThemeMode);
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);

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
              const isActive = currentPage === item.page;
              const isDisabled = item.requiresConnection && !connected;
              const navButton = (
                <ListItemButton
                  selected={isActive}
                  disabled={isDisabled}
                  onClick={() => setCurrentPage(item.page)}
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
            color={currentPage === "settings" ? "primary" : "default"}
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
          selected={currentPage === "settings"}
          onClick={() => {
            setCurrentPage("settings");
            setSettingsAnchor(null);
          }}
        >
          LLM Settings
        </MenuItem>
      </Menu>
    </Box>
  );
}
