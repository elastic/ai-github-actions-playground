import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import FleetAgentsTable from "../../src/components/fleet/FleetAgentsTable";
import { usePageFiltersStore } from "../../src/store/usePageFiltersStore";
import type { ElasticAgentInfo } from "../../src/services/fleet";

const makeAgent = (
  overrides: Partial<ElasticAgentInfo> & { agentId: string },
): ElasticAgentInfo => ({
  hostname: `host-${overrides.agentId}`,
  version: "8.0.0",
  os: { name: "Linux", platform: "linux", version: "1", full: "Linux" },
  lastSeen: "2026-03-03T00:00:00Z",
  logCount: 1,
  errorCount: 0,
  status: "online",
  policyId: "policy-a",
  ...overrides,
});

const agents: ElasticAgentInfo[] = [
  makeAgent({ agentId: "a-1", version: "8.9.0" }),
  makeAgent({ agentId: "a-2", version: "8.10.0" }),
  makeAgent({ agentId: "a-3", version: "7.17.0" }),
];

describe("FleetAgentsTable version sorting", () => {
  beforeEach(() => {
    usePageFiltersStore.getState().resetFleetFilters();
  });

  it("sorts versions semantically in ascending order", async () => {
    const user = userEvent.setup();
    render(<FleetAgentsTable agents={agents} onAgentClick={() => {}} />);

    // Click the Version sort header
    await user.click(screen.getByRole("button", { name: "Version" }));

    const rows = screen.getAllByRole("row").slice(1); // skip header
    const versions = rows.map((row) => within(row).getAllByRole("cell")[2]?.textContent);

    expect(versions).toEqual(["7.17.0", "8.9.0", "8.10.0"]);
  });

  it("sorts versions semantically in descending order", async () => {
    const user = userEvent.setup();
    render(<FleetAgentsTable agents={agents} onAgentClick={() => {}} />);

    // Click twice: first sets ascending, second sets descending
    await user.click(screen.getByRole("button", { name: "Version" }));
    await user.click(screen.getByRole("button", { name: "Version" }));

    const rows = screen.getAllByRole("row").slice(1);
    const versions = rows.map((row) => within(row).getAllByRole("cell")[2]?.textContent);

    expect(versions).toEqual(["8.10.0", "8.9.0", "7.17.0"]);
  });
});
