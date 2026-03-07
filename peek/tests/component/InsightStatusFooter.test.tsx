import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import InsightStatusFooter from "../../src/components/InsightStatusFooter";
import { useInsightStatusStore } from "../../src/store/useInsightStatusStore";

describe("InsightStatusFooter", () => {
  beforeEach(() => {
    useInsightStatusStore.getState().resetInsightStatus();
  });

  it("renders nothing when no insights and not loading", () => {
    const { container } = render(<InsightStatusFooter />);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("shows loading spinner and message while generating", () => {
    useInsightStatusStore.getState().syncFromProvider({
      loading: true,
      totalInsights: 0,
      error: null,
    });

    render(<InsightStatusFooter />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Generating insights…")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows custom status message while loading", () => {
    useInsightStatusStore.getState().syncFromProvider({
      loading: true,
      totalInsights: 0,
      error: null,
    });
    useInsightStatusStore.getState().setStatusMessage("Analyzing cluster health…");

    render(<InsightStatusFooter />);

    expect(screen.getByText("Analyzing cluster health…")).toBeInTheDocument();
  });

  it("shows insight count badge when insights are available", () => {
    useInsightStatusStore.getState().syncFromProvider({
      loading: false,
      totalInsights: 3,
      error: null,
    });

    render(<InsightStatusFooter />);

    expect(screen.getByText("3 insights")).toBeInTheDocument();
  });

  it("shows singular form for one insight", () => {
    useInsightStatusStore.getState().syncFromProvider({
      loading: false,
      totalInsights: 1,
      error: null,
    });

    render(<InsightStatusFooter />);

    expect(screen.getByText("1 insight")).toBeInTheDocument();
  });

  it("shows 'All insights dismissed' when all are dismissed", () => {
    useInsightStatusStore.getState().syncFromProvider({
      loading: false,
      totalInsights: 2,
      error: null,
    });
    useInsightStatusStore.getState().dismissSlot("slot-a");
    useInsightStatusStore.getState().dismissSlot("slot-b");

    render(<InsightStatusFooter />);

    expect(screen.getByText("All insights dismissed")).toBeInTheDocument();
    // Jump-to-next button should not be present.
    expect(screen.queryByRole("button", { name: /jump to next insight/i })).not.toBeInTheDocument();
  });

  it("shows jump-to-next button when active insights exist", () => {
    useInsightStatusStore.getState().syncFromProvider({
      loading: false,
      totalInsights: 2,
      error: null,
    });

    render(<InsightStatusFooter />);

    expect(screen.getByRole("button", { name: /jump to next insight/i })).toBeInTheDocument();
  });

  it("hides loading indicator and badge during loading", () => {
    useInsightStatusStore.getState().syncFromProvider({
      loading: true,
      totalInsights: 3,
      error: null,
    });

    render(<InsightStatusFooter />);

    // Badge and jump button are hidden during loading.
    expect(screen.queryByText("3 insights")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /jump to next insight/i })).not.toBeInTheDocument();
  });

  it("shows error text when error state is set", () => {
    useInsightStatusStore.getState().syncFromProvider({
      loading: false,
      totalInsights: 0,
      error: "Failed to generate insights",
    });

    render(<InsightStatusFooter />);

    expect(screen.getByText("Insight error")).toBeInTheDocument();
  });

  it("has accessible role=status and aria-label", () => {
    useInsightStatusStore.getState().syncFromProvider({
      loading: false,
      totalInsights: 1,
      error: null,
    });

    render(<InsightStatusFooter />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "Insight status");
  });

  it("jump-to-next scrolls to data-insight-slot-id elements", async () => {
    const user = userEvent.setup();
    useInsightStatusStore.getState().syncFromProvider({
      loading: false,
      totalInsights: 2,
      error: null,
    });

    // Add mock DOM elements with data-insight-slot-id.
    const container = document.createElement("div");
    container.innerHTML =
      '<div data-insight-slot-id="slot-a"><button aria-label="View info insight"></button></div>' +
      '<div data-insight-slot-id="slot-b"><button aria-label="View warning insight"></button></div>';
    document.body.appendChild(container);

    const slotA = container.querySelector<HTMLElement>('[data-insight-slot-id="slot-a"]')!;
    slotA.scrollIntoView = vi.fn();
    const slotB = container.querySelector<HTMLElement>('[data-insight-slot-id="slot-b"]')!;
    slotB.scrollIntoView = vi.fn();

    render(<InsightStatusFooter />);

    const jumpButton = screen.getByRole("button", { name: /jump to next insight/i });

    await user.click(jumpButton);
    expect(slotA.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });

    await user.click(jumpButton);
    expect(slotB.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });

    // Wraps around
    await user.click(jumpButton);
    expect(slotA.scrollIntoView).toHaveBeenCalledTimes(2);

    document.body.removeChild(container);
  });
});
