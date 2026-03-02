import { useId, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import RefreshIcon from "@mui/icons-material/Refresh";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FailedItem {
  name: string;
  reason: string;
}

interface Props {
  items: FailedItem[];
  itemLabel: string;
  listAriaLabel: string;
  retryTooltip: string;
  retryLabel: string;
  onRetry: () => void;
  /** Optional render prop for an action element at the end of each row. */
  renderItemAction?: (item: FailedItem) => ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OverviewFailedItemsSection({
  items,
  itemLabel,
  listAriaLabel,
  retryTooltip,
  retryLabel,
  onRetry,
  renderItemAction,
}: Props) {
  const theme = useTheme();
  const listId = useId();
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
        <IconButton
          size="small"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-controls={listId}
          aria-label={expanded ? `Collapse failed ${itemLabel}s` : `Expand failed ${itemLabel}s`}
        >
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
        <Typography variant="caption" color="error" sx={{ fontWeight: 600 }}>
          {items.length} failed {itemLabel}
          {items.length !== 1 ? "s" : ""}
        </Typography>
        <Tooltip title={retryTooltip}>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<RefreshIcon />}
            onClick={onRetry}
            sx={{ ml: 1 }}
          >
            {retryLabel}
          </Button>
        </Tooltip>
      </Box>
      <Collapse in={expanded} id={listId}>
        <Box
          component="ul"
          sx={{ m: 0, mt: 0.5, p: 0, listStyle: "none" }}
          role="list"
          aria-label={listAriaLabel}
        >
          {items.map((item) => (
            <Box
              key={item.name}
              component="li"
              sx={{
                display: "flex",
                gap: 1,
                alignItems: "center",
                py: 0.5,
                px: 1,
                borderBottom: `1px solid ${theme.palette.divider}`,
              }}
            >
              <ErrorOutlineIcon fontSize="small" color="error" />
              <Typography
                variant="caption"
                sx={{ flex: 1, fontWeight: 600 }}
                noWrap
                title={item.name}
              >
                {item.name}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ flex: 2 }}
                noWrap
                title={item.reason}
              >
                {item.reason}
              </Typography>
              {renderItemAction?.(item)}
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
