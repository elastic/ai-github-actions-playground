import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import ServicePerformanceCharts from "../../src/components/services/ServicePerformanceCharts";
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
  {
    serviceName: "payment-service",
    requestCount: 800,
    avgLatencyMs: 250.0,
    errorCount: 8,
    errorRate: 0.01,
    uniqueRoutes: 16,
    uniqueSpanNames: 37,
    topRoute: "/payments/:id",
    topSpanName: "GET /payments/:id",
    topError: "Card declined",
    language: "go",
    environment: "staging",
  },
];

describe("ServicePerformanceCharts", () => {
  it("renders nothing when no service rows provided", () => {
    const { container } = render(<ServicePerformanceCharts serviceRows={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders all dashboard panels", () => {
    render(<ServicePerformanceCharts serviceRows={MOCK_ROWS} />);

    expect(screen.getByText("Slowest Services")).toBeInTheDocument();
    expect(screen.getByText("Highest Error Rate")).toBeInTheDocument();
    expect(screen.getByText("Services by Language")).toBeInTheDocument();
    expect(screen.getByText("Services by Environment")).toBeInTheDocument();
  });

  it("shows service names in ranked lists", () => {
    render(<ServicePerformanceCharts serviceRows={MOCK_ROWS} />);

    // All 3 services should appear in ranked lists
    expect(screen.getAllByText("payment-service").length).toBeGreaterThan(0);
    expect(screen.getAllByText("backend-api").length).toBeGreaterThan(0);
    expect(screen.getAllByText("frontend").length).toBeGreaterThan(0);
  });

  it("shows language distribution", () => {
    render(<ServicePerformanceCharts serviceRows={MOCK_ROWS} />);

    expect(screen.getByText("nodejs")).toBeInTheDocument();
    expect(screen.getByText("java")).toBeInTheDocument();
    expect(screen.getByText("go")).toBeInTheDocument();
  });

  it("shows environment distribution", () => {
    render(<ServicePerformanceCharts serviceRows={MOCK_ROWS} />);

    expect(screen.getByText("prod")).toBeInTheDocument();
    expect(screen.getByText("staging")).toBeInTheDocument();
  });
});
