import { act, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import ParameterBar from "../../src/components/ParameterBar";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

const queryMock = vi.fn();

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    query: queryMock,
  })),
}));

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

describe("ParameterBar", () => {
  beforeEach(() => {
    queryMock.mockReset();
    resetAllStores();
    useConnectionStore.getState().setConnected(true);
    useConnectionStore
      .getState()
      .setConnection({ url: "https://localhost:9200", apiKey: "test-key" });
  });

  it("clears stale ES|QL options after a failed refresh", async () => {
    queryMock
      .mockResolvedValueOnce({ values: [["web"]], executionTimeMs: 1 })
      .mockRejectedValueOnce(new Error("query failed"));
    useDashboardStore.getState().addParameter({
      name: "service",
      label: "Service",
      type: "keyword",
      source: { mode: "esql", query: "FROM logs-* | LIMIT 1" },
      value: "",
    });

    render(<ParameterBar />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    act(() => {
      useDashboardStore
        .getState()
        .updateParameter("service", { source: { mode: "esql", query: "FROM bad query" } });
    });

    await waitFor(() => {
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("clears stale ES|QL options when the ES|QL query is cleared", async () => {
    queryMock.mockResolvedValueOnce({ values: [["web"]], executionTimeMs: 1 });
    useDashboardStore.getState().addParameter({
      name: "service",
      label: "Service",
      type: "keyword",
      source: { mode: "esql", query: "FROM logs-* | LIMIT 1" },
      value: "",
    });

    render(<ParameterBar />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    act(() => {
      useDashboardStore
        .getState()
        .updateParameter("service", { source: { mode: "esql", query: "   " } });
    });

    await waitFor(() => {
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("adds a text variable through the dialog", async () => {
    const user = userEvent.setup();
    render(<ParameterBar />);

    await user.click(screen.getByRole("button", { name: /add parameter/i }));
    await screen.findByRole("dialog");

    await user.type(screen.getByLabelText("Name"), "service");
    await user.type(screen.getByLabelText("Label"), "Service");
    await user.type(screen.getByLabelText("Default value"), "web");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(useDashboardStore.getState().dashboard.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "service",
            label: "Service",
            value: "web",
            source: { mode: "text" },
          }),
        ]),
      );
    });
    expect(screen.getByText("Service:")).toBeInTheDocument();
  });

  it("renaming a variable to an existing name does not create duplicates", async () => {
    const user = userEvent.setup();
    useDashboardStore.getState().addParameter({
      name: "service",
      label: "Service",
      type: "keyword",
      source: { mode: "text" },
      value: "web",
    });
    useDashboardStore.getState().addParameter({
      name: "env",
      label: "Environment",
      type: "keyword",
      source: { mode: "text" },
      value: "prod",
    });

    render(<ParameterBar />);

    const serviceRow = screen.getByTestId("parameter-row-service");
    const [editButton] = within(serviceRow).getAllByRole("button");
    await user.click(editButton);
    await screen.findByRole("dialog");

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "env");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const params = useDashboardStore.getState().dashboard.parameters ?? [];
      expect(params).toHaveLength(1);
      expect(params[0]?.name).toBe("env");
    });
  });

  it("adds a number variable and stores numeric value", async () => {
    const user = userEvent.setup();
    render(<ParameterBar />);

    await user.click(screen.getByRole("button", { name: /add parameter/i }));
    await screen.findByRole("dialog");

    await user.type(screen.getByLabelText("Name"), "threshold");
    await user.type(screen.getByLabelText("Label"), "Threshold");
    await user.click(screen.getByLabelText("Type"));
    await user.click(screen.getByRole("option", { name: "number" }));
    await user.type(screen.getByLabelText("Default value"), "42");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(useDashboardStore.getState().dashboard.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "threshold",
            type: "number",
            value: 42,
          }),
        ]),
      );
    });
  });

  it("blocks invalid date values with inline validation", async () => {
    const user = userEvent.setup();
    render(<ParameterBar />);

    await user.click(screen.getByRole("button", { name: /add parameter/i }));
    await screen.findByRole("dialog");

    await user.type(screen.getByLabelText("Name"), "from_date");
    await user.type(screen.getByLabelText("Label"), "From Date");
    await user.click(screen.getByLabelText("Type"));
    await user.click(screen.getByRole("option", { name: "date" }));
    await user.type(screen.getByLabelText("Default value"), "not-a-date");

    expect(screen.getByText("Enter a valid date/time.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("allows intermediate invalid number edits and commits on blur", async () => {
    const user = userEvent.setup();
    useDashboardStore.getState().addParameter({
      name: "threshold",
      label: "Threshold",
      type: "number",
      source: { mode: "text" },
      value: 42,
    });

    render(<ParameterBar />);
    const input = screen.getByRole("textbox");

    await user.clear(input);
    await user.type(input, "-");
    expect(input).toHaveValue("-");
    expect(screen.getByText("Enter a valid number.")).toBeInTheDocument();

    await user.type(input, "7");
    expect(input).toHaveValue("-7");
    await user.tab();

    await waitFor(() => {
      const param = useDashboardStore
        .getState()
        .dashboard.parameters?.find((p) => p.name === "threshold");
      expect(param?.value).toBe(-7);
    });
  });
});
