import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import FleetStatCard from "../../src/components/fleet/FleetStatCard";

describe("FleetStatCard", () => {
  it("renders as a button when onClick is provided", () => {
    render(<FleetStatCard title="Unhealthy" value={3} onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Unhealthy/ })).toBeInTheDocument();
  });

  it("does not render a button when onClick is not provided", () => {
    render(<FleetStatCard title="Total" value={10} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<FleetStatCard title="Offline" value={1} onClick={handleClick} />);
    await user.click(screen.getByRole("button", { name: /Offline/ }));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("calls onClick when Enter is pressed", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<FleetStatCard title="Offline" value={1} onClick={handleClick} />);
    screen.getByRole("button", { name: /Offline/ }).focus();
    await user.keyboard("{Enter}");
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("calls onClick when Space is pressed", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<FleetStatCard title="Offline" value={1} onClick={handleClick} />);
    screen.getByRole("button", { name: /Offline/ }).focus();
    await user.keyboard(" ");
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("renders em dash when value is null", () => {
    render(<FleetStatCard title="Updating" value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
