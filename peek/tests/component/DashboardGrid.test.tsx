import { createRef, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DashboardGrid from "../../src/components/DashboardGrid";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { useUIStore } from "../../src/store/useUIStore";
import { resetAllStores } from "../fixtures/test-utils";

vi.mock("../../src/components/PanelContainer", () => ({
  default: ({ panel }: { panel: { id: string; title: string } }) => (
    <div data-testid={`panel-${panel.id}`}>{panel.title}</div>
  ),
}));

vi.mock("react-grid-layout", () => ({
  Responsive: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useContainerWidth: () => ({ width: 1200, containerRef: createRef(), mounted: true }),
}));

describe("DashboardGrid", () => {
  beforeEach(() => {
    resetAllStores();
  });

  it("shows the empty state when there are no panels", () => {
    // Remove all default panels to trigger the empty state
    const panels = useDashboardStore.getState().dashboard.panels;
    for (const p of panels) {
      useDashboardStore.getState().removePanel(p.id);
    }

    render(<DashboardGrid />);

    expect(screen.getByText("No panels yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load default dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add panel/i })).toBeInTheDocument();
  });

  it("renders panels when they exist", () => {
    useDashboardStore.getState().addPanel({
      id: "p1",
      title: "Panel One",
      query: "FROM logs-*",
      visualization: "timeseries",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });

    render(<DashboardGrid />);

    expect(screen.getByText("Panel One")).toBeInTheDocument();
  });

  it("adds a panel and opens the editor when Add Panel is clicked", async () => {
    const user = userEvent.setup();
    // Remove all default panels to show empty state with Add Panel button
    const panels = useDashboardStore.getState().dashboard.panels;
    for (const p of panels) {
      useDashboardStore.getState().removePanel(p.id);
    }

    render(<DashboardGrid />);

    await user.click(screen.getByRole("button", { name: /add panel/i }));

    const updatedPanels = useDashboardStore.getState().dashboard.panels;
    expect(updatedPanels).toHaveLength(1);
    expect(updatedPanels[0]!.title).toBe("New Panel");
    expect(useUIStore.getState().editingPanelId).toBe(updatedPanels[0]!.id);
  });

  it("loads the default dashboard when Load Default Dashboard is clicked", async () => {
    const user = userEvent.setup();
    // Remove all default panels to show empty state
    const panels = useDashboardStore.getState().dashboard.panels;
    for (const p of panels) {
      useDashboardStore.getState().removePanel(p.id);
    }

    render(<DashboardGrid />);

    await user.click(screen.getByRole("button", { name: /load default dashboard/i }));

    const updatedPanels = useDashboardStore.getState().dashboard.panels;
    expect(updatedPanels.length).toBeGreaterThan(0);
  });
});
