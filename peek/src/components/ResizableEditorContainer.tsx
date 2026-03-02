import { useCallback, useRef, type ReactNode } from "react";
import Box from "@mui/material/Box";
import DragHandleIcon from "@mui/icons-material/DragHandle";

const MIN_HEIGHT = 60;
const MAX_HEIGHT = 600;

interface ResizableEditorContainerProps {
  height: number;
  onHeightChange: (height: number) => void;
  children: ReactNode;
}

/**
 * Wraps an editor (e.g. CodeMirror) with a draggable bottom handle that lets
 * the user resize the editor vertically. The container reports the new height
 * via `onHeightChange` so it can be persisted externally.
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
        onHeightChange(next);
      };

      const onPointerUp = () => {
        dragging.current = false;
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    },
    [height, onHeightChange],
  );

  return (
    <Box ref={containerRef} sx={{ position: "relative" }}>
      <Box sx={{ height: `${height}px`, overflow: "hidden" }}>{children}</Box>
      <Box
        onPointerDown={handlePointerDown}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize editor"
        aria-valuenow={height}
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
