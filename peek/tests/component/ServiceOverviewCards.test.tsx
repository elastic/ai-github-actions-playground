import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import ServiceOverviewCards from "../../src/components/services/ServiceOverviewCards";
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
  },
];

describe("ServiceOverviewCards", () => {
  it("renders nothing when no service rows provided", () => {
    const { container } = render(<ServiceOverviewCards serviceRows={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders KPI cards with correct values", () => {
    render(<ServiceOverviewCards serviceRows={MOCK_ROWS} />);

    expect(screen.getByText("Total Services")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Total Requests")).toBeInTheDocument();
    expect(screen.getByText("4,700")).toBeInTheDocument();
    expect(screen.getByText("Avg Latency")).toBeInTheDocument();
    expect(screen.getByText("Error Rate")).toBeInTheDocument();
  });

  it("shows high overall error rate value", () => {
    const highErrorRows: ServiceRow[] = [
      {
        ...MOCK_ROWS[0]!,
        requestCount: 100,
        errorCount: 10,
        errorRate: 0.1,
      },
    ];
    render(<ServiceOverviewCards serviceRows={highErrorRows} />);

    expect(screen.getByText("10.0%")).toBeInTheDocument();
  });
});
