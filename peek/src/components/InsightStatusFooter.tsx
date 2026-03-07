import { useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

import { useInsightStatusStore } from "../store/useInsightStatusStore";

/** Selector for the data attribute set by InsightSlot. */
const INSIGHT_SLOT_SELECTOR = "[data-insight-slot-id]";

/** How long the outline highlight stays visible after jumping to an insight. */
const HIGHLIGHT_FLASH_MS = 1200;

/** Delay before auto-opening the popover so the scroll animation finishes first. */
const POPOVER_OPEN_DELAY_MS = 400;

/**
 * Compact footer status indicator for the insight annotation layer.
 *
 * Shows:
 * - A sparkle icon + loading spinner while insights are being generated.
 * - A badge with the count of active (undismissed) insights.
 * - A "jump to next" button that scrolls to the next undismissed insight.
 * - An optional status message (e.g. current tool call).
 *
 * Renders nothing when there are no insights and nothing is loading.
 */
export default function InsightStatusFooter() {
  const loading = useInsightStatusStore((s) => s.loading);
  const totalInsights = useInsightStatusStore((s) => s.totalInsights);
  const dismissedSlotIds = useInsightStatusStore((s) => s.dismissedSlotIds);
  const error = useInsightStatusStore((s) => s.error);
  const statusMessage = useInsightStatusStore((s) => s.statusMessage);

  const lastScrolledIndex = useRef(-1);

  const activeCount = totalInsights - dismissedSlotIds.size;
  const hasInsights = totalInsights > 0;
  const hasActive = activeCount > 0;

  const handleJumpToNext = useCallback(() => {
    const slots = Array.from(document.querySelectorAll<HTMLElement>(INSIGHT_SLOT_SELECTOR));
    if (slots.length === 0) return;

    // Filter to undismissed slots only.
    const active = slots.filter((el) => !dismissedSlotIds.has(el.dataset.insightSlotId ?? ""));
    if (active.length === 0) return;

    // Cycle through active slots.
    const nextIndex = (lastScrolledIndex.current + 1) % active.length;
    lastScrolledIndex.current = nextIndex;
    const target = active[nextIndex] as HTMLElement | undefined;
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });

    // Flash the glow briefly to highlight the target.
    const prev = target.style.outline;
    target.style.outline = "2px solid";
    target.style.outlineOffset = "2px";
    const timer = setTimeout(() => {
      target.style.outline = prev;
      target.style.outlineOffset = "";
    }, HIGHLIGHT_FLASH_MS);

    // Click the insight indicator to open the popover.
    const indicator = target.querySelector<HTMLElement>('[aria-label*="insight"]');
    if (indicator) {
      setTimeout(() => indicator.click(), POPOVER_OPEN_DELAY_MS);
    }

    return () => clearTimeout(timer);
  }, [dismissedSlotIds]);

  // Nothing to show.
  if (!loading && !hasInsights && !error) {
    return null;
  }

  return (
    <Box
      role="status"
      aria-label="Insight status"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        ml: "auto",
      }}
    >
      {/* Status message (e.g. "Analyzing…" or current tool call) */}
      {loading && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <CircularProgress size={12} thickness={5} />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              maxWidth: 200,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {statusMessage ?? "Generating insights…"}
          </Typography>
        </Box>
      )}

      {/* Error state */}
      {!loading && error && (
        <Typography
          variant="caption"
          color="error.main"
          sx={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          Insight error
        </Typography>
      )}

      {/* Insight count badge */}
      {!loading && hasInsights && (
        <Chip
          icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
          label={
            hasActive
              ? `${activeCount} insight${activeCount !== 1 ? "s" : ""}`
              : "All insights dismissed"
          }
          size="small"
          variant="outlined"
          color={hasActive ? "info" : "default"}
          sx={{ height: 24, fontSize: "0.7rem", "& .MuiChip-icon": { ml: 0.5 } }}
        />
      )}

      {/* Jump to next button */}
      {!loading && hasActive && (
        <Tooltip title="Jump to next insight">
          <IconButton
            size="small"
            aria-label="Jump to next insight"
            onClick={handleJumpToNext}
            sx={{ width: 24, height: 24, p: 0 }}
          >
            <KeyboardArrowDownIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
