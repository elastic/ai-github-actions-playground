import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useQueryStore } from "../../src/store/useQueryStore";
import { useOpenInDiscover, openInDiscover } from "../../src/hooks/useOpenInDiscover";

function Wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

beforeEach(() => {
  useQueryStore.getState().resetQueryState();
});

describe("useOpenInDiscover", () => {
  it("sets the discover query draft in the store", () => {
    const { result } = renderHook(() => useOpenInDiscover(), { wrapper: Wrapper });

    act(() => {
      result.current("FROM logs-* | LIMIT 10");
    });

    expect(useQueryStore.getState().discoverQueryDraft).toBe("FROM logs-* | LIMIT 10");
  });

  it("returns a stable callback reference across renders", () => {
    const { result, rerender } = renderHook(() => useOpenInDiscover(), { wrapper: Wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

describe("openInDiscover (non-hook utility)", () => {
  it("sets the discover query draft and calls navigate", () => {
    const navigate = vi.fn();
    openInDiscover(navigate, "FROM metrics-* | LIMIT 5");

    expect(useQueryStore.getState().discoverQueryDraft).toBe("FROM metrics-* | LIMIT 5");
    expect(navigate).toHaveBeenCalledWith("/discover");
  });
});
