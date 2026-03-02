import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import ResizableSplitPane from "../../src/components/ResizableSplitPane";

describe("ResizableSplitPane", () => {
  it("renders both top and bottom children", () => {
    render(
      <ResizableSplitPane
        top={<div data-testid="top-pane">Top Content</div>}
        bottom={<div data-testid="bottom-pane">Bottom Content</div>}
      />,
    );

    expect(screen.getByTestId("top-pane")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-pane")).toBeInTheDocument();
  });

  it("renders an accessible separator", () => {
    render(<ResizableSplitPane top={<div>Top</div>} bottom={<div>Bottom</div>} />);

    const separator = screen.getByRole("separator");
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveAttribute("aria-orientation", "horizontal");
    expect(separator).toHaveAttribute("aria-label", "Resize trace panels");
    expect(separator).toHaveAttribute("tabindex", "0");
  });

  it("reports the initial split ratio via aria-valuenow", () => {
    render(
      <ResizableSplitPane
        top={<div>Top</div>}
        bottom={<div>Bottom</div>}
        initialTopFraction={0.6}
      />,
    );

    const separator = screen.getByRole("separator");
    expect(separator).toHaveAttribute("aria-valuenow", "60");
  });

  it("defaults to 50% split when no initialTopFraction is specified", () => {
    render(<ResizableSplitPane top={<div>Top</div>} bottom={<div>Bottom</div>} />);

    const separator = screen.getByRole("separator");
    expect(separator).toHaveAttribute("aria-valuenow", "50");
  });
});
