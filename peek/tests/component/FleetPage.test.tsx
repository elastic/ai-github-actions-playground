import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import FleetAgentPage from "../../src/components/FleetAgentPage";
import FleetPage from "../../src/components/FleetPage";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock } from "../fixtures/test-utils";

const rawRequestMock = vi.fn();

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    rawRequest: rawRequestMock,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function mockFleetResponse() {
  rawRequestMock.mockResolvedValue({
    status: 200,
    body: {
      hits: {
        total: { value: 2, relation: "eq" },
        hits: [
          {
            _id: "agent-1",
            _source: {
              agent: { id: "agent-1" },
              local_metadata: { host: { hostname: "host-1" } },
              policy_id: "policy-a",
              policy_revision_idx: 7,
              active: true,
              last_checkin_status: "online",
              last_checkin: "2026-02-23T00:00:00.000Z",
            },
          },
          {
            _id: "agent-2",
            _source: {
              agent: { id: "agent-2" },
              local_metadata: { host: { hostname: "host-2" } },
              policy_id: "policy-a",
              active: false,
              last_checkin_status: "error",
              last_checkin: "2026-02-22T00:00:00.000Z",
            },
          },
        ],
      },
    },
  });
}

describe("Fleet pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDashboardStore.getState().resetState();
    useDashboardStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
  });

  it("renders agent and policy tables with aggregate health chips", async () => {
    mockFleetResponse();
    render(
      <MemoryRouter initialEntries={["/fleet"]}>
        <Routes>
          <Route path="/fleet" element={<FleetPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("table", { name: "Fleet agents table" })).toBeInTheDocument();
    });
    expect(screen.getByRole("table", { name: "Fleet policies table" })).toBeInTheDocument();
    expect(screen.getByText("Agents: 2")).toBeInTheDocument();
    expect(screen.getByText("online: 1")).toBeInTheDocument();
    expect(screen.getByText("error: 1")).toBeInTheDocument();
    expect(screen.getAllByText("policy-a").length).toBeGreaterThan(0);
  });

  it("opens a dedicated agent detail route when clicking an agent row", async () => {
    mockFleetResponse();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/fleet"]}>
        <Routes>
          <Route path="/fleet" element={<FleetPage />} />
          <Route path="/fleet/agents/:agentId" element={<FleetAgentPage />} />
        </Routes>
        <LocationDisplay />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("host-1")).toBeInTheDocument();
    });
    await user.click(screen.getByText("host-1"));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/fleet/agents/agent-1");
    });
    expect(screen.getByText("Policy and configuration")).toBeInTheDocument();
    expect(screen.getByText("Policy rev: 7")).toBeInTheDocument();
  });
});
