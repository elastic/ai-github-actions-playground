import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ApiConsolePage from "../../src/components/ApiConsolePage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

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
    resetAllStores();
    useConnectionStore.getState().setConnected(true);
    useConnectionStore.getState().setConnection({
      url: "http://localhost:9200",
      apiKey: "",
    });
    vi.mocked(fetch).mockReset();
  });

  it("copies a cURL command to the clipboard when Copy as cURL is clicked", () => {
    useConnectionStore.getState().setConnection({
      url: "http://localhost:9200",
      apiKey: "my-api-key",
    });

    render(<ApiConsolePage />);

    fireEvent.click(screen.getByRole("button", { name: /copy as curl/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("curl -X GET 'http://localhost:9200/'"),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("ApiKey my-api-key"),
    );
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

    expect(await screen.findByText("200")).toBeInTheDocument();

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
