import { useState, useMemo, useId, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Autocomplete from "@mui/material/Autocomplete";
import type { PopperProps } from "@mui/material/Popper";
import InputBase from "@mui/material/InputBase";
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
import DashboardIcon from "@mui/icons-material/Dashboard";
import StarIcon from "@mui/icons-material/Star";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import RefreshIcon from "@mui/icons-material/Refresh";
import ChatIcon from "@mui/icons-material/Chat";
import { useShallow } from "zustand/react/shallow";

import { PAGE_MANIFEST, type PageId } from "../routes/manifest";
import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { useQueryStore } from "../store/useQueryStore";
import { useDashboardCatalogStore } from "../store/useDashboardCatalogStore";
import sections from "../docs/sections";

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
  const {
    connected,
    connectionProfiles,
    activeProfileId,
    switchConnectionProfile,
    retestConnectionProfile,
  } = useConnectionStore(
    useShallow((s) => ({
      connected: s.connected,
      connectionProfiles: s.connectionProfiles,
      activeProfileId: s.activeProfileId,
      switchConnectionProfile: s.switchConnectionProfile,
      retestConnectionProfile: s.retestConnectionProfile,
    })),
  );
  const {
    themeMode,
    setConnectionDialogOpen,
    setThemeMode,
    setCommandPaletteOpen,
    aiPanelOpen,
    setAiPanelOpen,
  } = useUIStore(
    useShallow((s) => ({
      themeMode: s.themeMode,
      setConnectionDialogOpen: s.setConnectionDialogOpen,
      setThemeMode: s.setThemeMode,
      setCommandPaletteOpen: s.setCommandPaletteOpen,
      aiPanelOpen: s.aiPanelOpen,
      setAiPanelOpen: s.setAiPanelOpen,
    })),
  );
  const { queryHistory, setDiscoverQueryDraft } = useQueryStore(
    useShallow((s) => ({
      queryHistory: s.queryHistory,
      setDiscoverQueryDraft: s.setDiscoverQueryDraft,
    })),
  );
  const dashboards = useDashboardCatalogStore((s) => s.dashboards);
  const switchingProfileRef = useRef(false);

  return useMemo(() => {
    const commands: Command[] = [];

    // Navigation commands from PAGE_MANIFEST
    for (const [page, config] of Object.entries(PAGE_MANIFEST) as Array<
      [PageId, (typeof PAGE_MANIFEST)[PageId]]
    >) {
      if (!config.nav.showInSidebar) continue;
      if (config.path.includes(":")) continue;
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

    commands.push({
      id: "action:ai-assistant",
      label: "Toggle AI Assistant",
      group: "Actions",
      icon: <ChatIcon fontSize="small" />,
      keywords: "ai assistant chat toggle open close",
      onExecute: () => {
        setCommandPaletteOpen(false);
        setAiPanelOpen(!aiPanelOpen);
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

      // Favorite dashboards group (listed before all dashboards)
      const favoriteDashboards = dashboards.filter((dash) => dash.favoritedAt);
      for (const dash of favoriteDashboards) {
        commands.push({
          id: `favorite-dashboard:${dash.id}`,
          label: dash.title,
          group: "Favorite Dashboards",
          icon: <StarIcon fontSize="small" />,
          keywords: `favorite dashboard open ${dash.title}`,
          onExecute: () => {
            setCommandPaletteOpen(false);
            navigate(`/dashboards/${dash.id}`);
          },
        });
      }

      // Per-dashboard quick navigation
      for (const dash of dashboards) {
        commands.push({
          id: `dashboard:${dash.id}`,
          label: dash.title,
          group: "Dashboards",
          icon: <DashboardIcon fontSize="small" />,
          keywords: `dashboard open ${dash.title}`,
          onExecute: () => {
            setCommandPaletteOpen(false);
            navigate(`/dashboards/${dash.id}`);
          },
        });
      }
    }

    // Connection profile commands
    if (connected && connectionProfiles.length > 0) {
      for (const profile of connectionProfiles) {
        if (profile.id !== activeProfileId) {
          commands.push({
            id: `profile:switch:${profile.id}`,
            label: `Switch to ${profile.name}`,
            group: "Connection Profiles",
            icon: <AccountCircleIcon fontSize="small" />,
            keywords: `profile switch connect ${profile.name} ${profile.connection.url}`,
            onExecute: () => {
              if (switchingProfileRef.current) return;
              setCommandPaletteOpen(false);
              switchingProfileRef.current = true;
              void (async () => {
                try {
                  const result = await switchConnectionProfile(profile.id);
                  if (!result.ok) {
                    setConnectionDialogOpen(true);
                  }
                } finally {
                  switchingProfileRef.current = false;
                }
              })();
            },
          });
        }
        commands.push({
          id: `profile:retest:${profile.id}`,
          label: `Re-test ${profile.name}`,
          group: "Connection Profiles",
          icon: <RefreshIcon fontSize="small" />,
          keywords: `profile retest health check ${profile.name} ${profile.connection.url}`,
          onExecute: () => {
            setCommandPaletteOpen(false);
            void (async () => {
              await retestConnectionProfile(profile.id);
            })();
          },
        });
      }
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

    // Docs section shortcuts
    for (const section of sections) {
      commands.push({
        id: `docs:${section.id}`,
        label: section.title,
        group: "Docs",
        icon: <MenuBookIcon fontSize="small" />,
        keywords: `docs documentation help ${section.id}`,
        onExecute: () => {
          setCommandPaletteOpen(false);
          navigate(`${PAGE_MANIFEST.docs.path}?section=${section.id}`);
        },
      });
    }

    return commands;
  }, [
    connected,
    connectionProfiles,
    activeProfileId,
    location.pathname,
    themeMode,
    aiPanelOpen,
    queryHistory,
    dashboards,
    navigate,
    setConnectionDialogOpen,
    setThemeMode,
    setCommandPaletteOpen,
    setAiPanelOpen,
    setDiscoverQueryDraft,
    switchConnectionProfile,
    retestConnectionProfile,
  ]);
}

function CommandPalettePopper({ children }: PopperProps) {
  return <Box sx={{ width: "100%" }}>{children as React.ReactNode}</Box>;
}

function CommandPalettePaper({ children }: { children?: React.ReactNode }) {
  return <DialogContent sx={{ p: 0 }}>{children}</DialogContent>;
}

export default function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const commands = useCommands();
  const listboxId = useId();

  // Focus the input once the dialog enter transition completes
  const handleDialogEntered = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Reset search after the dialog has fully exited so it is clean for the next open
  const handleDialogExited = useCallback(() => {
    setSearch("");
  }, []);

  // Global Ctrl/Cmd+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !e.repeat) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setOpen]);

  // Global Ctrl/Cmd+Shift+A shortcut to toggle AI Assistant
  const aiPanelOpen = useUIStore((s) => s.aiPanelOpen);
  const setAiPanelOpen = useUIStore((s) => s.setAiPanelOpen);
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "a" && !e.repeat) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if ((e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        setAiPanelOpen(!aiPanelOpen);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [aiPanelOpen, setAiPanelOpen]);

  const handleExecute = useCallback((cmd: Command) => {
    cmd.onExecute();
    setSearch("");
  }, []);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      TransitionProps={{ onEntered: handleDialogEntered, onExited: handleDialogExited }}
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
      <Autocomplete<Command>
        open
        disablePortal
        options={commands}
        groupBy={(option) => option.group}
        getOptionLabel={(option) => option.label}
        filterOptions={(options, { inputValue }) => {
          if (!inputValue.trim()) return options;
          const lower = inputValue.toLowerCase();
          return options.filter(
            (cmd) =>
              cmd.label.toLowerCase().includes(lower) ||
              cmd.group.toLowerCase().includes(lower) ||
              cmd.keywords?.toLowerCase().includes(lower),
          );
        }}
        value={null}
        inputValue={search}
        onInputChange={(_, value, reason) => {
          if (reason !== "reset") setSearch(value);
        }}
        onChange={(_, option) => {
          if (option) handleExecute(option);
        }}
        onClose={(_, reason) => {
          if (reason === "escape") setOpen(false);
        }}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        noOptionsText="No matching commands"
        slots={{ popper: CommandPalettePopper, paper: CommandPalettePaper }}
        slotProps={{
          listbox: { id: listboxId, "aria-label": "Commands" },
        }}
        renderInput={(params) => (
          <Box
            ref={params.InputProps.ref}
            sx={{
              display: "flex",
              alignItems: "center",
              py: 1,
              px: 2,
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <SearchIcon sx={{ mr: 1, color: "text.secondary" }} />
            <InputBase
              inputRef={inputRef}
              fullWidth
              placeholder="Type a command or search…"
              inputProps={{
                ...params.inputProps,
                "aria-label": "Search commands",
              }}
              sx={{ fontSize: "1rem" }}
            />
            <Chip label="esc" size="small" variant="outlined" sx={{ ml: 1, fontSize: "0.7rem" }} />
          </Box>
        )}
        renderGroup={(params) => (
          <Box key={params.key}>
            <Typography
              variant="caption"
              sx={{
                display: "block",
                py: 1,
                px: 2,
                color: "text.secondary",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: 600,
                fontSize: "0.65rem",
              }}
            >
              {params.group}
            </Typography>
            {params.children}
          </Box>
        )}
        renderOption={(props, option) => {
          const { key, ...optionProps } = props;
          return (
            <ListItemButton
              key={key}
              {...optionProps}
              component="li"
              sx={{
                mx: 0.5,
                py: 1,
                px: 2,
                borderRadius: 1,
              }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>{option.icon}</ListItemIcon>
              <ListItemText
                primary={option.label}
                primaryTypographyProps={{
                  fontSize: "0.875rem",
                  noWrap: true,
                }}
              />
            </ListItemButton>
          );
        }}
      />
    </Dialog>
  );
}
