import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DateRangePicker from "../../src/components/DateRangePicker";

describe("DateRangePicker", () => {
  const defaultRange = {
    from: "2026-02-28T10:00:00.000Z",
    to: "2026-02-28T11:00:00.000Z",
  };

  it("shows inline validation when either custom value is empty", async () => {
    const user = userEvent.setup();
    render(<DateRangePicker value={defaultRange} onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /time range:/i }));

    await user.clear(screen.getByLabelText("From"));

    expect(screen.getAllByText("Select both From and To dates.")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("shows inline validation when from is after to", async () => {
    const user = userEvent.setup();
    render(<DateRangePicker value={defaultRange} onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /time range:/i }));

    await user.clear(screen.getByLabelText("To"));
    await user.type(screen.getByLabelText("To"), "2026-02-28T11:00");
    await user.clear(screen.getByLabelText("From"));
    await user.type(screen.getByLabelText("From"), "2026-02-28T12:00");

    expect(screen.getAllByText("From must be earlier than To.")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("shows inline validation when from equals to", async () => {
    const user = userEvent.setup();
    render(<DateRangePicker value={defaultRange} onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /time range:/i }));

    await user.clear(screen.getByLabelText("To"));
    await user.type(screen.getByLabelText("To"), "2026-02-28T11:00");
    await user.clear(screen.getByLabelText("From"));
    await user.type(screen.getByLabelText("From"), "2026-02-28T11:00");

    expect(screen.getAllByText("From must be earlier than To.")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("applies a valid custom range", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateRangePicker value={defaultRange} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /time range:/i }));

    await user.clear(screen.getByLabelText("From"));
    await user.type(screen.getByLabelText("From"), "2026-02-28T09:00");
    await user.clear(screen.getByLabelText("To"));
    await user.type(screen.getByLabelText("To"), "2026-02-28T10:00");

    const applyButton = screen.getByRole("button", { name: "Apply" });
    expect(applyButton).not.toBeDisabled();
    await user.click(applyButton);
    const expectedFrom = new Date("2026-02-28T09:00").toISOString();
    const expectedTo = new Date("2026-02-28T10:00").toISOString();
    expect(onChange).toHaveBeenCalledWith({
      from: expectedFrom,
      to: expectedTo,
    });
  });
});
