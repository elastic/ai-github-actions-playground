import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import OverviewFailedItemsSection from "../../src/components/OverviewFailedItemsSection";

const FAILED_ITEMS = [
  { name: "metric.cpu.usage", reason: "index_not_found_exception" },
  { name: "metric.mem.free", reason: "Unknown error" },
];

describe("OverviewFailedItemsSection", () => {
  it("renders nothing when items is empty", () => {
    const { container } = render(
      <OverviewFailedItemsSection
        items={[]}
        itemLabel="metric"
        listAriaLabel="Failed metrics"
        retryTooltip="Retry all failed metric queries"
        retryLabel="Retry failed"
        onRetry={() => {}}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows item count and labels", () => {
    render(
      <OverviewFailedItemsSection
        items={FAILED_ITEMS}
        itemLabel="metric"
        listAriaLabel="Failed metrics"
        retryTooltip="Retry all failed metric queries"
        retryLabel="Retry failed"
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText("2 failed metrics")).toBeInTheDocument();
    expect(screen.getByText("Retry failed")).toBeInTheDocument();
  });

  it("shows singular label for one item", () => {
    render(
      <OverviewFailedItemsSection
        items={[FAILED_ITEMS[0]]}
        itemLabel="dimension"
        listAriaLabel="Failed dimensions"
        retryTooltip="Retry"
        retryLabel="Retry failed"
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText("1 failed dimension")).toBeInTheDocument();
  });

  it("expands and shows item names and reasons", async () => {
    const user = userEvent.setup();
    render(
      <OverviewFailedItemsSection
        items={FAILED_ITEMS}
        itemLabel="metric"
        listAriaLabel="Failed metrics"
        retryTooltip="Retry all"
        retryLabel="Retry failed"
        onRetry={() => {}}
      />,
    );

    const toggle = screen.getByRole("button", { name: /expand failed metrics/i });
    await user.click(toggle);

    expect(screen.getByText("metric.cpu.usage")).toBeVisible();
    expect(screen.getByText("index_not_found_exception")).toBeVisible();
    expect(screen.getByText("metric.mem.free")).toBeVisible();
  });

  it("calls onRetry when retry button is clicked", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <OverviewFailedItemsSection
        items={FAILED_ITEMS}
        itemLabel="metric"
        listAriaLabel="Failed metrics"
        retryTooltip="Retry all"
        retryLabel="Retry failed"
        onRetry={onRetry}
      />,
    );

    await user.click(screen.getByText("Retry failed"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders custom item actions via renderItemAction", async () => {
    const user = userEvent.setup();
    render(
      <OverviewFailedItemsSection
        items={FAILED_ITEMS}
        itemLabel="metric"
        listAriaLabel="Failed metrics"
        retryTooltip="Retry all"
        retryLabel="Retry failed"
        onRetry={() => {}}
        renderItemAction={(item) => (
          <button data-testid={`action-${item.name}`}>Open {item.name}</button>
        )}
      />,
    );

    // Expand the list first
    await user.click(screen.getByRole("button", { name: /expand failed metrics/i }));

    expect(screen.getByTestId("action-metric.cpu.usage")).toBeVisible();
    expect(screen.getByTestId("action-metric.mem.free")).toBeVisible();
  });
});
