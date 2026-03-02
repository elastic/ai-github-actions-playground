import { useCallback, useRef, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import DragHandleIcon from "@mui/icons-material/DragHandle";

const MIN_HEIGHT = 60;
const MAX_HEIGHT = 600;
const KEYBOARD_STEP = 20;

interface ResizableEditorContainerProps {
  height: number;
  onHeightChange: (height: number) => void;
  children: ReactNode;
}

/**
 * Wraps an editor (e.g. CodeMirror) with a draggable bottom handle that lets
 * the user resize the editor vertically. Intermediate drag positions are tracked
 * in local state for smooth visual feedback; `onHeightChange` is called only on
 * drag-end to avoid hammering the persistence layer on every pointermove.
 */
export default function ResizableEditorContainer({
  height,
  onHeightChange,
  children,
}: ResizableEditorContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  const displayHeight = dragHeight ?? height;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      startY.current = e.clientY;
      startHeight.current = height;

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (!dragging.current) return;
        const delta = moveEvent.clientY - startY.current;
        const next = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight.current + delta));
        setDragHeight(next);
      };

      const onPointerEnd = () => {
        dragging.current = false;
        setDragHeight((h) => {
          if (h !== null) onHeightChange(h);
          return null;
        });
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerEnd);
        document.removeEventListener("pointercancel", onPointerEnd);
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerEnd);
      document.addEventListener("pointercancel", onPointerEnd);
    },
    [height, onHeightChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let delta = 0;
      if (e.key === "ArrowDown") delta = KEYBOARD_STEP;
      else if (e.key === "ArrowUp") delta = -KEYBOARD_STEP;
      if (delta === 0) return;
      e.preventDefault();
      onHeightChange(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, height + delta)));
    },
    [height, onHeightChange],
  );

  return (
    <Box ref={containerRef} sx={{ position: "relative" }}>
      <Box sx={{ height: `${displayHeight}px`, overflow: "hidden" }}>{children}</Box>
      <Box
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize editor"
        aria-valuenow={displayHeight}
        aria-valuemin={MIN_HEIGHT}
        aria-valuemax={MAX_HEIGHT}
        tabIndex={0}
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: 12,
          color: "text.secondary",
          opacity: 0.5,
          cursor: "row-resize",
          userSelect: "none",
          "&:hover": { bgcolor: "action.hover", opacity: 1 },
        }}
      >
        <DragHandleIcon sx={{ fontSize: 16 }} />
      </Box>
    </Box>
  );
}
