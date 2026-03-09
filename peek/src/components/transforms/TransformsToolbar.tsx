import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";

const ALL_STATES = "all";

interface TransformsToolbarProps {
  search: string;
  stateFilter: string;
  showOnlyUnhealthy: boolean;
  onSearchChange: (value: string) => void;
  onStateFilterChange: (value: string) => void;
  onShowOnlyUnhealthyChange: (value: boolean) => void;
}

export default function TransformsToolbar({
  search,
  stateFilter,
  showOnlyUnhealthy,
  onSearchChange,
  onStateFilterChange,
  onShowOnlyUnhealthyChange,
}: TransformsToolbarProps) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
      <TextField
        size="small"
        label="Search by transform ID"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{ minWidth: 220 }}
      />
      <TextField
        select
        size="small"
        label="State"
        value={stateFilter}
        onChange={(e) => onStateFilterChange(e.target.value)}
        sx={{ minWidth: 140 }}
      >
        <MenuItem value={ALL_STATES}>All states</MenuItem>
        <MenuItem value="started">Started</MenuItem>
        <MenuItem value="indexing">Indexing</MenuItem>
        <MenuItem value="stopped">Stopped</MenuItem>
        <MenuItem value="failed">Failed</MenuItem>
        <MenuItem value="aborting">Aborting</MenuItem>
        <MenuItem value="stopping">Stopping</MenuItem>
      </TextField>
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={showOnlyUnhealthy}
            onChange={(e) => onShowOnlyUnhealthyChange(e.target.checked)}
          />
        }
        label="Show only unhealthy"
      />
    </Stack>
  );
}
