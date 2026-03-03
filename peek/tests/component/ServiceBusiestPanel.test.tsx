import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ServiceBusiestPanel from "../../src/components/services/ServiceBusiestPanel";
import type { ServiceRow } from "../../src/components/services/serviceInventoryHelpers";

const MOCK_ROWS: ServiceRow[] = [
  {
    serviceName: "frontend",
    requestCount: 1500,
    avgLatencyMs: 45.2,
    errorCount: 30,
    errorRate: 0.02,
    uniqueRoutes: 24,
    uniqueSpanNames: 68,
    topRoute: "/products/:id",
    topSpanName: "GET /products/:id",
    topError: "TimeoutError",
    language: "nodejs",
    environment: "prod",
    version: "1.2.0",
    uniqueVersions: 1,
  },
  {
    serviceName: "backend-api",
    requestCount: 3200,
    avgLatencyMs: 120.5,
    errorCount: 320,
    errorRate: 0.1,
    uniqueRoutes: 40,
    uniqueSpanNames: 102,
    topRoute: "/checkout",
    topSpanName: "POST /checkout",
    topError: "Database timeout",
    language: "java",
    environment: "prod",
    version: "2.0.0",
    uniqueVersions: 2,
  },
];

describe("ServiceBusiestPanel", () => {
  it("renders nothing when no service rows provided", () => {
    const { container } = render(<ServiceBusiestPanel serviceRows={[]} onViewTraces={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders busiest services table", () => {
    render(<ServiceBusiestPanel serviceRows={MOCK_ROWS} onViewTraces={vi.fn()} />);

    expect(screen.getByText("Busiest Services")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Busiest services" })).toBeInTheDocument();
    expect(screen.getByText("backend-api")).toBeInTheDocument();
    expect(screen.getByText("frontend")).toBeInTheDocument();
  });

  it("shows service metadata chips", () => {
    render(<ServiceBusiestPanel serviceRows={MOCK_ROWS} onViewTraces={vi.fn()} />);

    expect(screen.getAllByText("java").length).toBeGreaterThan(0);
    expect(screen.getAllByText("prod").length).toBeGreaterThan(0);
  });

  it("calls onViewTraces when View Traces link is clicked", async () => {
    const user = userEvent.setup();
    const onViewTraces = vi.fn();
    render(<ServiceBusiestPanel serviceRows={MOCK_ROWS} onViewTraces={onViewTraces} />);

    const viewLinks = screen.getAllByRole("button", { name: /View traces for/i });
    expect(viewLinks.length).toBe(2);

    await user.click(viewLinks[0]!);
    expect(onViewTraces).toHaveBeenCalledWith("backend-api");
  });

  it("shows error rate with error color for high rates", () => {
    render(<ServiceBusiestPanel serviceRows={MOCK_ROWS} onViewTraces={vi.fn()} />);

    const chips = screen.getAllByText("10.0%");
    expect(chips.length).toBeGreaterThan(0);
    const errorChip = chips.find(
      // eslint-disable-next-line testing-library/no-node-access -- MUI Chip root
      (el) => el.closest(".MuiChip-root")?.classList.contains("MuiChip-colorError"),
    );
    expect(errorChip).toBeDefined();
  });
});
