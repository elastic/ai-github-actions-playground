import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { renderWithA11y } from "../helpers/renderWithA11y";
import DetailSurface from "../../src/components/DetailSurface";

describe("DetailSurface", () => {
  it("has no accessibility violations", async () => {
    const result = await renderWithA11y(
      <DetailSurface open={true} onClose={() => {}} title="Test Detail">
        <p>Detail content</p>
      </DetailSurface>,
    );
    const a11yResults = await axe(result.baseElement, {
      rules: {
        region: { enabled: false },
      },
    });
    expect(a11yResults).toHaveNoViolations();
  });

  it("renders the title and children when open", () => {
    render(
      <DetailSurface open={true} onClose={() => {}} title="Node Details">
        <div>Node info here</div>
      </DetailSurface>,
    );

    expect(screen.getByText("Node Details")).toBeInTheDocument();
    expect(screen.getByText("Node info here")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <DetailSurface open={true} onClose={onClose} title="Task Details">
        <div>Task content</div>
      </DetailSurface>,
    );

    await userEvent.click(screen.getByLabelText("Close Task Details"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uses custom ariaLabel for the close button", () => {
    render(
      <DetailSurface
        open={true}
        onClose={() => {}}
        title="ILM Details"
        ariaLabel="Close ILM details"
      >
        <div>ILM content</div>
      </DetailSurface>,
    );

    expect(screen.getByLabelText("Close ILM details")).toBeInTheDocument();
  });

  it("renders a footer when provided", () => {
    render(
      <DetailSurface
        open={true}
        onClose={() => {}}
        title="With Footer"
        footer={<div>Footer actions</div>}
      >
        <div>Body</div>
      </DetailSurface>,
    );

    expect(screen.getByText("Footer actions")).toBeInTheDocument();
  });

  it("renders a mobile top offset so close actions stay below the app header", () => {
    render(
      <DetailSurface open={true} onClose={() => {}} title="Mobile Detail">
        <div>Body</div>
      </DetailSurface>,
    );

    expect(screen.getByTestId("detail-surface-mobile-offset")).toBeInTheDocument();
  });
});
