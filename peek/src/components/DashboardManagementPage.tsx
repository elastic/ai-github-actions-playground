import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import RestoreIcon from "@mui/icons-material/Restore";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useShallow } from "zustand/react/shallow";

import type { DashboardDefinition } from "../types";
import { useDashboardStore } from "../store/useDashboardStore";

export default function DashboardManagementPage() {
  const {
    dashboard,
    dashboards,
    activeDashboardId,
    setActiveDashboard,
    createDashboard,
    renameDashboard,
    duplicateDashboard,
    archiveDashboard,
    deleteDashboard,
    restoreDashboard,
    exportDashboard,
    exportWorkspace,
    importDashboard,
    importWorkspace,
    loadDefaultDashboard,
    resetWorkspaceState,
  } = useDashboardStore(
    useShallow((s) => ({
      dashboard: s.dashboard,
      dashboards: s.dashboards,
      activeDashboardId: s.activeDashboardId,
      setActiveDashboard: s.setActiveDashboard,
      createDashboard: s.createDashboard,
      renameDashboard: s.renameDashboard,
      duplicateDashboard: s.duplicateDashboard,
      archiveDashboard: s.archiveDashboard,
      deleteDashboard: s.deleteDashboard,
      restoreDashboard: s.restoreDashboard,
      exportDashboard: s.exportDashboard,
      exportWorkspace: s.exportWorkspace,
      importDashboard: s.importDashboard,
      importWorkspace: s.importWorkspace,
      loadDefaultDashboard: s.loadDefaultDashboard,
      resetWorkspaceState: s.resetWorkspaceState,
    })),
  );

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

  const downloadJson = useCallback((json: string, filename: string) => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportActive = useCallback(() => {
    const safeTitle = dashboard.title.replace(/\s+/g, "-").toLowerCase();
    downloadJson(exportDashboard(), `${safeTitle}.json`);
  }, [dashboard.title, downloadJson, exportDashboard]);

  const handleExportWorkspace = useCallback(() => {
    downloadJson(exportWorkspace(), "peek-workspace.json");
  }, [downloadJson, exportWorkspace]);

  const handleImport = useCallback(
    (scope: "active" | "workspace") => {
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

  const handleCreate = useCallback(() => {
    const title = window.prompt("Dashboard name", `Dashboard ${dashboards.length + 1}`);
    if (!title) return;
    createDashboard(title);
  }, [createDashboard, dashboards.length]);

  const handleRename = useCallback(
    (entry: DashboardDefinition) => {
      const title = window.prompt("Rename dashboard", entry.title);
      if (!title || title.trim() === entry.title) return;
      renameDashboard(entry.id, title);
    },
    [renameDashboard],
  );

  const handleDelete = useCallback(
    (entry: DashboardDefinition) => {
      if (!window.confirm(`Delete dashboard "${entry.title}"?`)) return;
      const deleted = deleteDashboard(entry.id);
      if (!deleted) return;
      if (deleteTimeoutRef.current !== null) {
        window.clearTimeout(deleteTimeoutRef.current);
      }
      setRecentlyDeleted(entry);
      deleteTimeoutRef.current = window.setTimeout(() => {
        setRecentlyDeleted(null);
        deleteTimeoutRef.current = null;
      }, 8000);
    },
    [deleteDashboard],
  );

  const handleUndoDelete = useCallback(() => {
    if (!recentlyDeleted) return;
    restoreDashboard(recentlyDeleted, true);
    setRecentlyDeleted(null);
    if (deleteTimeoutRef.current !== null) {
      window.clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = null;
    }
  }, [recentlyDeleted, restoreDashboard]);

  const handleResetActive = useCallback(() => {
    if (!window.confirm("Reset the active dashboard to the built-in default layout?")) return;
    loadDefaultDashboard();
  }, [loadDefaultDashboard]);

  const handleResetWorkspace = useCallback(() => {
    if (!window.confirm("Reset the full workspace and remove all dashboards?")) return;
    resetWorkspaceState();
  }, [resetWorkspaceState]);

  return (
    <Box sx={{ maxWidth: 920, mx: "auto", width: "100%", py: 2 }}>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
        Dashboard Management
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage dashboards, set the active dashboard, and import/export either the active dashboard
        or the full workspace.
      </Typography>

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

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="h6">Dashboards</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            New Dashboard
          </Button>
        </Box>
        <List disablePadding>
          {dashboards.map((entry) => {
            const isActive = entry.id === activeDashboardId;
            return (
              <ListItem
                key={entry.id}
                disableGutters
                sx={{
                  py: 1,
                  borderBottom: 1,
                  borderColor: "divider",
                  alignItems: "flex-start",
                }}
                secondaryAction={
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      startIcon={<OpenInNewIcon />}
                      onClick={() => setActiveDashboard(entry.id)}
                      disabled={isActive}
                    >
                      Open
                    </Button>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleRename(entry)}
                    >
                      Rename
                    </Button>
                    <Button
                      size="small"
                      startIcon={<ContentCopyIcon />}
                      onClick={() => duplicateDashboard(entry.id)}
                    >
                      Duplicate
                    </Button>
                    <Button
                      size="small"
                      startIcon={entry.archived ? <UnarchiveIcon /> : <ArchiveIcon />}
                      onClick={() => archiveDashboard(entry.id, !entry.archived)}
                    >
                      {entry.archived ? "Unarchive" : "Archive"}
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDelete(entry)}
                      disabled={dashboards.length <= 1}
                    >
                      Delete
                    </Button>
                  </Stack>
                }
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 45 }}>
                      <Typography variant="subtitle2">{entry.title}</Typography>
                      {isActive && <Chip label="Active" size="small" color="primary" />}
                      {entry.archived && <Chip label="Archived" size="small" variant="outlined" />}
                    </Stack>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      Updated {new Date(entry.updatedAt).toLocaleString()} • {entry.panels.length}{" "}
                      panel(s)
                    </Typography>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Import & Export
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Active dashboard: <strong>{dashboard.title}</strong>
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExportActive}>
            Export Dashboard
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileUploadIcon />}
            onClick={() => handleImport("active")}
          >
            Import Dashboard
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportWorkspace}
          >
            Export Workspace
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileUploadIcon />}
            onClick={() => handleImport("workspace")}
          >
            Import Workspace
          </Button>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            color="warning"
            startIcon={<RestoreIcon />}
            onClick={handleResetActive}
          >
            Load Default Dashboard
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<RestoreIcon />}
            onClick={handleResetWorkspace}
          >
            Reset Workspace
          </Button>
        </Stack>
      </Paper>

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
