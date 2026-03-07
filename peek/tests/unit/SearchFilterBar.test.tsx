import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SearchFilterBar from "../../src/components/SearchFilterBar";

describe("SearchFilterBar", () => {
  it("renders a search field with placeholder", () => {
    render(<SearchFilterBar search="" onSearchChange={() => {}} placeholder="Search indices" />);
    expect(screen.getByPlaceholderText("Search indices")).toBeInTheDocument();
  });

  it("calls onSearchChange when typing", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<SearchFilterBar search="" onSearchChange={onSearchChange} placeholder="Search…" />);

    await user.type(screen.getByPlaceholderText("Search…"), "hello");
    expect(onSearchChange).toHaveBeenCalledTimes(5);
  });

  it("renders toggle when toggleLabel is provided", () => {
    render(
      <SearchFilterBar
        search=""
        onSearchChange={() => {}}
        toggleLabel="Show system indices"
        toggleChecked={false}
        onToggleChange={() => {}}
      />,
    );
    expect(screen.getByLabelText("Show system indices")).toBeInTheDocument();
  });

  it("does not render toggle when toggleLabel is omitted", () => {
    render(<SearchFilterBar search="" onSearchChange={() => {}} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("calls onToggleChange when toggle is clicked", async () => {
    const user = userEvent.setup();
    const onToggleChange = vi.fn();
    render(
      <SearchFilterBar
        search=""
        onSearchChange={() => {}}
        toggleLabel="Show defaults"
        toggleChecked={false}
        onToggleChange={onToggleChange}
      />,
    );

    await user.click(screen.getByLabelText("Show defaults"));
    expect(onToggleChange).toHaveBeenCalledWith(true);
  });

  it("renders divider by default", () => {
    const { container } = render(<SearchFilterBar search="" onSearchChange={() => {}} />);
    expect(container.querySelector("hr")).toBeInTheDocument();
  });

  it("hides divider when divider=false", () => {
    const { container } = render(
      <SearchFilterBar search="" onSearchChange={() => {}} divider={false} />,
    );
    expect(container.querySelector("hr")).not.toBeInTheDocument();
  });

  it("uses searchAriaLabel when provided", () => {
    render(
      <SearchFilterBar
        search=""
        onSearchChange={() => {}}
        placeholder="Search streams"
        searchAriaLabel="Search data streams"
      />,
    );
    expect(screen.getByLabelText("Search data streams")).toBeInTheDocument();
  });
});
