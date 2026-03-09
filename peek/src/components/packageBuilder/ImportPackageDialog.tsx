import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import LinearProgress from "@mui/material/LinearProgress";

import { usePackageBuilderStore } from "../../store/usePackageBuilderStore";
import type { PackageBuilderData } from "../../types/packageBuilder";
import {
  importFromZip,
  importFromFolder,
  importFromFileMap,
} from "../../services/packageBuilder/importPackage";
import { fetchPackageFiles, type CatalogEntry } from "../../services/packageBuilder/githubCatalog";
import GitHubCatalogSection from "./GitHubCatalogSection";
import ImportUploadSection from "./ImportUploadSection";
import DataFetchAlert from "../DataFetchAlert";

interface Props {
  open: boolean;
  onClose: () => void;
  onImportComplete?: (data: PackageBuilderData) => void;
}

export default function ImportPackageDialog({ open, onClose, onImportComplete }: Props) {
  const loadPackage = usePackageBuilderStore((s) => s.loadPackage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const importAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => importAbortRef.current?.abort(), []);

  const handleResult = useCallback(
    async (
      importFn: (signal: AbortSignal) => Promise<Awaited<ReturnType<typeof importFromZip>>>,
    ) => {
      importAbortRef.current?.abort();
      const controller = new AbortController();
      importAbortRef.current = controller;
      setLoading(true);
      setError(null);
      setWarnings([]);
      try {
        const result = await importFn(controller.signal);
        if (controller.signal.aborted) return;
        setWarnings(result.warnings);
        loadPackage(result.data);
        onImportComplete?.(result.data);
        if (result.warnings.length === 0) onClose();
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (importAbortRef.current === controller) importAbortRef.current = null;
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [loadPackage, onClose, onImportComplete],
  );

  const handleZipUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      handleResult(() => importFromZip(file));
      e.target.value = "";
    },
    [handleResult],
  );

  const handleFolderUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      handleResult(() => importFromFolder(files));
      e.target.value = "";
    },
    [handleResult],
  );

  const handleCatalogSelect = useCallback(
    (entry: CatalogEntry) => {
      handleResult(async (signal) => {
        const fileMap = await fetchPackageFiles(entry.dirName, signal);
        return importFromFileMap(fileMap);
      });
    },
    [handleResult],
  );

  const handleClose = () => {
    importAbortRef.current?.abort();
    importAbortRef.current = null;
    setLoading(false);
    setError(null);
    setWarnings([]);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Open Package</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Load an existing OTel input package from GitHub, a .zip file, or a folder on disk.
        </Typography>

        {loading ? (
          <Box sx={{ py: 1 }}>
            <LinearProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            <GitHubCatalogSection open={open} onSelect={handleCatalogSelect} />
            <ImportUploadSection
              onZipUpload={handleZipUpload}
              onFolderUpload={handleFolderUpload}
            />
          </Stack>
        )}

        <DataFetchAlert error={error} sx={{ mt: 2 }} />

        {warnings.length > 0 && (
          <Stack spacing={1} sx={{ mt: 2 }}>
            <Alert severity="success">Package loaded successfully!</Alert>
            {warnings.map((w) => (
              <Alert key={w} severity="warning" sx={{ py: 0.5 }}>
                {w}
              </Alert>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {warnings.length > 0 ? (
          <Button onClick={handleClose} variant="contained">
            Done
          </Button>
        ) : (
          <Button onClick={handleClose}>Cancel</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
