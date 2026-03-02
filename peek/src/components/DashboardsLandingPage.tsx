import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import StarIcon from "@mui/icons-material/Star";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";

import type { DashboardDefinition } from "../types";
import { useDashboardCatalogStore } from "../store/useDashboardCatalogStore";
import { useDashboardFilters } from "../hooks/useDashboardFilters";
import {
  exportDashboardJson,
  exportWorkspaceJson,
  triggerFileImport,
} from "../utils/dashboardImportExport";

import PageHeader from "./PageHeader";
import DashboardCard from "./DashboardCard";
import DashboardCardMenu from "./DashboardCardMenu";
import DashboardNameDialog from "./DashboardNameDialog";

export default function DashboardsLandingPage() {
  const navigate = useNavigate();
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
  const {
    searchQuery,
    setSearchQuery,
    selectedTags,
    toggleTag,
    sortField,
    setSortField,
    showArchived,
    setShowArchived,
    showFavoritesOnly,
    setShowFavoritesOnly,
    hasActiveFilters,
    resetFilters,
    hasFavorites,
    allTags,
    visibleDashboards,
  } = useDashboardFilters(dashboards);

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuDashboard, setMenuDashboard] = useState<DashboardDefinition | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [recentlyDeleted, setRecentlyDeleted] = useState<DashboardDefinition | null>(null);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameDialogMode, setNameDialogMode] = useState<"create" | "rename">("create");
  const [nameDialogValue, setNameDialogValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deleteToastIdRef = useRef<string | number | undefined>(undefined);

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

  useEffect(() => {
    if (!recentlyDeleted) return;
    if (deleteToastIdRef.current !== undefined) {
      toast.dismiss(deleteToastIdRef.current);
    }
    deleteToastIdRef.current = toast.info("Dashboard deleted.", {
      duration: 8000,
      action: {
        label: "Undo",
        onClick: handleUndoDelete,
      },
      onAutoClose: () => {
        setRecentlyDeleted(null);
      },
      onDismiss: () => {
        setRecentlyDeleted(null);
      },
    });
  }, [recentlyDeleted, handleUndoDelete]);

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
    exportDashboardJson(menuDashboard);
    handleCloseMenu();
  }, [menuDashboard, handleCloseMenu]);

  const handleExportWorkspace = useCallback(() => {
    exportWorkspaceJson(exportWorkspace);
  }, [exportWorkspace]);

  const handleImport = useCallback(
    (scope: "dashboard" | "workspace") => {
      triggerFileImport(scope, importDashboard, importWorkspace, {
        onSuccess: (message) => {
          setImportError(null);
          setImportSuccess(message);
        },
        onError: (message) => {
          setImportSuccess(null);
          setImportError(message);
        },
      });
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
        {visibleDashboards.map((entry) => (
          <DashboardCard
            key={entry.id}
            entry={entry}
            isActive={entry.id === activeDashboardId}
            selectedTags={selectedTags}
            onNavigate={(id) => navigate(`/dashboards/${id}`)}
            onOpenMenu={handleOpenMenu}
            onToggleFavorite={handleToggleFavorite}
            onToggleTag={toggleTag}
          />
        ))}
      </Box>

      {visibleDashboards.length === 0 && (
        <Box sx={{ py: 8, textAlign: "center" }}>
          {hasActiveFilters ? (
            <>
              <Typography variant="subtitle1" color="text.secondary">
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
              <Typography variant="subtitle1" color="text.secondary">
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

      <DashboardCardMenu
        anchorEl={menuAnchor}
        dashboard={menuDashboard}
        confirmDeleteId={confirmDeleteId}
        disableDelete={dashboards.length <= 1}
        onClose={handleCloseMenu}
        onRename={handleRename}
        onDuplicate={handleDuplicate}
        onArchiveToggle={handleArchiveToggle}
        onExport={handleExportDashboard}
        onDelete={handleDelete}
        onCancelDelete={() => setConfirmDeleteId(null)}
      />

      <DashboardNameDialog
        open={nameDialogOpen}
        mode={nameDialogMode}
        value={nameDialogValue}
        onChange={setNameDialogValue}
        onConfirm={handleNameDialogConfirm}
        onCancel={handleNameDialogCancel}
      />
    </Box>
  );
}
