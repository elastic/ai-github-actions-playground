import { describe, it, expect, beforeEach, vi } from "vitest";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import type { DashboardParameter } from "../../src/types";

const makeStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

const localStorageMock = makeStorageMock();
const sessionStorageMock = makeStorageMock();

vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("sessionStorage", sessionStorageMock);

const sampleParam: DashboardParameter = {
  name: "service",
  label: "Service",
  type: "keyword",
  source: { mode: "text" },
  value: "web",
};

describe("useDashboardStore parameter actions", () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    useDashboardStore.getState().resetState();
  });

  it("addParameter adds a parameter to the dashboard", () => {
    useDashboardStore.getState().addParameter(sampleParam);
    const params = useDashboardStore.getState().dashboard.parameters;
    expect(params).toHaveLength(1);
    expect(params![0].name).toBe("service");
    expect(params![0].value).toBe("web");
  });

  it("setParameterValue changes the value of an existing parameter", () => {
    useDashboardStore.getState().addParameter(sampleParam);
    useDashboardStore.getState().setParameterValue("service", "api");
    const params = useDashboardStore.getState().dashboard.parameters;
    expect(params![0].value).toBe("api");
  });

  it("updateParameter merges partial updates", () => {
    useDashboardStore.getState().addParameter(sampleParam);
    useDashboardStore.getState().updateParameter("service", { label: "Svc", value: "worker" });
    const param = useDashboardStore.getState().dashboard.parameters![0];
    expect(param.label).toBe("Svc");
    expect(param.value).toBe("worker");
    expect(param.name).toBe("service");
  });

  it("removeParameter removes the parameter by name", () => {
    useDashboardStore.getState().addParameter(sampleParam);
    useDashboardStore.getState().addParameter({
      ...sampleParam,
      name: "environment",
      label: "Environment",
      value: "prod",
    });
    useDashboardStore.getState().removeParameter("service");
    const params = useDashboardStore.getState().dashboard.parameters;
    expect(params).toHaveLength(1);
    expect(params![0].name).toBe("environment");
  });

  it("parameters survive export/import round-trip", () => {
    useDashboardStore.getState().addParameter(sampleParam);
    useDashboardStore.getState().addParameter({
      name: "env",
      label: "Env",
      type: "keyword",
      source: { mode: "options", values: ["prod", "staging", "dev"] },
      value: "prod",
    });

    const exported = useDashboardStore.getState().exportDashboard();
    useDashboardStore.getState().resetState();
    const result = useDashboardStore.getState().importDashboard(exported);
    expect(result).toEqual({ success: true });

    const params = useDashboardStore.getState().dashboard.parameters;
    expect(params).toHaveLength(2);
    expect(params![0].name).toBe("service");
    expect(params![1].source).toEqual({ mode: "options", values: ["prod", "staging", "dev"] });
  });

  it("addParameter initializes the parameters array when undefined", () => {
    // Ensure no parameters exist
    expect(useDashboardStore.getState().dashboard.parameters).toBeUndefined();
    useDashboardStore.getState().addParameter(sampleParam);
    expect(useDashboardStore.getState().dashboard.parameters).toHaveLength(1);
  });

  it("addParameter replaces an existing parameter with the same name", () => {
    useDashboardStore.getState().addParameter(sampleParam);
    useDashboardStore.getState().addParameter({
      ...sampleParam,
      label: "Service (updated)",
      value: "api",
    });

    const params = useDashboardStore.getState().dashboard.parameters!;
    expect(params).toHaveLength(1);
    expect(params[0]).toEqual(
      expect.objectContaining({
        name: "service",
        label: "Service (updated)",
        value: "api",
      }),
    );
  });

  it("updateParameter keeps names unique when renaming to an existing name", () => {
    useDashboardStore.getState().addParameter(sampleParam);
    useDashboardStore.getState().addParameter({
      ...sampleParam,
      name: "environment",
      label: "Environment",
      value: "prod",
    });

    useDashboardStore.getState().updateParameter("service", {
      name: "environment",
      label: "Env (renamed)",
      value: "staging",
    });

    const params = useDashboardStore.getState().dashboard.parameters!;
    expect(params).toHaveLength(1);
    expect(params[0]).toEqual(
      expect.objectContaining({
        name: "environment",
        label: "Env (renamed)",
        value: "staging",
      }),
    );
  });

  it("setParameterValue does not affect other parameters", () => {
    useDashboardStore.getState().addParameter(sampleParam);
    useDashboardStore.getState().addParameter({
      ...sampleParam,
      name: "host",
      label: "Host",
      value: "node-1",
    });
    useDashboardStore.getState().setParameterValue("service", "changed");
    const params = useDashboardStore.getState().dashboard.parameters!;
    expect(params[0].value).toBe("changed");
    expect(params[1].value).toBe("node-1");
  });
});
