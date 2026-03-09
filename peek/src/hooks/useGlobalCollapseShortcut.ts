import { useEffect } from "react";

/**
 * Registers a global Cmd/Ctrl+[ keyboard shortcut that toggles a collapse
 * callback, ignoring key events originating from editable elements.
 *
 * Shared across Discover, Explore/Metrics, and Logs pages to avoid
 * duplicating the same eligibility-guard and dispatch logic.
 */
export function useGlobalCollapseShortcut(onToggle: () => void): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest("input, textarea, select, [contenteditable='true'], .cm-editor") ||
          target.getAttribute("role") === "textbox" ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "[" && !e.repeat) {
        e.preventDefault();
        onToggle();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onToggle]);
}
