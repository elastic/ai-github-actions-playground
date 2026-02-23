import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import InputBase from "@mui/material/InputBase";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import SearchIcon from "@mui/icons-material/Search";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import SettingsIcon from "@mui/icons-material/Settings";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LinkIcon from "@mui/icons-material/Link";
import HistoryIcon from "@mui/icons-material/History";
import DashboardCustomizeIcon from "@mui/icons-material/DashboardCustomize";

import { PAGE_MANIFEST, type PageId } from "../routes/manifest";
import { useDashboardStore } from "../store/useDashboardStore";

interface Command {
  id: string;
  label: string;
  group: string;
  icon: React.ReactNode;
  onExecute: () => void;
  keywords?: string;
}

function useCommands(): Command[] {
  const navigate = useNavigate();
  const location = useLocation();
  const connected = useDashboardStore((s) => s.connected);
  const themeMode = useDashboardStore((s) => s.themeMode);
  const queryHistory = useDashboardStore((s) => s.queryHistory);
  const setConnectionDialogOpen = useDashboardStore((s) => s.setConnectionDialogOpen);
  const setThemeMode = useDashboardStore((s) => s.setThemeMode);
  const setCommandPaletteOpen = useDashboardStore((s) => s.setCommandPaletteOpen);
  const setDiscoverQueryDraft = useDashboardStore((s) => s.setDiscoverQueryDraft);

  return useMemo(() => {
    const commands: Command[] = [];

    // Navigation commands from PAGE_MANIFEST
    for (const [page, config] of Object.entries(PAGE_MANIFEST) as Array<
      [PageId, (typeof PAGE_MANIFEST)[PageId]]
    >) {
      if (config.requiresConnection && !connected) continue;
      if (config.path === location.pathname) continue;
      commands.push({
        id: `nav:${page}`,
        label: config.nav.label,
        group: "Navigation",
        icon: <NavigateNextIcon fontSize="small" />,
        keywords: `go to ${config.nav.label} navigate ${config.nav.group}`,
        onExecute: () => {
          setCommandPaletteOpen(false);
          navigate(config.path);
        },
      });
    }

    // Action commands
    commands.push({
      id: "action:connection",
      label: "Connection Settings",
      group: "Actions",
      icon: <LinkIcon fontSize="small" />,
      keywords: "connect disconnect elasticsearch profile",
      onExecute: () => {
        setCommandPaletteOpen(false);
        setConnectionDialogOpen(true);
      },
    });

    commands.push({
      id: "action:theme",
      label: `Switch to ${themeMode === "dark" ? "Light" : "Dark"} Mode`,
      group: "Actions",
      icon:
        themeMode === "dark" ? (
          <LightModeIcon fontSize="small" />
        ) : (
          <DarkModeIcon fontSize="small" />
        ),
      keywords: "theme dark light mode toggle appearance",
      onExecute: () => {
        setCommandPaletteOpen(false);
        setThemeMode(themeMode === "dark" ? "light" : "dark");
      },
    });

    if (connected) {
      commands.push({
        id: "action:llm-settings",
        label: "LLM Settings",
        group: "Actions",
        icon: <SettingsIcon fontSize="small" />,
        keywords: "settings language model ai llm",
        onExecute: () => {
          setCommandPaletteOpen(false);
          navigate(PAGE_MANIFEST.settings.path);
        },
      });

      commands.push({
        id: "action:dashboard-management",
        label: "Dashboard Management",
        group: "Actions",
        icon: <DashboardCustomizeIcon fontSize="small" />,
        keywords: "dashboard manage import export",
        onExecute: () => {
          setCommandPaletteOpen(false);
          navigate(PAGE_MANIFEST.dashboardManagement.path);
        },
      });
    }

    // Recent queries
    for (const [index, query] of queryHistory.entries()) {
      commands.push({
        id: `query:${index}`,
        label: query,
        group: "Recent Queries",
        icon: <HistoryIcon fontSize="small" />,
        keywords: "recent query history esql",
        onExecute: () => {
          setCommandPaletteOpen(false);
          setDiscoverQueryDraft(query);
          navigate(PAGE_MANIFEST.discover.path);
        },
      });
    }

    return commands;
  }, [
    connected,
    location.pathname,
    themeMode,
    queryHistory,
    navigate,
    setConnectionDialogOpen,
    setThemeMode,
    setCommandPaletteOpen,
    setDiscoverQueryDraft,
  ]);
}

function filterCommands(commands: Command[], search: string): Command[] {
  if (!search.trim()) return commands;
  const lower = search.toLowerCase();
  return commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(lower) ||
      cmd.group.toLowerCase().includes(lower) ||
      cmd.keywords?.toLowerCase().includes(lower),
  );
}

function groupCommands(commands: Command[]): Array<{ group: string; items: Command[] }> {
  const groups = new Map<string, Command[]>();
  for (const cmd of commands) {
    const items = groups.get(cmd.group) ?? [];
    items.push(cmd);
    groups.set(cmd.group, items);
  }
  return Array.from(groups.entries()).map(([group, items]) => ({ group, items }));
}

export default function CommandPalette() {
  const open = useDashboardStore((s) => s.commandPaletteOpen);
  const setOpen = useDashboardStore((s) => s.setCommandPaletteOpen);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commands = useCommands();

  const filtered = useMemo(() => filterCommands(commands, search), [commands, search]);
  const grouped = useMemo(() => groupCommands(filtered), [filtered]);

  // Reset state when dialog opens and focus the input
  const handleDialogEntered = useCallback(() => {
    setSearch("");
    setSelectedIndex(0);
    inputRef.current?.focus();
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setSelectedIndex(0);
  }, []);

  // Global Ctrl/Cmd+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  const handleExecute = useCallback((cmd: Command) => {
    cmd.onExecute();
    setSearch("");
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        const cmd = filtered[selectedIndex];
        if (cmd) handleExecute(cmd);
      }
    },
    [filtered, selectedIndex, handleExecute],
  );

  // Keep selected item in view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.querySelectorAll('[role="option"]')[selectedIndex];
    if (item && typeof item.scrollIntoView === "function") {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      TransitionProps={{ onEntered: handleDialogEntered }}
      maxWidth="sm"
      fullWidth
      aria-label="Command palette"
      slotProps={{
        paper: {
          sx: {
            position: "fixed",
            top: "15%",
            m: 0,
            maxHeight: "70vh",
            borderRadius: 2,
          },
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <SearchIcon sx={{ mr: 1, color: "text.secondary" }} />
        <InputBase
          inputRef={inputRef}
          fullWidth
          placeholder="Type a command or search…"
          value={search}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          inputProps={{
            "aria-label": "Search commands",
            role: "combobox",
            "aria-expanded": open,
            "aria-controls": "command-palette-list",
            "aria-activedescendant":
              filtered.length > 0 ? `command-palette-item-${selectedIndex}` : undefined,
          }}
          sx={{ fontSize: "1rem" }}
        />
        <Chip label="esc" size="small" variant="outlined" sx={{ ml: 1, fontSize: "0.7rem" }} />
      </Box>
      <DialogContent sx={{ p: 0 }}>
        {filtered.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              No matching commands
            </Typography>
          </Box>
        ) : (
          <List
            ref={listRef}
            dense
            id="command-palette-list"
            role="listbox"
            aria-label="Commands"
            sx={{ py: 0.5 }}
          >
            {grouped.map((section) => (
              <Box key={section.group}>
                <Typography
                  variant="caption"
                  sx={{
                    px: 2,
                    py: 0.75,
                    display: "block",
                    color: "text.secondary",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontSize: "0.65rem",
                  }}
                >
                  {section.group}
                </Typography>
                {section.items.map((cmd) => {
                  const flatIndex = filtered.indexOf(cmd);
                  return (
                    <ListItemButton
                      key={cmd.id}
                      id={`command-palette-item-${flatIndex}`}
                      role="option"
                      aria-selected={flatIndex === selectedIndex}
                      selected={flatIndex === selectedIndex}
                      onClick={() => handleExecute(cmd)}
                      onMouseEnter={() => setSelectedIndex(flatIndex)}
                      sx={{
                        px: 2,
                        py: 0.75,
                        mx: 0.5,
                        borderRadius: 1,
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>{cmd.icon}</ListItemIcon>
                      <ListItemText
                        primary={cmd.label}
                        primaryTypographyProps={{
                          fontSize: "0.875rem",
                          noWrap: true,
                        }}
                      />
                    </ListItemButton>
                  );
                })}
              </Box>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
