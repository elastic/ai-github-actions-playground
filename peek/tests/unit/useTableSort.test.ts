// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useTableSort } from "../../src/hooks/useTableSort";

describe("useTableSort", () => {
  it("initialises with the given field and default asc direction", () => {
    const { result } = renderHook(() => useTableSort<"name" | "size">("name"));
    expect(result.current.sortField).toBe("name");
    expect(result.current.sortDirection).toBe("asc");
  });

  it("initialises with a custom default direction", () => {
    const { result } = renderHook(() => useTableSort<"name" | "duration">("duration", "desc"));
    expect(result.current.sortField).toBe("duration");
    expect(result.current.sortDirection).toBe("desc");
  });

  it("toggles direction when clicking the same field", () => {
    const { result } = renderHook(() => useTableSort<"a" | "b">("a", "asc"));

    act(() => result.current.handleSort("a"));
    expect(result.current.sortDirection).toBe("desc");

    act(() => result.current.handleSort("a"));
    expect(result.current.sortDirection).toBe("asc");
  });

  it("uses defaultDirection when switching to a new field (asc default)", () => {
    const { result } = renderHook(() => useTableSort<"a" | "b">("a", "asc"));

    // Toggle current field to desc first
    act(() => result.current.handleSort("a"));
    expect(result.current.sortDirection).toBe("desc");

    // Switch to a different field — should reset to defaultDirection (asc)
    act(() => result.current.handleSort("b"));
    expect(result.current.sortField).toBe("b");
    expect(result.current.sortDirection).toBe("asc");
  });

  it("uses defaultDirection when switching to a new field (desc default)", () => {
    const { result } = renderHook(() => useTableSort<"name" | "duration">("duration", "desc"));

    // Toggle current field to asc first
    act(() => result.current.handleSort("duration"));
    expect(result.current.sortDirection).toBe("asc");

    // Switch to a different field — should reset to defaultDirection (desc)
    act(() => result.current.handleSort("name"));
    expect(result.current.sortField).toBe("name");
    expect(result.current.sortDirection).toBe("desc");
  });

  it("getSortLabelProps returns defaultDirection for inactive columns", () => {
    const { result } = renderHook(() => useTableSort<"a" | "b">("a", "desc"));

    const props = result.current.getSortLabelProps("b");
    expect(props.active).toBe(false);
    expect(props.direction).toBe("desc");
  });

  it("getSortLabelProps returns current direction for active column", () => {
    const { result } = renderHook(() => useTableSort<"a" | "b">("a", "desc"));

    const props = result.current.getSortLabelProps("a");
    expect(props.active).toBe(true);
    expect(props.direction).toBe("desc");
  });

  it("exposes setters to update sort state programmatically", () => {
    const { result } = renderHook(() => useTableSort<"a" | "b">("a", "asc"));

    act(() => result.current.setSortField("b"));
    expect(result.current.sortField).toBe("b");

    act(() => result.current.setSortDirection("desc"));
    expect(result.current.sortDirection).toBe("desc");
  });

  it("getSortLabelProps onClick delegates to handleSort", () => {
    const { result } = renderHook(() => useTableSort<"a" | "b">("a", "asc"));

    act(() => result.current.getSortLabelProps("a").onClick());
    expect(result.current.sortDirection).toBe("desc");
  });
});
