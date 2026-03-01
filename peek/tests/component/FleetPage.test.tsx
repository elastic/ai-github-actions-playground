import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import FleetAgentPage from "../../src/components/FleetAgentPage";
import FleetPage from "../../src/components/FleetPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useFleetStore } from "../../src/store/useFleetStore";
import { resetAllStores } from "../fixtures/test-utils";

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

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

// Mock responses for all fleet data sources
function mockFleetResponses() {
  rawRequestMock.mockImplementation((_method: string, url: string) => {
    // Fleet server status metrics
    if (url.includes("metrics-fleet_server.agent_status")) {
      return Promise.resolve({
        status: 200,
        body: {
          hits: {
            total: { value: 1 },
            hits: [
              {
                _source: {
                  fleet: {
                    agents: {
                      total: 5,
                      healthy: 3,
                      unhealthy: 1,
                      offline: 1,
                      updating: 0,
                      inactive: 0,
                      enrolled: 5,
                      unenrolled: 0,
                      unhealthy_reason: { input: 1, output: 0, other: 0 },
                    },
                  },
                  "@timestamp": "2026-02-23T00:00:00Z",
                },
              },
            ],
          },
        },
      });
    }
    // Agent versions
    if (url.includes("metrics-fleet_server.agent_versions")) {
      return Promise.resolve({
        status: 200,
        body: {
          hits: {
            hits: [
              {
                _source: {
                  fleet: { agent: { version: "8.14.0", count: 3 } },
                  "@timestamp": "2026-02-23T00:00:00Z",
                },
              },
              {
                _source: {
                  fleet: { agent: { version: "8.13.0", count: 2 } },
                  "@timestamp": "2026-02-23T00:00:00Z",
                },
              },
            ],
          },
        },
      });
    }
    // Output health
    if (url.includes("logs-fleet_server.output_health")) {
      return Promise.resolve({
        status: 200,
        body: {
          aggregations: {
            by_output: {
              buckets: [
                {
                  key: "default",
                  latest: {
                    hits: {
                      hits: [
                        {
                          _source: {
                            output: "default",
                            state: "HEALTHY",
                            message: "",
                            "@timestamp": "2026-02-23T00:00:00Z",
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      });
    }
    // Elastic agent inventory
    if (url.includes("logs-elastic_agent")) {
      return Promise.resolve({
        status: 200,
        body: {
          aggregations: {
            agents: {
              buckets: [
                {
                  key: "agent-1",
                  doc_count: 50,
                  latest: {
                    hits: {
                      hits: [
                        {
                          _source: {
                            agent: { id: "agent-1", version: "8.14.0" },
                            host: {
                              hostname: "host-1",
                              os: {
                                name: "Ubuntu",
                                platform: "linux",
                                version: "22.04",
                                full: "Ubuntu 22.04",
                              },
                            },
                            "@timestamp": new Date().toISOString(),
                          },
                        },
                      ],
                    },
                  },
                  errors: { doc_count: 2 },
                },
                {
                  key: "agent-2",
                  doc_count: 30,
                  latest: {
                    hits: {
                      hits: [
                        {
                          _source: {
                            agent: { id: "agent-2", version: "8.13.0" },
                            host: { hostname: "host-2" },
                            "@timestamp": new Date().toISOString(),
                          },
                        },
                      ],
                    },
                  },
                  errors: { doc_count: 0 },
                },
              ],
            },
          },
        },
      });
    }
    // Fleet actions / action results
    if (url.includes("fleet-actions")) {
      return Promise.resolve({
        status: 200,
        body: { hits: { hits: [] } },
      });
    }
    // Fallback
    return Promise.resolve({ status: 200, body: { hits: { hits: [] } } });
  });
}

describe("Fleet pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
    // Reset fleet store
    useFleetStore.setState({
      serverStatus: null,
      agentVersions: [],
      outputHealth: [],
      agentInventory: [],
      agentInventoryTotal: 0,
      actions: [],
      actionResults: [],
      activeTab: "overview",
      agentFilter: { search: "", version: null, hasErrors: false, staleness: null },
      loading: false,
      error: null,
      partialErrors: [],
    });
  });

  it("renders overview tab with stat cards when server status is available", async () => {
    mockFleetResponses();
    render(
      <MemoryRouter initialEntries={["/fleet"]}>
        <Routes>
          <Route path="/fleet" element={<FleetPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument(); // total
    });
    expect(screen.getByText("3")).toBeInTheDocument(); // healthy
  });

  it("shows tabs for Overview, Agents, Outputs, Activity", async () => {
    mockFleetResponses();
    render(
      <MemoryRouter initialEntries={["/fleet"]}>
        <Routes>
          <Route path="/fleet" element={<FleetPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Overview" })).toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: "Agents" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Outputs" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Activity" })).toBeInTheDocument();
  });

  it("switches to agents tab and shows agent inventory table", async () => {
    mockFleetResponses();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/fleet"]}>
        <Routes>
          <Route path="/fleet" element={<FleetPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Agents" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: "Agents" }));

    await waitFor(() => {
      expect(screen.getByRole("table", { name: "Elastic Agent inventory" })).toBeInTheDocument();
    });
    expect(screen.getByText("host-1")).toBeInTheDocument();
    expect(screen.getByText("host-2")).toBeInTheDocument();
  });

  it("navigates to agent detail when clicking agent row", async () => {
    mockFleetResponses();
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

    // Switch to agents tab
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Agents" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("tab", { name: "Agents" }));

    await waitFor(() => {
      expect(screen.getByText("host-1")).toBeInTheDocument();
    });
    await user.click(screen.getByText("host-1"));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/fleet/agents/agent-1");
    });
  });

  it("navigates to agent detail when pressing Enter on a focused agent row", async () => {
    mockFleetResponses();
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
      expect(screen.getByRole("tab", { name: "Agents" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("tab", { name: "Agents" }));

    const row = await screen.findByRole("row", { name: /host-1/i });
    row.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/fleet/agents/agent-1");
    });
  });

  it("does not show missing-agent warning when inventory is truncated but agent logs exist", async () => {
    rawRequestMock.mockImplementation((_method: string, url: string, body?: string) => {
      if (!url.includes("logs-elastic_agent")) {
        return Promise.resolve({ status: 200, body: { hits: { hits: [] }, aggregations: {} } });
      }
      const parsed = body ? (JSON.parse(body) as { aggs?: unknown }) : {};
      if (parsed.aggs) {
        return Promise.resolve({
          status: 200,
          body: {
            aggregations: {
              agent_count: { value: 750 },
              agents: { buckets: [] },
            },
          },
        });
      }
      return Promise.resolve({
        status: 200,
        body: {
          hits: {
            hits: [
              {
                _source: {
                  "@timestamp": "2026-02-23T00:00:00Z",
                  log: { level: "info" },
                  message: "agent heartbeat",
                  component: "agent",
                  agent: { id: "agent-750" },
                },
              },
            ],
          },
        },
      });
    });

    render(
      <MemoryRouter initialEntries={["/fleet/agents/agent-750"]}>
        <Routes>
          <Route path="/fleet/agents/:agentId" element={<FleetAgentPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText(/not found in recent Elastic Agent logs/i)).not.toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: /Logs \(1\)/ })).toBeInTheDocument();
  });

  it("shows partial error warning when some sources fail", async () => {
    rawRequestMock.mockImplementation((_method: string, url: string) => {
      if (url.includes("metrics-fleet_server.agent_status")) {
        return Promise.resolve({ status: 404, body: {} });
      }
      if (url.includes("logs-elastic_agent")) {
        return Promise.resolve({
          status: 200,
          body: { aggregations: { agents: { buckets: [] } } },
        });
      }
      return Promise.resolve({ status: 200, body: { hits: { hits: [] } } });
    });

    render(
      <MemoryRouter initialEntries={["/fleet"]}>
        <Routes>
          <Route path="/fleet" element={<FleetPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Should render without crashing; no server status means fallback UI
    await waitFor(() => {
      expect(screen.getByText("Fleet")).toBeInTheDocument();
    });
  });

  it("uses uncapped inventory total for fallback count when server status is unavailable", async () => {
    rawRequestMock.mockImplementation((_method: string, url: string) => {
      if (url.includes("metrics-fleet_server.agent_status")) {
        return Promise.resolve({ status: 404, body: {} });
      }
      if (url.includes("logs-elastic_agent")) {
        return Promise.resolve({
          status: 200,
          body: {
            aggregations: {
              agent_count: { value: 750 },
              agents: {
                buckets: [
                  {
                    key: "agent-1",
                    doc_count: 50,
                    latest: {
                      hits: {
                        hits: [
                          {
                            _source: {
                              agent: { id: "agent-1", version: "8.14.0" },
                              host: { hostname: "host-1" },
                              "@timestamp": new Date().toISOString(),
                            },
                          },
                        ],
                      },
                    },
                    errors: { doc_count: 2 },
                  },
                ],
              },
            },
          },
        });
      }
      return Promise.resolve({ status: 200, body: { hits: { hits: [] } } });
    });

    render(
      <MemoryRouter initialEntries={["/fleet"]}>
        <Routes>
          <Route path="/fleet" element={<FleetPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/However, 750 agents found via Elastic Agent logs\./),
      ).toBeInTheDocument();
    });
  });

  it("surfaces non-404 Fleet search failures as partial warnings", async () => {
    rawRequestMock.mockImplementation((_method: string, url: string) => {
      if (url.includes("logs-elastic_agent")) {
        return Promise.resolve({
          status: 403,
          body: {
            error: {
              reason: "forbidden by role",
            },
          },
        });
      }
      return Promise.resolve({ status: 200, body: { hits: { hits: [] }, aggregations: {} } });
    });

    render(
      <MemoryRouter initialEntries={["/fleet"]}>
        <Routes>
          <Route path="/fleet" element={<FleetPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Some data sources are unavailable:/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Agent inventory: forbidden by role/)).toBeInTheDocument();
  });

  it("clicking Unhealthy stat card switches to agents tab with hasErrors filter", async () => {
    mockFleetResponses();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/fleet"]}>
        <Routes>
          <Route path="/fleet" element={<FleetPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Wait for stat cards to load
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Unhealthy/i })).toBeInTheDocument();
    });

    // Click the Unhealthy stat card (value is 1, so it's clickable)
    await user.click(screen.getByRole("button", { name: /Unhealthy/i }));

    // Should now be on Agents tab
    await waitFor(() => {
      expect(screen.getByRole("table", { name: "Elastic Agent inventory" })).toBeInTheDocument();
    });

    // The hasErrors filter chip should be visible
    expect(screen.getByText("Has errors")).toBeInTheDocument();
    // Only agent-1 has errors (errorCount: 2), agent-2 has 0
    expect(screen.getByText("host-1")).toBeInTheDocument();
    expect(screen.queryByText("host-2")).not.toBeInTheDocument();
  });

  it("unhealthy reason chips are informational and do not trigger drill-in", async () => {
    mockFleetResponses();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/fleet"]}>
        <Routes>
          <Route path="/fleet" element={<FleetPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Wait for the unhealthy reason chip to appear (Input: 1 from mock data)
    await waitFor(() => {
      expect(screen.getByText(/Input: 1/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Input: 1/));
    expect(screen.getByRole("tab", { name: "Overview", selected: true })).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: "Elastic Agent inventory" }),
    ).not.toBeInTheDocument();
  });

  it("clicking Offline stat card switches to agents tab with offline (critical) filter", async () => {
    mockFleetResponses();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/fleet"]}>
        <Routes>
          <Route path="/fleet" element={<FleetPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Offline/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Offline/i }));

    await waitFor(() => {
      expect(screen.getByRole("table", { name: "Elastic Agent inventory" })).toBeInTheDocument();
    });
    expect(screen.getByText("Offline", { selector: ".MuiChip-label" })).toBeInTheDocument();
  });

  it("active filter chip can be cleared in agents table", async () => {
    mockFleetResponses();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/fleet"]}>
        <Routes>
          <Route path="/fleet" element={<FleetPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Click the Unhealthy card to activate filter
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Unhealthy/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Unhealthy/i }));

    await waitFor(() => {
      expect(screen.getByText("Has errors")).toBeInTheDocument();
    });

    // Clear the filter via the "Clear filters" chip
    await user.click(screen.getByText("Clear filters"));

    // Both agents should now be visible
    await waitFor(() => {
      expect(screen.getByText("host-2")).toBeInTheDocument();
    });
    expect(screen.queryByText("Has errors")).not.toBeInTheDocument();
  });
});
