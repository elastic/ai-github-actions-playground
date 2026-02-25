import { useState, useMemo, useEffect, useCallback, useRef } from "react";
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
import MenuBookIcon from "@mui/icons-material/MenuBook";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useShallow } from "zustand/react/shallow";

import { fetchCapabilitiesForConnection, isElasticsearchError } from "../services/es";
import { PAGE_MANIFEST, type PageId } from "../routes/manifest";
import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { useQueryStore } from "../store/useQueryStore";
import { useDashboardStore } from "../store/useDashboardStore";
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
    setConnection,
    setConnected,
    setCapabilities,
    setActiveProfileId,
    setProfileHealth,
  } = useConnectionStore(
    useShallow((s) => ({
      connected: s.connected,
      connectionProfiles: s.connectionProfiles,
      activeProfileId: s.activeProfileId,
      setConnection: s.setConnection,
      setConnected: s.setConnected,
      setCapabilities: s.setCapabilities,
      setActiveProfileId: s.setActiveProfileId,
      setProfileHealth: s.setProfileHealth,
    })),
  );
  const { themeMode, setConnectionDialogOpen, setThemeMode, setCommandPaletteOpen } = useUIStore(
    useShallow((s) => ({
      themeMode: s.themeMode,
      setConnectionDialogOpen: s.setConnectionDialogOpen,
      setThemeMode: s.setThemeMode,
      setCommandPaletteOpen: s.setCommandPaletteOpen,
    })),
  );
  const { queryHistory, setDiscoverQueryDraft } = useQueryStore(
    useShallow((s) => ({
      queryHistory: s.queryHistory,
      setDiscoverQueryDraft: s.setDiscoverQueryDraft,
    })),
  );
  const dashboards = useDashboardStore((s) => s.dashboards);

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
              setCommandPaletteOpen(false);
              const conn = profile.connection;
              void (async () => {
                try {
                  const caps = await fetchCapabilitiesForConnection(conn);
                  setConnection(conn);
                  setConnected(true);
                  setCapabilities(caps);
                  setActiveProfileId(profile.id);
                  setProfileHealth(profile.id, {
                    status: "healthy",
                    checkedAt: new Date().toISOString(),
                    errorSummary: null,
                  });
                } catch (err: unknown) {
                  const message = isElasticsearchError(err) ? err.message : String(err);
                  setConnected(false);
                  setCapabilities(null);
                  setConnection(conn);
                  setActiveProfileId(profile.id);
                  setProfileHealth(profile.id, {
                    status: "needs_attention",
                    checkedAt: new Date().toISOString(),
                    errorSummary: message,
                  });
                  setConnectionDialogOpen(true);
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
              try {
                await fetchCapabilitiesForConnection(profile.connection);
                setProfileHealth(profile.id, {
                  status: "healthy",
                  checkedAt: new Date().toISOString(),
                  errorSummary: null,
                });
              } catch (err: unknown) {
                const message = isElasticsearchError(err) ? err.message : String(err);
                setProfileHealth(profile.id, {
                  status: "needs_attention",
                  checkedAt: new Date().toISOString(),
                  errorSummary: message,
                });
              }
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
    queryHistory,
    dashboards,
    navigate,
    setConnectionDialogOpen,
    setThemeMode,
    setCommandPaletteOpen,
    setDiscoverQueryDraft,
    setConnection,
    setConnected,
    setCapabilities,
    setActiveProfileId,
    setProfileHealth,
  ]);
}

function CommandPalettePopper({ children }: PopperProps) {
  return <Box sx={{ width: "100%" }}>{children as React.ReactNode}</Box>;
}

export default function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const commands = useCommands();

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
        PopperComponent={CommandPalettePopper}
        PaperComponent={({ children }) => <DialogContent sx={{ p: 0 }}>{children}</DialogContent>}
        ListboxProps={
          {
            id: "command-palette-list",
            "aria-label": "Commands",
          } as React.HTMLAttributes<HTMLUListElement>
        }
        renderInput={(params) => (
          <Box
            ref={params.InputProps.ref}
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
                px: 2,
                py: 0.75,
                mx: 0.5,
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
