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
  mobile?: boolean;
  onNavigate?: () => void;
  onRequestReset?: () => void;
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
        display: "flex",
        flexShrink: 0,
        flexDirection: "column",
        width: mobile ? 260 : isCollapsed ? 68 : 200,
        overflow: "auto",
        borderRight: mobile ? 0 : 1,
        borderColor: "border.subtle",
        bgcolor: "background.paper",
        transition: (theme) =>
          theme.transitions.create("width", { duration: theme.transitions.duration.shorter }),
      }}
    >
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
          (item) => !isHiddenByCapability(item, capabilities),
        );
        if (visibleItems.length === 0) return null;
        return (
          <Box key={section.label} sx={{ pt: 1 }}>
            {!isCollapsed && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  py: 0.5,
                  px: 2,
                  color: "text.secondary",
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  fontSize: "0.6875rem",
                }}
              >
                {section.label}
              </Typography>
            )}
            <List dense={!mobile} disablePadding>
              {visibleItems.map((item) => {
                const itemPath = PAGE_MANIFEST[item.page].path;
                const isActive =
                  location.pathname === itemPath || location.pathname.startsWith(`${itemPath}/`);
                const isDisabled = item.requiresConnection && !connected;
                const button = (
                  <ListItemButton
                    selected={isActive}
                    disabled={isDisabled}
                    onClick={() => {
                      navigate(PAGE_MANIFEST[item.page].path);
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
          </Box>
        );
      })}
      {hiddenCount > 0 && (
        <Box
          sx={{
            display: "flex",
            justifyContent: isCollapsed ? "center" : "flex-start",
            py: 1,
            px: isCollapsed ? 0 : 2,
          }}
        >
          <Tooltip
            title={`${hiddenCount} nav ${hiddenCount === 1 ? "item" : "items"} hidden due to insufficient permissions`}
            placement={isCollapsed ? "right" : "top"}
          >
            <WarningAmberIcon
              fontSize="small"
              titleAccess={`${hiddenCount} nav ${hiddenCount === 1 ? "item" : "items"} hidden due to insufficient permissions`}
              sx={{ color: "text.secondary" }}
            />
          </Tooltip>
        </Box>
      )}
      <Divider />
      <Box
        sx={{
          display: "flex",
          gap: 0.5,
          justifyContent: isCollapsed ? "center" : "flex-start",
          mt: "auto",
          p: 1,
        }}
      >
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
