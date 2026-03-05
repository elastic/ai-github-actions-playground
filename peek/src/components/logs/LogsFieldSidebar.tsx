import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

interface LogsFieldSidebarProps {
  sidebarFields: string[];
  fieldValues: Record<string, Array<{ value: string; count: number }>>;
  extractedFieldValues: Record<string, Array<{ value: string; count: number }>>;
  fieldValuesLoading: boolean;
  fieldValuesError: string | null;
  onCellFilter: (field: string, value: string, exclude: boolean) => void;
}

export default function LogsFieldSidebar({
  sidebarFields,
  fieldValues,
  extractedFieldValues,
  fieldValuesLoading,
  fieldValuesError,
  onCellFilter,
}: LogsFieldSidebarProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        display: { lg: "block", xs: "none" },
        flexShrink: 0,
        width: 280,
        overflow: "hidden",
      }}
    >
      <Box sx={{ p: 1 }}>
        <Typography variant="subtitle1">Field Filters</Typography>
        <Typography variant="caption" color="text.secondary">
          Click + to include or - to exclude
        </Typography>
      </Box>
      <Divider />
      {fieldValuesLoading && <LinearProgress />}
      {fieldValuesError && (
        <Typography variant="caption" color="error" sx={{ display: "block", p: 1.5 }}>
          Failed to load field values.
        </Typography>
      )}
      {!fieldValuesLoading && !fieldValuesError && (
        <List dense disablePadding>
          {sidebarFields.map((field) => [
            <ListSubheader
              key={`${field}-header`}
              disableSticky
              sx={{ py: 0.5, lineHeight: "normal" }}
            >
              <Typography variant="caption">{field}</Typography>
            </ListSubheader>,
            ...(fieldValues[field] ?? extractedFieldValues[field] ?? []).map((entry) => (
              <ListItem key={`${field}-${entry.value}`} disablePadding>
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ alignItems: "center", width: "100%", pl: 2, py: 0.5 }}
                >
                  <ListItemText
                    primary={
                      <Typography variant="caption" noWrap title={entry.value}>
                        {entry.value}
                      </Typography>
                    }
                    secondary={`${entry.count.toLocaleString()} docs`}
                  />
                  <Stack direction="row" spacing={0.5}>
                    <Button
                      size="small"
                      variant="text"
                      aria-label={`Include ${field} ${entry.value}`}
                      onClick={() => onCellFilter(field, entry.value, false)}
                    >
                      <AddIcon fontSize="inherit" />
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      aria-label={`Exclude ${field} ${entry.value}`}
                      onClick={() => onCellFilter(field, entry.value, true)}
                    >
                      <RemoveIcon fontSize="inherit" />
                    </Button>
                  </Stack>
                </Stack>
              </ListItem>
            )),
            <Divider key={`${field}-divider`} component="li" aria-hidden />,
          ])}
        </List>
      )}
    </Paper>
  );
}
