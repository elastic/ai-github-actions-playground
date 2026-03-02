import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import DeleteIcon from "@mui/icons-material/Delete";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { useShallow } from "zustand/react/shallow";

import type { DashboardDefinition } from "../types";
import { useDashboardCatalogStore } from "../store/useDashboardCatalogStore";
import { toPersesDashboard } from "../services/perses/dashboardAdapters";

import PageHeader from "./PageHeader";

export default function DashboardsLandingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    dashboards,
    activeDashboardId,
    createDashboard,
    renameDashboard,
    duplicateDashboard,
    archiveDashboard,
    toggleFavoriteDashboard,
    deleteDashboard,
    restoreDashboard,
    exportWorkspace,
    importDashboard,
    importWorkspace,
  } = useDashboardCatalogStore(
    useShallow((s) => ({
      dashboards: s.dashboards,
      activeDashboardId: s.activeDashboardId,
      createDashboard: s.createDashboard,
      renameDashboard: s.renameDashboard,
      duplicateDashboard: s.duplicateDashboard,
      archiveDashboard: s.archiveDashboard,
      toggleFavoriteDashboard: s.toggleFavoriteDashboard,
      deleteDashboard: s.deleteDashboard,
      restoreDashboard: s.restoreDashboard,
      exportWorkspace: s.exportWorkspace,
      importDashboard: s.importDashboard,
      importWorkspace: s.importWorkspace,
    })),
  );

  // Filter / sort state persisted in URL query params
  const searchQuery = searchParams.get("q") ?? "";
  const selectedTags = useMemo(() => {
    const raw = searchParams.get("tags");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [searchParams]);
  const sortField = (searchParams.get("sort") ?? "updated") as "updated" | "title";
  const showArchived = searchParams.get("archived") === "true";
  const showFavoritesOnly = searchParams.get("favorites") === "true";

  const setShowArchived = useCallback(
    (value: boolean) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) {
            next.set("archived", "true");
          } else {
            next.delete("archived");
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setShowFavoritesOnly = useCallback(
    (value: boolean) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) {
            next.set("favorites", "true");
          } else {
            next.delete("favorites");
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setSearchQuery = useCallback(
    (value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) {
            next.set("q", value);
          } else {
            next.delete("q");
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const toggleTag = useCallback(
    (tag: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const current = (prev.get("tags") ?? "").split(",").filter(Boolean);
          const updated = current.includes(tag)
            ? current.filter((t) => t !== tag)
            : [...current, tag];
          if (updated.length > 0) {
            next.set("tags", updated.join(","));
          } else {
            next.delete("tags");
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setSortField = useCallback(
    (value: "updated" | "title") => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === "updated") {
            next.delete("sort");
          } else {
            next.set("sort", value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const hasActiveFilters = searchQuery !== "" || selectedTags.length > 0 || showFavoritesOnly;

  const resetFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams();
        // Preserve the archived param since it has its own dedicated toggle
        if (prev.get("archived") === "true") next.set("archived", "true");
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  // Derived: whether any dashboard is favorited
  const hasFavorites = useMemo(() => dashboards.some((d) => d.favoritedAt), [dashboards]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const d of dashboards) {
      for (const t of d.tags ?? []) tagSet.add(t);
    }
    return Array.from(tagSet).sort();
  }, [dashboards]);

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuDashboard, setMenuDashboard] = useState<DashboardDefinition | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [recentlyDeleted, setRecentlyDeleted] = useState<DashboardDefinition | null>(null);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameDialogMode, setNameDialogMode] = useState<"create" | "rename">("create");
  const [nameDialogValue, setNameDialogValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const visibleDashboards = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let result = dashboards.filter((d) => {
      if (!showArchived && d.archived) return false;
      if (showFavoritesOnly && !d.favoritedAt) return false;
      if (
        q &&
        !d.title.toLowerCase().includes(q) &&
        !(d.description ?? "").toLowerCase().includes(q)
      )
        return false;
      if (selectedTags.length > 0 && !selectedTags.every((t) => (d.tags ?? []).includes(t)))
        return false;
      return true;
    });
    result = [...result].sort((a, b) => {
      // Favorites always rank first
      if (a.favoritedAt && !b.favoritedAt) return -1;
      if (!a.favoritedAt && b.favoritedAt) return 1;
      if (sortField === "title") return a.title.localeCompare(b.title);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return result;
  }, [dashboards, showArchived, showFavoritesOnly, searchQuery, selectedTags, sortField]);

  const handleCreate = useCallback(() => {
    setNameDialogMode("create");
    setNameDialogValue(`Dashboard ${dashboards.length + 1}`);
    setNameDialogOpen(true);
  }, [dashboards.length]);

  const handleOpenMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>, entry: DashboardDefinition) => {
      event.stopPropagation();
      setMenuAnchor(event.currentTarget);
      setMenuDashboard(entry);
    },
    [],
  );

  const handleCloseMenu = useCallback(() => {
    setMenuAnchor(null);
    setMenuDashboard(null);
    setConfirmDeleteId(null);
  }, []);

  const handleRename = useCallback(() => {
    if (!menuDashboard) return;
    setNameDialogMode("rename");
    setNameDialogValue(menuDashboard.title);
    setNameDialogOpen(true);
  }, [menuDashboard]);

  const handleDuplicate = useCallback(() => {
    if (!menuDashboard) return;
    const newId = duplicateDashboard(menuDashboard.id);
    handleCloseMenu();
    if (newId) navigate(`/dashboards/${newId}`);
  }, [menuDashboard, duplicateDashboard, handleCloseMenu, navigate]);

  const handleArchiveToggle = useCallback(() => {
    if (!menuDashboard) return;
    archiveDashboard(menuDashboard.id, !menuDashboard.archived);
    handleCloseMenu();
  }, [menuDashboard, archiveDashboard, handleCloseMenu]);

  const handleToggleFavorite = useCallback(
    (event: React.MouseEvent<HTMLElement>, id: string) => {
      event.stopPropagation();
      toggleFavoriteDashboard(id);
    },
    [toggleFavoriteDashboard],
  );

  const handleDelete = useCallback(() => {
    if (!menuDashboard) return;
    if (confirmDeleteId !== menuDashboard.id) {
      setConfirmDeleteId(menuDashboard.id);
      return;
    }
    const deleted = deleteDashboard(menuDashboard.id);
    if (!deleted) {
      handleCloseMenu();
      return;
    }
    setRecentlyDeleted(menuDashboard);
    handleCloseMenu();
  }, [menuDashboard, confirmDeleteId, deleteDashboard, handleCloseMenu]);

  const handleUndoDelete = useCallback(() => {
    if (!recentlyDeleted) return;
    restoreDashboard(recentlyDeleted, false);
    setRecentlyDeleted(null);
  }, [recentlyDeleted, restoreDashboard]);

  const handleNameDialogConfirm = useCallback(() => {
    const trimmed = nameDialogValue.trim();
    if (!trimmed) return;
    if (nameDialogMode === "create") {
      const id = createDashboard(trimmed);
      setNameDialogOpen(false);
      navigate(`/dashboards/${id}`);
    } else {
      if (menuDashboard && trimmed !== menuDashboard.title) {
        renameDashboard(menuDashboard.id, trimmed);
      }
      setNameDialogOpen(false);
      handleCloseMenu();
    }
  }, [
    nameDialogValue,
    nameDialogMode,
    createDashboard,
    navigate,
    menuDashboard,
    renameDashboard,
    handleCloseMenu,
  ]);

  const handleNameDialogCancel = useCallback(() => {
    setNameDialogOpen(false);
    if (nameDialogMode === "rename") handleCloseMenu();
  }, [nameDialogMode, handleCloseMenu]);

  const handleExportDashboard = useCallback(() => {
    if (!menuDashboard) return;
    const json = JSON.stringify(toPersesDashboard(menuDashboard), null, 2);
    const safeTitle = menuDashboard.title.replace(/\s+/g, "-").toLowerCase();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeTitle}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    handleCloseMenu();
  }, [menuDashboard, handleCloseMenu]);

  const handleExportWorkspace = useCallback(() => {
    const json = exportWorkspace();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "peek-workspace.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }, [exportWorkspace]);

  const handleImport = useCallback(
    (scope: "dashboard" | "workspace") => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          setImportError(null);
          setImportSuccess(null);
          const text = String(reader.result ?? "");
          const result = scope === "workspace" ? importWorkspace(text) : importDashboard(text);
          if (result.success) {
            setImportSuccess(
              scope === "workspace"
                ? "Workspace imported successfully."
                : "Dashboard imported successfully.",
            );
          } else {
            setImportError(result.error ?? "Import failed.");
          }
        };
        reader.readAsText(file);
      };
      input.click();
    },
    [importDashboard, importWorkspace],
  );

  const archivedCount = dashboards.filter((d) => d.archived).length;

  return (
    <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto", py: 1 }}>
      <Box sx={{ mb: 2 }}>
        <PageHeader
          title="Dashboards"
          description={`${dashboards.length} dashboard${dashboards.length !== 1 ? "s" : ""}${archivedCount > 0 ? ` (${archivedCount} archived)` : ""}`}
          actions={
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {archivedCount > 0 && (
                <Tooltip title={showArchived ? "Hide archived" : "Show archived"}>
                  <IconButton
                    size="small"
                    onClick={() => setShowArchived(!showArchived)}
                    aria-label={
                      showArchived ? "Hide archived dashboards" : "Show archived dashboards"
                    }
                  >
                    {showArchived ? (
                      <VisibilityOffIcon fontSize="small" />
                    ) : (
                      <VisibilityIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              )}
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileUploadIcon />}
                onClick={() => handleImport("dashboard")}
              >
                Import
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={handleExportWorkspace}
              >
                Export All
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileUploadIcon />}
                onClick={() => handleImport("workspace")}
              >
                Import Workspace
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreate}
              >
                New Dashboard
              </Button>
            </Stack>
          }
        />
      </Box>

      {/* Search and filter bar */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ mb: 1.5 }}
        flexWrap="wrap"
        useFlexGap
      >
        <TextField
          size="small"
          placeholder="Search dashboards…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          inputProps={{ "aria-label": "Search dashboards" }}
          sx={{ width: { sm: "auto", xs: "100%" }, minWidth: { sm: 220, xs: 0 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="sort-select-label">Sort by</InputLabel>
          <Select
            labelId="sort-select-label"
            label="Sort by"
            value={sortField}
            onChange={(e) => setSortField(e.target.value as "updated" | "title")}
          >
            <MenuItem value="updated">Last updated</MenuItem>
            <MenuItem value="title">Title</MenuItem>
          </Select>
        </FormControl>
        {hasActiveFilters && (
          <Button size="small" variant="outlined" onClick={resetFilters} startIcon={<ClearIcon />}>
            Reset filters
          </Button>
        )}
      </Stack>

      {/* Favorites and tag filter chips */}
      {(hasFavorites || allTags.length > 0) && (
        <Stack direction="row" spacing={0.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          {hasFavorites && (
            <Chip
              label="Favorites"
              size="small"
              icon={<StarIcon fontSize="small" />}
              variant={showFavoritesOnly ? "filled" : "outlined"}
              color={showFavoritesOnly ? "primary" : "default"}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              aria-label="Filter by favorites"
              aria-pressed={showFavoritesOnly}
            />
          )}
          {allTags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              variant={selectedTags.includes(tag) ? "filled" : "outlined"}
              color={selectedTags.includes(tag) ? "primary" : "default"}
              onClick={() => toggleTag(tag)}
              aria-label={`Filter by tag ${tag}`}
              aria-pressed={selectedTags.includes(tag)}
            />
          ))}
        </Stack>
      )}

      {importError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setImportError(null)}>
          {importError}
        </Alert>
      )}
      {importSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setImportSuccess(null)}>
          {importSuccess}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))",
          gap: 2,
        }}
      >
        {visibleDashboards.map((entry) => {
          const isActive = entry.id === activeDashboardId;
          return (
            <Card
              key={entry.id}
              variant="outlined"
              sx={{
                position: "relative",
                opacity: entry.archived ? 0.6 : 1,
                ...(isActive && {
                  borderWidth: 2,
                  borderColor: "primary.main",
                }),
              }}
            >
              <CardActionArea onClick={() => navigate(`/dashboards/${entry.id}`)}>
                <CardContent sx={{ pb: 1 }}>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.5, pr: 8 }}>
                    <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 600 }} noWrap>
                      {entry.title}
                    </Typography>
                    {isActive && <Chip label="Active" size="small" color="primary" />}
                    {entry.archived && <Chip label="Archived" size="small" variant="outlined" />}
                  </Box>
                  {entry.description && (
                    <Typography
                      variant="body2"
                      color="text.primary"
                      sx={{
                        display: "-webkit-box",
                        overflow: "hidden",
                        mb: 1,
                        textOverflow: "ellipsis",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 2,
                      }}
                    >
                      {entry.description}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="caption" color="text.primary">
                      {entry.panels.length} panel{entry.panels.length !== 1 ? "s" : ""}
                    </Typography>
                    <Typography variant="caption" color="text.primary">
                      Updated {new Date(entry.updatedAt).toLocaleDateString()}
                    </Typography>
                  </Stack>
                  {entry.tags && entry.tags.length > 0 && (
                    <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                      {entry.tags.map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          variant={selectedTags.includes(tag) ? "filled" : "outlined"}
                          color={selectedTags.includes(tag) ? "primary" : "default"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTag(tag);
                          }}
                          aria-label={`Filter by tag ${tag}`}
                          aria-pressed={selectedTags.includes(tag)}
                        />
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </CardActionArea>
              <IconButton
                size="small"
                sx={{ position: "absolute", top: 8, right: 8 }}
                onClick={(e) => handleOpenMenu(e, entry)}
                aria-label={`Actions for ${entry.title}`}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <Tooltip title={entry.favoritedAt ? "Remove from favorites" : "Add to favorites"}>
                <IconButton
                  size="small"
                  sx={{ position: "absolute", top: 8, right: 36 }}
                  onClick={(e) => handleToggleFavorite(e, entry.id)}
                  aria-label={
                    entry.favoritedAt
                      ? `Remove ${entry.title} from favorites`
                      : `Add ${entry.title} to favorites`
                  }
                  aria-pressed={Boolean(entry.favoritedAt)}
                >
                  {entry.favoritedAt ? (
                    <StarIcon fontSize="small" color="warning" />
                  ) : (
                    <StarBorderIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            </Card>
          );
        })}
      </Box>

      {visibleDashboards.length === 0 && (
        <Box sx={{ py: 8, textAlign: "center" }}>
          {hasActiveFilters ? (
            <>
              <Typography variant="h6" color="text.secondary">
                No dashboards match your filters
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Try adjusting your search or tag filters.
              </Typography>
              <Button variant="outlined" startIcon={<ClearIcon />} onClick={resetFilters}>
                Reset filters
              </Button>
            </>
          ) : (
            <>
              <Typography variant="h6" color="text.secondary">
                No dashboards yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Create a new dashboard to get started.
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                New Dashboard
              </Button>
            </>
          )}
        </Box>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleCloseMenu}>
        <MenuItem onClick={handleRename}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDuplicate}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleArchiveToggle}>
          <ListItemIcon>
            {menuDashboard?.archived ? (
              <UnarchiveIcon fontSize="small" />
            ) : (
              <ArchiveIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>{menuDashboard?.archived ? "Unarchive" : "Archive"}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleExportDashboard}>
          <ListItemIcon>
            <FileDownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export</ListItemText>
        </MenuItem>
        <Divider />
        {confirmDeleteId === menuDashboard?.id ? (
          <Box sx={{ display: "flex", gap: 1, py: 1, px: 2 }}>
            <Button size="small" color="error" variant="contained" onClick={handleDelete}>
              Confirm Delete
            </Button>
            <Button size="small" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
          </Box>
        ) : (
          <MenuItem
            onClick={handleDelete}
            disabled={dashboards.length <= 1}
            sx={{ color: "error.main" }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <Dialog open={nameDialogOpen} onClose={handleNameDialogCancel} maxWidth="xs" fullWidth>
        <DialogTitle>
          {nameDialogMode === "create" ? "New Dashboard" : "Rename Dashboard"}
        </DialogTitle>
        <DialogContent>
          <TextField
            // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: user just triggered create/rename
            autoFocus
            label="Dashboard name"
            fullWidth
            value={nameDialogValue}
            onChange={(e) => setNameDialogValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameDialogConfirm();
              if (e.key === "Escape") handleNameDialogCancel();
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleNameDialogCancel}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleNameDialogConfirm}
            disabled={!nameDialogValue.trim()}
          >
            {nameDialogMode === "create" ? "Create" : "Rename"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(recentlyDeleted)}
        autoHideDuration={8000}
        onClose={() => setRecentlyDeleted(null)}
      >
        <Alert
          severity="info"
          onClose={() => setRecentlyDeleted(null)}
          action={
            <Button color="inherit" size="small" onClick={handleUndoDelete}>
              Undo
            </Button>
          }
          sx={{ width: "100%" }}
        >
          Dashboard deleted.
        </Alert>
      </Snackbar>
    </Box>
  );
}
