import { useState, useCallback } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useSlotInsight, useInsightSlotContext } from "./InsightSlotHooks";
import { severityGlow, severityColor, pulseSx, popoverMarkdownSx } from "./insightSlotSx";

export interface InsightSlotProps {
  /** Slot identifier that maps to a `SlotInsight` in the context. */
  slotId: string;
  /** The component(s) this slot decorates. */
  children: React.ReactNode;
}

/**
 * Wraps a component with slot-attached insight affordances.
 *
 * When an insight exists for the given `slotId` the wrapper renders:
 * - A subtle severity glow around the children.
 * - A small pulsing indicator dot (keyboard-focusable).
 * - A popover (on click / Enter / Space) showing the insight text as markdown
 *   with refresh and dismiss actions.
 *
 * When no insight is present, or the slot has been dismissed, children are
 * rendered unchanged.
 */
export default function InsightSlot({ slotId, children }: InsightSlotProps) {
  const insight = useSlotInsight(slotId);
  const { loading, refresh } = useInsightSlotContext();

  const [dismissed, setDismissed] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const open = Boolean(anchorEl);

  const handleOpen = useCallback((event: React.SyntheticEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleDismiss = useCallback(() => {
    setAnchorEl(null);
    setDismissed(true);
  }, []);

  // No insight or loading — render children unchanged.
  if (!insight || loading) {
    return <>{children}</>;
  }

  // Dismissed — render children without decoration.
  if (dismissed) {
    return <>{children}</>;
  }

  const severity = insight.severity ?? "info";

  return (
    <Box
      sx={{
        position: "relative",
        display: "inline-flex",
        boxShadow: severityGlow(severity),
        borderRadius: 1,
        transition: "box-shadow 0.3s ease",
      }}
    >
      {children}

      {/* Pulse indicator dot */}
      <ButtonBase
        aria-label={`View ${severity} insight`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={handleOpen}
        sx={[
          {
            position: "absolute",
            top: -4,
            right: -4,
            width: 10,
            minWidth: 0,
            height: 10,
            p: 0,
            borderRadius: "50%",
            bgcolor: severityColor(severity),
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: "primary.main",
              outlineOffset: 2,
            },
          },
          pulseSx,
        ]}
      />

      {/* Insight popover */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { maxWidth: 360, p: 2 } } }}
      >
        <Box sx={popoverMarkdownSx}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{insight.text}</ReactMarkdown>
        </Box>

        <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end", mt: 1 }}>
          <Tooltip title="Refresh insight">
            <IconButton size="small" aria-label="Refresh insight" onClick={refresh}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Dismiss insight">
            <IconButton size="small" aria-label="Dismiss insight" onClick={handleDismiss}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Popover>
    </Box>
  );
}
