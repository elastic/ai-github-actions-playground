import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import GitHubIcon from "@mui/icons-material/GitHub";

import { listInputPackages, type CatalogEntry } from "../../services/packageBuilder/githubCatalog";

interface Props {
  open: boolean;
  onSelect: (entry: CatalogEntry) => void;
}

export default function GitHubCatalogSection({ open, onSelect }: Props) {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const entries = await listInputPackages(signal);
      if (signal.aborted) return;
      setCatalog(entries);
    } catch (err) {
      if (signal.aborted) return;
      setError(err instanceof Error ? err.message : "Failed to load catalog");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  const handleRetry = useCallback(() => {
    const controller = new AbortController();
    void loadCatalog(controller.signal);
  }, [loadCatalog]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void loadCatalog(controller.signal);
    return () => {
      controller.abort();
    };
  }, [open, loadCatalog]);

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <GitHubIcon sx={{ fontSize: 20, color: "text.secondary" }} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Load from elastic/integrations
        </Typography>
      </Box>
      {error ? (
        <Alert
          severity="warning"
          sx={{ py: 0.5, mb: 1.5 }}
          action={
            <Button color="inherit" size="small" onClick={handleRetry} disabled={loading}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}
      <Autocomplete
        options={catalog}
        getOptionLabel={(o) => o.label}
        loading={loading}
        onChange={(_, entry) => {
          if (entry) onSelect(entry);
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search input packages..."
            size="small"
            inputProps={{
              ...params.inputProps,
              "aria-label": "Search input packages",
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
    </Box>
  );
}
