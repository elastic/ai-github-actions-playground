import { useCallback, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import RestoreIcon from "@mui/icons-material/Restore";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "../store/useDashboardStore";

export default function DashboardManagementPage() {
  const { dashboard, exportDashboard, importDashboard, loadDefaultDashboard } = useDashboardStore(
    useShallow((s) => ({
      dashboard: s.dashboard,
      exportDashboard: s.exportDashboard,
      importDashboard: s.importDashboard,
      loadDefaultDashboard: s.loadDefaultDashboard,
    })),
  );

  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const handleExport = useCallback(() => {
    const json = exportDashboard();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dashboard.title.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportDashboard, dashboard.title]);

  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setImportError(null);
        setImportSuccess(false);
        const result = importDashboard(reader.result as string);
        if (result.success) {
          setImportSuccess(true);
        } else {
          setImportError(result.error ?? "Import failed.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [importDashboard]);

  const handleLoadDefault = useCallback(() => {
    if (
      !window.confirm(
        "Replace the current dashboard with the built-in default? This cannot be undone.",
      )
    )
      return;
    loadDefaultDashboard();
  }, [loadDefaultDashboard]);

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", width: "100%", py: 2 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        Dashboard Management
      </Typography>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Import & Export
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Export the current dashboard to a JSON file, or import a previously exported dashboard.
          Importing will replace the current dashboard.
        </Typography>

        {importError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setImportError(null)}>
            {importError}
          </Alert>
        )}
        {importSuccess && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setImportSuccess(false)}>
            Dashboard imported successfully.
          </Alert>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExport}>
              Export Dashboard
            </Button>
            <Button variant="outlined" startIcon={<FileUploadIcon />} onClick={handleImport}>
              Import Dashboard
            </Button>
          </Box>

          <Divider />

          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Reset the dashboard to the built-in default layout.
            </Typography>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<RestoreIcon />}
              onClick={handleLoadDefault}
            >
              Load Default Dashboard
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
