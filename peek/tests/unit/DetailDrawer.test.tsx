import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DetailDrawer from "../../src/components/DetailDrawer";

describe("DetailDrawer", () => {
  it("renders title and children when open", () => {
    render(
      <DetailDrawer open onClose={() => {}} title="My Drawer">
        <div data-testid="drawer-child">Content</div>
      </DetailDrawer>,
    );
    expect(screen.getByText("My Drawer")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-child")).toBeInTheDocument();
  });

  it("does not render children when closed", () => {
    render(
      <DetailDrawer open={false} onClose={() => {}} title="My Drawer">
        <div data-testid="drawer-child">Content</div>
      </DetailDrawer>,
    );
    expect(screen.queryByTestId("drawer-child")).not.toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <DetailDrawer open onClose={onClose} title="My Drawer">
        <div>Content</div>
      </DetailDrawer>,
    );
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("uses custom ariaLabel for close button", () => {
    render(
      <DetailDrawer open onClose={() => {}} title="Details" ariaLabel="Dismiss panel">
        <div>Content</div>
      </DetailDrawer>,
    );
    expect(screen.getByRole("button", { name: "Dismiss panel" })).toBeInTheDocument();
  });

  it("generates default aria-label from title", () => {
    render(
      <DetailDrawer open onClose={() => {}} title="Pipeline details">
        <div>Content</div>
      </DetailDrawer>,
    );
    expect(screen.getByRole("button", { name: "Close pipeline details" })).toBeInTheDocument();
  });
});
