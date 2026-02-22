import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApiConsolePage from "../../src/components/ApiConsolePage";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());
vi.stubGlobal("fetch", vi.fn());
vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

vi.mock("@uiw/react-codemirror", () => ({
  default: ({
    value,
    onChange,
    editable = true,
  }: {
    value: string;
    onChange?: (value: string) => void;
    editable?: boolean;
  }) => (
    <textarea
      data-testid="codemirror-mock"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      readOnly={!editable}
    />
  ),
}));
vi.mock("@codemirror/lang-json", () => ({ json: () => [] }));

describe("ApiConsolePage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetState();
    useDashboardStore.getState().setConnected(true);
    useDashboardStore.getState().setConnection({
      url: "http://localhost:9200",
      apiKey: "",
    });
    vi.mocked(fetch).mockReset();
  });

  it("sends a request and renders response status/body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const user = userEvent.setup();
    render(<ApiConsolePage />);

    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText("200")).toBeInTheDocument();
      const editors = screen.getAllByTestId("codemirror-mock");
      expect(editors[editors.length - 1]?.textContent).toContain('"ok": true');
    });
  });

  it("switches method to POST, shows body editor, and sends body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ acknowledged: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const user = userEvent.setup();
    render(<ApiConsolePage />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /POST/i }));

    expect(screen.getByText(/request body \(json\)/i)).toBeInTheDocument();

    const editors = screen.getAllByTestId("codemirror-mock");
    const bodyEditor = editors[editors.length - 1];
    fireEvent.change(bodyEditor, { target: { value: '{"query":{"match_all":{}}}' } });

    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"query":{"match_all":{}}}');
  });

  it("closes the response panel when the dismiss button is clicked", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const user = userEvent.setup();
    render(<ApiConsolePage />);

    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(screen.getByText("200")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(screen.queryByText("200")).not.toBeInTheDocument();
  });

  it("sends all requests when Run All is clicked", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ first: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ second: true }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );

    const user = userEvent.setup();
    render(<ApiConsolePage />);

    // Add a second request
    await user.click(screen.getByRole("button", { name: /add request/i }));

    await user.click(screen.getByRole("button", { name: /run all/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});
