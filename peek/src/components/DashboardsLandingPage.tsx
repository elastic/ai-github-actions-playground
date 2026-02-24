import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useShallow } from "zustand/react/shallow";

import type { DashboardDefinition } from "../types";
import { useDashboardStore } from "../store/useDashboardStore";

export default function DashboardsLandingPage() {
  const navigate = useNavigate();
  const {
    dashboards,
    activeDashboardId,
    createDashboard,
    renameDashboard,
    duplicateDashboard,
    archiveDashboard,
    deleteDashboard,
    restoreDashboard,
    exportWorkspace,
    importDashboard,
    importWorkspace,
  } = useDashboardStore(
    useShallow((s) => ({
      dashboards: s.dashboards,
      activeDashboardId: s.activeDashboardId,
      createDashboard: s.createDashboard,
      renameDashboard: s.renameDashboard,
      duplicateDashboard: s.duplicateDashboard,
      archiveDashboard: s.archiveDashboard,
      deleteDashboard: s.deleteDashboard,
      restoreDashboard: s.restoreDashboard,
      exportWorkspace: s.exportWorkspace,
      importDashboard: s.importDashboard,
      importWorkspace: s.importWorkspace,
    })),
  );

  const [showArchived, setShowArchived] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuDashboard, setMenuDashboard] = useState<DashboardDefinition | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [recentlyDeleted, setRecentlyDeleted] = useState<DashboardDefinition | null>(null);
  const deleteTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (deleteTimeoutRef.current !== null) {
        window.clearTimeout(deleteTimeoutRef.current);
      }
    },
    [],
  );

  const visibleDashboards = showArchived ? dashboards : dashboards.filter((d) => !d.archived);

  const handleCreate = useCallback(() => {
    const title = window.prompt("Dashboard name", `Dashboard ${dashboards.length + 1}`);
    if (!title) return;
    const id = createDashboard(title);
    navigate(`/dashboards/${id}`);
  }, [createDashboard, dashboards.length, navigate]);

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
  }, []);

  const handleRename = useCallback(() => {
    if (!menuDashboard) return;
    const title = window.prompt("Rename dashboard", menuDashboard.title);
    if (!title || title.trim() === menuDashboard.title) {
      handleCloseMenu();
      return;
    }
    renameDashboard(menuDashboard.id, title);
    handleCloseMenu();
  }, [menuDashboard, renameDashboard, handleCloseMenu]);

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

  const handleDelete = useCallback(() => {
    if (!menuDashboard) return;
    if (!window.confirm(`Delete dashboard "${menuDashboard.title}"?`)) {
      handleCloseMenu();
      return;
    }
    const deleted = deleteDashboard(menuDashboard.id);
    if (!deleted) {
      handleCloseMenu();
      return;
    }
    if (deleteTimeoutRef.current !== null) {
      window.clearTimeout(deleteTimeoutRef.current);
    }
    setRecentlyDeleted(menuDashboard);
    deleteTimeoutRef.current = window.setTimeout(() => {
      setRecentlyDeleted(null);
      deleteTimeoutRef.current = null;
    }, 8000);
    handleCloseMenu();
  }, [menuDashboard, deleteDashboard, handleCloseMenu]);

  const handleUndoDelete = useCallback(() => {
    if (!recentlyDeleted) return;
    restoreDashboard(recentlyDeleted, false);
    setRecentlyDeleted(null);
    if (deleteTimeoutRef.current !== null) {
      window.clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = null;
    }
  }, [recentlyDeleted, restoreDashboard]);

  const handleExportDashboard = useCallback(() => {
    if (!menuDashboard) return;
    const json = JSON.stringify(menuDashboard, null, 2);
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
    <Box sx={{ maxWidth: 1200, mx: "auto", width: "100%", py: 1 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Dashboards
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {dashboards.length} dashboard{dashboards.length !== 1 ? "s" : ""}
            {archivedCount > 0 && ` (${archivedCount} archived)`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {archivedCount > 0 && (
            <Tooltip title={showArchived ? "Hide archived" : "Show archived"}>
              <IconButton size="small" onClick={() => setShowArchived((v) => !v)}>
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
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            New Dashboard
          </Button>
        </Stack>
      </Box>

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
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
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
                  borderColor: "primary.main",
                  borderWidth: 2,
                }),
              }}
            >
              <CardActionArea onClick={() => navigate(`/dashboards/${entry.id}`)}>
                <CardContent sx={{ pb: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, pr: 4 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }} noWrap>
                      {entry.title}
                    </Typography>
                    {isActive && <Chip label="Active" size="small" color="primary" />}
                    {entry.archived && <Chip label="Archived" size="small" variant="outlined" />}
                  </Box>
                  {entry.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {entry.description}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="caption" color="text.secondary">
                      {entry.panels.length} panel{entry.panels.length !== 1 ? "s" : ""}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Updated {new Date(entry.updatedAt).toLocaleDateString()}
                    </Typography>
                  </Stack>
                  {entry.tags && entry.tags.length > 0 && (
                    <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                      {entry.tags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" />
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
            </Card>
          );
        })}
      </Box>

      {visibleDashboards.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No dashboards yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create a new dashboard to get started.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            New Dashboard
          </Button>
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
      </Menu>

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
