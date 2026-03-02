import { useCallback, useEffect, useRef } from "react";

export function useCopyFeedbackTimeout(onReset: () => void, delayMs = 2000) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(onReset, delayMs);
  }, [delayMs, onReset]);
}
