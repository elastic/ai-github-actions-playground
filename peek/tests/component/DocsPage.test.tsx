import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

import DocsPage from "../../src/components/DocsPage";
import { resetAllStores } from "../fixtures/test-utils";

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

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname + location.search}</div>;
}

describe("DocsPage", () => {
  beforeEach(() => {
    resetAllStores();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("hydrates search input from ?q", async () => {
    render(
      <MemoryRouter initialEntries={["/docs?q=keyboard"]}>
        <Routes>
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("textbox", { name: "Search docs" })).toHaveValue("keyboard");
  });

  it("writes ?q as docs search changes", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/docs"]}>
        <Routes>
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
        <LocationDisplay />
      </MemoryRouter>,
    );

    const input = await screen.findByRole("textbox", { name: "Search docs" });
    await user.type(input, "connect");

    await waitFor(() => {
      expect(screen.getByTestId("location-display").textContent).toBe("/docs?q=connect");
    });
  });

  it("preserves ?q when changing sections", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/docs?q=keyboard"]}>
        <Routes>
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
        <LocationDisplay />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Tips & Shortcuts" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-display").textContent).toContain("/docs?q=keyboard");
    })
    expect(screen.getByTestId("location-display").textContent).toContain(
        "section=keyboard-shortcuts",
      );;
  });
});
