import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import InvestigateEventTimeline from "../../src/components/investigate/InvestigateEventTimeline";
import type {
  TimelineEvent,
  TimelineMarker,
} from "../../src/components/investigate/investigateUtils";

const EVENTS: TimelineEvent[] = [
  {
    timestamp: "2026-03-01T10:00:00.000Z",
    category: "authentication",
    action: "logon",
    outcome: "success",
    userName: "admin",
    hostName: "web-server-01",
    sourceIp: "192.168.1.10",
    message: "User admin logged in",
    dataSource: "logs-security-default",
  },
  {
    timestamp: "2026-03-01T09:55:00.000Z",
    category: "authentication",
    action: "logon",
    outcome: "failure",
    userName: "admin",
    hostName: "web-server-01",
    sourceIp: "192.168.1.10",
    message: "Failed login attempt",
    dataSource: "auditbeat-2026.03.01",
  },
];

const MARKERS: TimelineMarker[] = [
  {
    timestamp: "2026-03-01T09:55:00.000Z",
    label: "Failed login",
    description: "A failed login attempt was detected",
    severity: "warning",
  },
  {
    timestamp: "2026-03-01T10:00:00.000Z",
    label: "Successful logon",
    description: "Admin authenticated",
    severity: "info",
  },
];

describe("InvestigateEventTimeline", () => {
  it("renders the timeline heading", () => {
    render(<InvestigateEventTimeline events={EVENTS} markers={[]} markersLoading={false} />);

    expect(screen.getByText("Event timeline")).toBeInTheDocument();
  });

  it("renders marker labels when provided", () => {
    render(<InvestigateEventTimeline events={EVENTS} markers={MARKERS} markersLoading={false} />);

    expect(screen.getByText("Failed login")).toBeInTheDocument();
    expect(screen.getByText("Successful logon")).toBeInTheDocument();
  });

  it("shows a spinner while markers are loading", () => {
    render(<InvestigateEventTimeline events={EVENTS} markers={[]} markersLoading={true} />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("does not show a spinner when markers are not loading", () => {
    render(<InvestigateEventTimeline events={EVENTS} markers={[]} markersLoading={false} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("has an accessible label", () => {
    render(<InvestigateEventTimeline events={EVENTS} markers={[]} markersLoading={false} />);

    expect(screen.getByLabelText("Event timeline")).toBeInTheDocument();
  });
});
