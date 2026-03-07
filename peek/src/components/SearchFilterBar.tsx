import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

/**
 * Reusable search + optional toggle bar used above list tables.
 *
 * Renders a compact `TextField` for keyword search and, when `toggleLabel` is
 * provided, a `Switch` toggle (e.g. "Show system indices").  A `<Divider>` is
 * rendered below by default (`divider` prop).
 */

interface SearchFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  searchAriaLabel?: string;
  toggleLabel?: string;
  toggleChecked?: boolean;
  onToggleChange?: (checked: boolean) => void;
  /** Render a bottom divider (default: `true`). */
  divider?: boolean;
}

export default function SearchFilterBar({
  search,
  onSearchChange,
  placeholder = "Search\u2026",
  searchAriaLabel,
  toggleLabel,
  toggleChecked,
  onToggleChange,
  divider = true,
}: SearchFilterBarProps) {
  return (
    <>
      <Box sx={{ p: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          inputProps={{ "aria-label": searchAriaLabel ?? placeholder }}
        />
        {toggleLabel && onToggleChange != null && (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={toggleChecked ?? false}
                onChange={(e) => onToggleChange(e.target.checked)}
                inputProps={{ "aria-label": toggleLabel }}
              />
            }
            label={
              <Typography variant="caption" color="text.secondary">
                {toggleLabel}
              </Typography>
            }
            sx={{ mt: 0.5, ml: 0 }}
          />
        )}
      </Box>
      {divider && <Divider />}
    </>
  );
}
