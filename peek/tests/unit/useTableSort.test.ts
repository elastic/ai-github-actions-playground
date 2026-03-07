// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useTableSort } from "../../src/hooks/useTableSort";

describe("useTableSort", () => {
  it("returns the default field and direction", () => {
    const { result } = renderHook(() => useTableSort<"name" | "size">("name"));
    expect(result.current.sortField).toBe("name");
    expect(result.current.sortDirection).toBe("asc");
  });

  it("respects a custom default direction", () => {
    const { result } = renderHook(() => useTableSort<"count">("count", "desc"));
    expect(result.current.sortField).toBe("count");
    expect(result.current.sortDirection).toBe("desc");
  });

  it("toggles direction when the same field is clicked", () => {
    const { result } = renderHook(() => useTableSort<"name" | "size">("name"));
    expect(result.current.sortDirection).toBe("asc");

    act(() => result.current.handleSort("name"));
    expect(result.current.sortField).toBe("name");
    expect(result.current.sortDirection).toBe("desc");

    act(() => result.current.handleSort("name"));
    expect(result.current.sortDirection).toBe("asc");
  });

  it("resets to asc when switching to a new field", () => {
    const { result } = renderHook(() => useTableSort<"name" | "size">("name"));

    // Toggle name to desc
    act(() => result.current.handleSort("name"));
    expect(result.current.sortDirection).toBe("desc");

    // Switch to size → resets to asc
    act(() => result.current.handleSort("size"));
    expect(result.current.sortField).toBe("size");
    expect(result.current.sortDirection).toBe("asc");
  });

  it("getSortLabelProps returns correct props for active field", () => {
    const { result } = renderHook(() => useTableSort<"name" | "size">("name"));
    const props = result.current.getSortLabelProps("name");
    expect(props.active).toBe(true);
    expect(props.direction).toBe("asc");
    expect(typeof props.onClick).toBe("function");
  });

  it("getSortLabelProps returns correct props for inactive field", () => {
    const { result } = renderHook(() => useTableSort<"name" | "size">("name"));
    const props = result.current.getSortLabelProps("size");
    expect(props.active).toBe(false);
    expect(props.direction).toBe("asc");
  });

  it("getSortLabelProps onClick toggles direction", () => {
    const { result } = renderHook(() => useTableSort<"name" | "size">("name"));
    act(() => result.current.getSortLabelProps("name").onClick());
    expect(result.current.sortDirection).toBe("desc");
  });

  it("exposes setSortField and setSortDirection for advanced usage", () => {
    const { result } = renderHook(() => useTableSort<"a" | "b">("a"));

    act(() => {
      result.current.setSortField("b");
      result.current.setSortDirection("desc");
    });

    expect(result.current.sortField).toBe("b");
    expect(result.current.sortDirection).toBe("desc");
  });
});
