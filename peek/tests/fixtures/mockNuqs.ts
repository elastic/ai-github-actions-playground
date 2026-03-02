import { vi } from "vitest";

vi.mock("nuqs", async () => {
  const React = await import("react");
  const router = await import("react-router-dom");
  const actual = await vi.importActual("nuqs");

  function useQueryStates(
    parsers: Record<string, { parse?: (value: string) => unknown; defaultValue?: unknown }>,
  ) {
    const [searchParams, setSearchParams] = router.useSearchParams();
    const state = React.useMemo(() => {
      const next: Record<string, unknown> = {};
      for (const [key, parser] of Object.entries(parsers)) {
        const raw = searchParams.get(key);
        const parsed = raw === null ? null : (parser.parse?.(raw) ?? raw);
        next[key] = parsed ?? ("defaultValue" in parser ? parser.defaultValue : null);
      }
      return next;
    }, [parsers, searchParams]);

    const setState = React.useCallback(
      async (values: Record<string, unknown>) => {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            for (const [key, value] of Object.entries(values)) {
              if (value === null || typeof value === "undefined") {
                next.delete(key);
              } else {
                next.set(key, String(value));
              }
            }
            return next;
          },
          { replace: true },
        );
      },
      [setSearchParams],
    );

    return [state, setState] as const;
  }

  return { ...actual, useQueryStates };
});
