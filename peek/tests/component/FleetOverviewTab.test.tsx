import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import FleetOverviewTab from "../../src/components/fleet/FleetOverviewTab";

describe("FleetOverviewTab empty state", () => {
  it("shows user-friendly guidance when no server status and no agents", () => {
    render(
      <FleetOverviewTab
        serverStatus={null}
        agentVersions={[]}
        agentInventoryTotal={0}
        agentInventoryTotalErrorCount={0}
        onDrillIn={() => {}}
      />,
    );

    expect(screen.getByText("No Fleet Server status available")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Fleet Server metrics have not been received yet. Ensure Fleet Server is running and sending status data to Elasticsearch.",
      ),
    ).toBeInTheDocument();
    // Should NOT contain internal index pattern
    expect(screen.queryByText(/metrics-fleet_server\.agent_status/)).not.toBeInTheDocument();
  });

  it("shows agent count when agents exist but no server status", () => {
    render(
      <FleetOverviewTab
        serverStatus={null}
        agentVersions={[]}
        agentInventoryTotal={5}
        agentInventoryTotalErrorCount={0}
        onDrillIn={() => {}}
      />,
    );

    expect(
      screen.getByText(
        "5 agents found via Elastic Agent logs; switch to the Agents tab to view them.",
      ),
    ).toBeInTheDocument();
  });
});
