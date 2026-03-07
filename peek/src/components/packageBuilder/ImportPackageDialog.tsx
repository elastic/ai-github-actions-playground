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
import CircularProgress from "@mui/material/CircularProgress";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import GitHubIcon from "@mui/icons-material/GitHub";

import { usePackageBuilderStore } from "../../store/usePackageBuilderStore";
import { importFromZip, importFromFolder, importFromFileMap } from "../../services/packageBuilder/importPackage";
import { listInputPackages, fetchPackageFiles, type CatalogEntry } from "../../services/packageBuilder/githubCatalog";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ImportPackageDialog({ open, onClose }: Props) {
  const loadPackage = usePackageBuilderStore((s) => s.loadPackage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Load catalog when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);
    listInputPackages()
      .then((entries) => { if (!cancelled) setCatalog(entries); })
      .catch((err) => { if (!cancelled) setCatalogError(err instanceof Error ? err.message : "Failed to load catalog"); })
      .finally(() => { if (!cancelled) setCatalogLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  const handleResult = useCallback(
    async (importFn: () => Promise<Awaited<ReturnType<typeof importFromZip>>>) => {
      setLoading(true);
      setError(null);
      setWarnings([]);
      try {
        const result = await importFn();
        setWarnings(result.warnings);
        loadPackage(result.data);
        if (result.warnings.length === 0) {
          onClose();
        }
        // If there are warnings, keep dialog open so the user can see them,
        // but the data is already loaded.
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [loadPackage, onClose],
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
    (_: unknown, entry: CatalogEntry | null) => {
      if (!entry) return;
      handleResult(async () => {
        const fileMap = await fetchPackageFiles(entry.dirName);
        return importFromFileMap(fileMap);
      });
    },
    [handleResult],
  );

  const handleClose = () => {
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
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            {/* GitHub catalog */}
            <Box
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                p: 2,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <GitHubIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                <Typography variant="subtitle2">Load from elastic/integrations</Typography>
              </Box>
              {catalogError ? (
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  {catalogError}
                </Alert>
              ) : (
                <Autocomplete
                  options={catalog}
                  getOptionLabel={(o) => o.label}
                  loading={catalogLoading}
                  onChange={handleCatalogSelect}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Search input packages..."
                      size="small"
                      slotProps={{
                        input: {
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {catalogLoading ? <CircularProgress size={16} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        },
                      }}
                    />
                  )}
                  renderOption={(props, option) => {
                    const { key, ...rest } = props;
                    return (
                      <li key={key} {...rest}>
                        <Box>
                          <Typography variant="body2">{option.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.dirName}
                          </Typography>
                        </Box>
                      </li>
                    );
                  }}
                  size="small"
                  fullWidth
                />
              )}
            </Box>

            <Typography variant="body2" color="text.secondary" textAlign="center">
              or upload from disk
            </Typography>

            {/* Zip upload */}
            <Box
              sx={{
                border: "2px dashed",
                borderColor: "divider",
                borderRadius: 2,
                p: 3,
                textAlign: "center",
                cursor: "pointer",
                "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
              }}
              onClick={() => zipInputRef.current?.click()}
            >
              <UploadFileIcon sx={{ fontSize: 40, color: "action.active", mb: 1 }} />
              <Typography variant="subtitle2">Upload .zip file</Typography>
              <Typography variant="caption" color="text.secondary">
                A zip archive containing the package directory
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" textAlign="center">
              or
            </Typography>

            {/* Folder upload */}
            <Box
              sx={{
                border: "2px dashed",
                borderColor: "divider",
                borderRadius: 2,
                p: 3,
                textAlign: "center",
                cursor: "pointer",
                "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
              }}
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderOpenIcon sx={{ fontSize: 40, color: "action.active", mb: 1 }} />
              <Typography variant="subtitle2">Select package folder</Typography>
              <Typography variant="caption" color="text.secondary">
                The folder containing manifest.yml
              </Typography>
            </Box>
          </Stack>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {warnings.length > 0 && (
          <Stack spacing={1} sx={{ mt: 2 }}>
            <Alert severity="success">Package loaded successfully!</Alert>
            {warnings.map((w, i) => (
              <Alert key={i} severity="warning" sx={{ py: 0.5 }}>
                {w}
              </Alert>
            ))}
          </Stack>
        )}

        {/* Hidden file inputs */}
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          hidden
          onChange={handleZipUpload}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error -- webkitdirectory is non-standard but widely supported
          webkitdirectory=""
          hidden
          onChange={handleFolderUpload}
        />
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
