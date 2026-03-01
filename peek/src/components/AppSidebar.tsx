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
import SettingsIcon from "@mui/icons-material/Settings";
import ChatIcon from "@mui/icons-material/Chat";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import { PAGE_MANIFEST, NAV_SECTION_ORDER, type PageId, type PageConfig } from "../routes/manifest";
import type { UserCapabilities } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
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
}

function buildNavSections(): NavSection[] {
  const groups = new Map<string, NavItem[]>();

  for (const [page, config] of Object.entries(PAGE_MANIFEST) as Array<[PageId, PageConfig]>) {
    if (!config.nav.showInSidebar) continue;
    const items = groups.get(config.nav.group) ?? [];
    items.push({
      label: config.nav.label,
      page,
      icon: config.nav.icon,
      requiresConnection: config.requiresConnection,
      requiredCapability: config.requiredCapability,
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

/** Returns true when we positively know the user lacks a required capability. */
function isHiddenByCapability(item: NavItem, capabilities: UserCapabilities | null): boolean {
  if (!item.requiredCapability) return false;
  if (!capabilities) return false; // not yet fetched — keep visible
  return !capabilities[item.requiredCapability];
}

export default function AppSidebar({ collapsed = false, onToggleCollapse }: AppSidebarProps) {
  const { connected, capabilities } = useConnectionStore(
    useShallow((s) => ({ connected: s.connected, capabilities: s.capabilities })),
  );
  const { themeMode, setConnectionDialogOpen, setThemeMode, aiPanelOpen, setAiPanelOpen } =
    useUIStore(
      useShallow((s) => ({
        themeMode: s.themeMode,
        setConnectionDialogOpen: s.setConnectionDialogOpen,
        setThemeMode: s.setThemeMode,
        aiPanelOpen: s.aiPanelOpen,
        setAiPanelOpen: s.setAiPanelOpen,
      })),
    );
  const navigate = useNavigate();
  const location = useLocation();
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
  const isSettingsPath = location.pathname === PAGE_MANIFEST.settings.path;

  const hiddenCount = useMemo(
    () =>
      NAV_SECTIONS.reduce(
        (count, section) =>
          count + section.items.filter((item) => isHiddenByCapability(item, capabilities)).length,
        0,
      ),
    [capabilities],
  );

  return (
    <Box
      component="nav"
      aria-label="Main navigation"
      sx={{
        width: collapsed ? 68 : 200,
        flexShrink: 0,
        borderRight: 1,
        borderColor: "border.subtle",
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
      {NAV_SECTIONS.map((section) => {
        const visibleItems = section.items.filter(
          (item) => !isHiddenByCapability(item, capabilities),
        );
        if (visibleItems.length === 0) return null;
        return (
          <Box key={section.label} sx={{ pt: 1 }}>
            {!collapsed && (
              <Typography
                variant="overline"
                sx={{
                  px: 2,
                  py: 0.5,
                  display: "block",
                  color: "text.secondary",
                }}
              >
                {section.label}
              </Typography>
            )}
            <List dense disablePadding>
              {visibleItems.map((item) => {
                const itemPath = PAGE_MANIFEST[item.page].path;
                const isActive =
                  location.pathname === itemPath || location.pathname.startsWith(`${itemPath}/`);
                const isDisabled = item.requiresConnection && !connected;
                const button = (
                  <ListItemButton
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
                      position: "relative",
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
                return (
                  <ListItem key={item.page} disablePadding>
                    {collapsed ? (
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
          </Box>
        );
      })}
      {hiddenCount > 0 && (
        <Box
          sx={{
            px: collapsed ? 0 : 2,
            py: 1,
            display: "flex",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          <Tooltip
            title={`${hiddenCount} nav ${hiddenCount === 1 ? "item" : "items"} hidden due to insufficient permissions`}
            placement={collapsed ? "right" : "top"}
          >
            <WarningAmberIcon
              fontSize="small"
              role="img"
              aria-label={`${hiddenCount} nav ${hiddenCount === 1 ? "item" : "items"} hidden due to insufficient permissions`}
              sx={{ color: "text.secondary" }}
            />
          </Tooltip>
        </Box>
      )}
      <Divider />
      <Box
        sx={{
          mt: "auto",
          p: 1,
          display: "flex",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 0.5,
        }}
      >
        <Tooltip title="AI Assistant" placement={collapsed ? "right" : "top"}>
          <IconButton
            size="small"
            color={aiPanelOpen ? "primary" : "default"}
            aria-label="Toggle AI assistant panel"
            onClick={() => setAiPanelOpen(!aiPanelOpen)}
          >
            <ChatIcon fontSize="small" />
          </IconButton>
        </Tooltip>
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
      </Menu>
    </Box>
  );
}
