import { useRef, useCallback, useState, useEffect } from "react";
import Box from "@mui/material/Box";
import DragHandleIcon from "@mui/icons-material/DragHandle";

interface ResizableSplitPaneProps {
  /** Content rendered in the top pane */
  top: React.ReactNode;
  /** Content rendered in the bottom pane */
  bottom: React.ReactNode;
  /** Initial fraction (0–1) allocated to the top pane. Defaults to 0.5. */
  initialTopFraction?: number;
  /** Minimum height in px for either pane. Defaults to 120. */
  minPaneHeight?: number;
}

/**
 * Vertical resizable split pane.  A draggable divider sits between two flex
 * children. The divider can be dragged with the mouse or moved with the
 * keyboard (Up/Down arrows adjust by 24 px, Home/End jump to min/max).
 */
export default function ResizableSplitPane({
  top,
  bottom,
  initialTopFraction = 0.5,
  minPaneHeight = 120,
}: ResizableSplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // topFraction is the fraction (0–1) of the container height allocated to the
  // top pane.  The bottom pane gets the remainder minus the divider height.
  const [topFraction, setTopFraction] = useState(initialTopFraction);

  // Reset fraction when initialTopFraction changes (e.g. panel appears/disappears).
  useEffect(() => {
    setTopFraction(initialTopFraction);
  }, [initialTopFraction]);

  const clampFraction = useCallback(
    (f: number) => {
      const container = containerRef.current;
      if (!container) return Math.max(0.1, Math.min(0.9, f));
      const h = container.getBoundingClientRect().height;
      if (h <= 0) return f;
      const minFrac = minPaneHeight / h;
      const maxFrac = 1 - minPaneHeight / h;
      return Math.max(minFrac, Math.min(maxFrac, f));
    },
    [minPaneHeight],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const startY = e.clientY;
      const containerRect = container.getBoundingClientRect();
      const startTopFraction = topFraction;

      const onPointerMove = (ev: PointerEvent) => {
        const dy = ev.clientY - startY;
        const newFrac = startTopFraction + dy / containerRect.height;
        setTopFraction(clampFraction(newFrac));
      };

      const onPointerUp = () => {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    },
    [topFraction, clampFraction],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const h = container.getBoundingClientRect().height;
      if (h <= 0) return;
      const step = 24 / h;
      let next = topFraction;

      switch (e.key) {
        case "ArrowUp":
          next -= step;
          break;
        case "ArrowDown":
          next += step;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      setTopFraction(clampFraction(next));
    },
    [topFraction, clampFraction],
  );

  return (
    <Box
      ref={containerRef}
      sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0, overflow: "hidden" }}
    >
      {/* Top pane */}
      <Box
        sx={{
          display: "flex",
          flex: `0 0 ${topFraction * 100}%`,
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {top}
      </Box>

      {/* Divider */}
      <Box
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize trace panels"
        aria-valuenow={Math.round(topFraction * 100)}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        sx={{
          display: "flex",
          flex: "0 0 8px",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: "action.hover",
          color: "text.secondary",
          cursor: "row-resize",
          userSelect: "none",
          "&:hover, &:focus-visible": {
            bgcolor: "action.selected",
          },
          touchAction: "none",
        }}
      >
        <DragHandleIcon sx={{ fontSize: 16 }} />
      </Box>

      {/* Bottom pane */}
      <Box
        sx={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {bottom}
      </Box>
    </Box>
  );
}
