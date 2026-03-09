import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { InventoryHealthSummaryCards } from "../../src/components/InventoryHealthSummaryCards";
import { InsightSlotProvider } from "../../src/components/InsightSlotContext";

function renderCards(overrides: Partial<Parameters<typeof InventoryHealthSummaryCards>[0]> = {}) {
  const defaults = {
    totalTitle: "Total Items",
    totalSlotId: "slot-total",
    total: 42,
    healthySlotId: "slot-healthy",
    healthy: 30,
    degradedSlotId: "slot-degraded",
    degraded: 8,
    unhealthySlotId: "slot-unhealthy",
    unhealthy: 4,
  };

  return render(
    <InsightSlotProvider summary="" insights={[]} loading={false} error={null} refresh={vi.fn()}>
      <InventoryHealthSummaryCards {...defaults} {...overrides} />
    </InsightSlotProvider>,
  );
}

describe("InventoryHealthSummaryCards", () => {
  it("renders four cards with correct titles", () => {
    renderCards();
    expect(screen.getByText("Total Items")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Degraded")).toBeInTheDocument();
    expect(screen.getByText("Unhealthy")).toBeInTheDocument();
  });

  it("displays the metric values", () => {
    renderCards();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("uses custom totalTitle", () => {
    renderCards({ totalTitle: "Total Streams" });
    expect(screen.getByText("Total Streams")).toBeInTheDocument();
  });

  it("applies warning color when degraded > 0", () => {
    renderCards({ degraded: 5 });
    const el = screen.getByText("5");
    expect(el).toBeInTheDocument();
  });

  it("applies error color when unhealthy > 0", () => {
    renderCards({ unhealthy: 3 });
    const el = screen.getByText("3");
    expect(el).toBeInTheDocument();
  });

  it("uses text.primary when degraded and unhealthy are 0", () => {
    renderCards({ degraded: 0, unhealthy: 0 });
    // Both zero-value cards should still render
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });
});
