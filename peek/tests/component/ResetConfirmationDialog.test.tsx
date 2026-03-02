import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ResetConfirmationDialog from "../../src/components/ResetConfirmationDialog";

describe("ResetConfirmationDialog", () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    onConfirm.mockClear();
    onCancel.mockClear();
  });

  it("renders dialog title and affected state items when open", () => {
    render(<ResetConfirmationDialog open onConfirm={onConfirm} onCancel={onCancel} />);

    expect(screen.getByText("Reset all application state?")).toBeInTheDocument();
    expect(screen.getByText("Connection settings and credentials")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
  });

  it("calls onConfirm when the Reset button is clicked", async () => {
    const user = userEvent.setup();
    render(<ResetConfirmationDialog open onConfirm={onConfirm} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the Cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<ResetConfirmationDialog open onConfirm={onConfirm} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not render dialog content when closed", () => {
    render(<ResetConfirmationDialog open={false} onConfirm={onConfirm} onCancel={onCancel} />);

    expect(screen.queryByText("Reset all application state?")).not.toBeInTheDocument();
  });
});
