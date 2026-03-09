import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { renderWithA11y } from "../helpers/renderWithA11y";
import ToolbarRow from "../../src/components/ToolbarRow";

describe("ToolbarRow", () => {
  it("has no accessibility violations", async () => {
    await renderWithA11y(
      <ToolbarRow>
        <button>Action</button>
      </ToolbarRow>,
    );
  });

  it("renders children", () => {
    render(
      <ToolbarRow>
        <span>Child A</span>
        <span>Child B</span>
      </ToolbarRow>,
    );

    expect(screen.getByText("Child A")).toBeInTheDocument();
    expect(screen.getByText("Child B")).toBeInTheDocument();
  });

  it("renders a single container element", () => {
    const { container } = render(
      <ToolbarRow>
        <span>Item</span>
      </ToolbarRow>,
    );

    expect(container.childElementCount).toBe(1);
    expect(container.firstElementChild).toContainElement(screen.getByText("Item"));
  });

  it("accepts additional sx overrides", () => {
    const { container } = render(
      <ToolbarRow sx={{ mb: 2 }}>
        <span>Item</span>
      </ToolbarRow>,
    );

    expect(container.firstElementChild).toHaveStyle({ marginBottom: "16px" });
    expect(screen.getByText("Item")).toBeInTheDocument();
  });
});
