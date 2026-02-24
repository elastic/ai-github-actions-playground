import { describe, it, expect, beforeEach, vi } from "vitest";

import { useDashboardStore } from "../../src/store/useDashboardStore";
import type { DashboardParameter } from "../../src/types";
import { makeStorageMock } from "../fixtures/test-utils";

const localStorageMock = makeStorageMock();
const sessionStorageMock = makeStorageMock();

vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("sessionStorage", sessionStorageMock);

const serviceParam: DashboardParameter = {
  name: "service",
  label: "Service",
  type: "keyword",
  source: { mode: "text" },
  value: "web",
};

const hostParam: DashboardParameter = {
  name: "host",
  label: "Host",
  type: "keyword",
  source: { mode: "text" },
  value: "node-1",
};

describe("useDashboardStore interaction filter (click-to-filter)", () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    useDashboardStore.getState().resetDashboardState();
  });

  it("setInteractionFilter updates the parameter value and records the previous value", () => {
    useDashboardStore.getState().addParameter(serviceParam);
    useDashboardStore.getState().setInteractionFilter("service", "checkout");

    const params = useDashboardStore.getState().dashboard.parameters!;
    expect(params[0].value).toBe("checkout");

    const filters = useDashboardStore.getState().interactionFilters;
    expect(filters).toHaveProperty("service", "web");
  });

  it("setInteractionFilter is a no-op when the parameter does not exist", () => {
    useDashboardStore.getState().addParameter(serviceParam);
    const before = useDashboardStore.getState().dashboard.updatedAt;

    useDashboardStore.getState().setInteractionFilter("missing", "value");

    expect(useDashboardStore.getState().dashboard.updatedAt).toBe(before);
    expect(useDashboardStore.getState().interactionFilters).toEqual({});
  });

  it("repeated setInteractionFilter keeps the original prevValue", () => {
    useDashboardStore.getState().addParameter(serviceParam);
    useDashboardStore.getState().setInteractionFilter("service", "checkout");
    useDashboardStore.getState().setInteractionFilter("service", "payments");

    const params = useDashboardStore.getState().dashboard.parameters!;
    expect(params[0].value).toBe("payments");

    // prevValue should still be the original "web", not "checkout"
    expect(useDashboardStore.getState().interactionFilters["service"]).toBe("web");
  });

  it("clearInteractionFilter restores the previous value and removes the filter entry", () => {
    useDashboardStore.getState().addParameter(serviceParam);
    useDashboardStore.getState().setInteractionFilter("service", "checkout");
    useDashboardStore.getState().clearInteractionFilter("service");

    const params = useDashboardStore.getState().dashboard.parameters!;
    expect(params[0].value).toBe("web");
    expect(useDashboardStore.getState().interactionFilters).toEqual({});
  });

  it("clearInteractionFilter is a no-op when the filter is not active", () => {
    useDashboardStore.getState().addParameter(serviceParam);
    const before = useDashboardStore.getState().dashboard.updatedAt;

    useDashboardStore.getState().clearInteractionFilter("service");

    expect(useDashboardStore.getState().dashboard.updatedAt).toBe(before);
  });

  it("clearAllInteractionFilters restores all filtered parameters", () => {
    useDashboardStore.getState().addParameter(serviceParam);
    useDashboardStore.getState().addParameter(hostParam);
    useDashboardStore.getState().setInteractionFilter("service", "checkout");
    useDashboardStore.getState().setInteractionFilter("host", "node-99");
    useDashboardStore.getState().clearAllInteractionFilters();

    const params = useDashboardStore.getState().dashboard.parameters!;
    expect(params.find((p) => p.name === "service")?.value).toBe("web");
    expect(params.find((p) => p.name === "host")?.value).toBe("node-1");
    expect(useDashboardStore.getState().interactionFilters).toEqual({});
  });

  it("clearAllInteractionFilters is a no-op when there are no active filters", () => {
    useDashboardStore.getState().addParameter(serviceParam);
    const before = useDashboardStore.getState().dashboard.updatedAt;

    useDashboardStore.getState().clearAllInteractionFilters();

    expect(useDashboardStore.getState().dashboard.updatedAt).toBe(before);
  });

  it("interactionFilters are cleared when setActiveDashboard is called", () => {
    useDashboardStore.getState().addParameter(serviceParam);
    useDashboardStore.getState().setInteractionFilter("service", "checkout");

    const newId = useDashboardStore.getState().createDashboard("Second");
    useDashboardStore.getState().setActiveDashboard(newId);

    expect(useDashboardStore.getState().interactionFilters).toEqual({});
  });

  it("interactionFilters are cleared on resetDashboardState", () => {
    useDashboardStore.getState().addParameter(serviceParam);
    useDashboardStore.getState().setInteractionFilter("service", "checkout");

    useDashboardStore.getState().resetDashboardState();

    expect(useDashboardStore.getState().interactionFilters).toEqual({});
  });

  it("setInteractionFilter for multiple parameters tracks each independently", () => {
    useDashboardStore.getState().addParameter(serviceParam);
    useDashboardStore.getState().addParameter(hostParam);
    useDashboardStore.getState().setInteractionFilter("service", "api");
    useDashboardStore.getState().setInteractionFilter("host", "node-42");

    const params = useDashboardStore.getState().dashboard.parameters!;
    expect(params.find((p) => p.name === "service")?.value).toBe("api");
    expect(params.find((p) => p.name === "host")?.value).toBe("node-42");

    const filters = useDashboardStore.getState().interactionFilters;
    expect(filters["service"]).toBe("web");
    expect(filters["host"]).toBe("node-1");
  });
});
