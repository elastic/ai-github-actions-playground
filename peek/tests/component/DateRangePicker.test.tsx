import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DateRangePicker from "../../src/components/DateRangePicker";
import { getCustomRangeValidationError } from "../../src/components/dateRangeValidation";

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

  it("returns a specific message for unparsable custom values", () => {
    expect(getCustomRangeValidationError("not-a-date", "2026-02-28T11:00")).toBe(
      "Enter valid date/time values.",
    );
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
});
