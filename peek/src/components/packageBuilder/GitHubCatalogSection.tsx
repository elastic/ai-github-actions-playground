import { useQuery } from "@tanstack/react-query";
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
  const {
    data: catalog = [],
    isFetching: loading,
    error: queryError,
    refetch,
  } = useQuery<CatalogEntry[]>({
    queryKey: ["package-builder", "input-packages"],
    queryFn: ({ signal }) => listInputPackages(signal),
    enabled: open,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Failed to load catalog"
    : null;

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
            <Button color="inherit" size="small" onClick={() => void refetch()} disabled={loading}>
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
