import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ApiConsolePage from "../../src/components/ApiConsolePage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useApiConsoleStore } from "../../src/store/useApiConsoleStore";
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

  it("does not crash when Clipboard API is unavailable for Copy as cURL", async () => {
    const user = userEvent.setup();
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });

    try {
      render(<ApiConsolePage />);
      await user.click(screen.getByRole("button", { name: /copy as curl/i }));
      expect(screen.getByRole("button", { name: /run all/i })).toBeInTheDocument();
    } finally {
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", originalClipboard);
      } else {
        Reflect.deleteProperty(navigator, "clipboard");
      }
    }
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

  it("persists entries to the store when path is updated", async () => {
    const user = userEvent.setup();
    render(<ApiConsolePage />);

    const pathInput = screen.getByPlaceholderText("/_cat/indices?v");
    await user.clear(pathInput);
    await user.type(pathInput, "/_cat/health");

    await waitFor(() => {
      const stored = useApiConsoleStore.getState().entries;
      expect(stored[0]?.path).toBe("/_cat/health");
    });
  });

  it("restores persisted entries on mount", () => {
    act(() => {
      useApiConsoleStore
        .getState()
        .setEntries([{ id: "test-id", method: "POST", path: "/_search", body: '{"query":{}}' }]);
    });

    render(<ApiConsolePage />);

    expect(screen.getByDisplayValue("/_search")).toBeInTheDocument();
  });

  it("clears all entries and resets to a single blank entry when Clear Session is confirmed", async () => {
    const user = userEvent.setup();
    render(<ApiConsolePage />);

    // Add a second request so we have two
    await user.click(screen.getByRole("button", { name: /add request/i }));
    expect(screen.getAllByRole("button", { name: /send/i })).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: /more actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /clear session/i }));
    await user.click(await screen.findByRole("button", { name: /^clear session$/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /clear session\?/i })).not.toBeInTheDocument();
    });

    expect(screen.getAllByRole("button", { name: /send/i })).toHaveLength(1);
  });

  it("prepends a draft entry and clears the draft on mount", () => {
    act(() => {
      useApiConsoleStore.getState().setConsoleDraft({ method: "GET", path: "/my-index/_mapping" });
    });

    render(<ApiConsolePage />);

    const pathInputs = screen.getAllByPlaceholderText("/_cat/indices?v");
    expect(pathInputs[0]).toHaveValue("/my-index/_mapping");
    expect(useApiConsoleStore.getState().consoleDraft).toBeNull();
  });

  it("shows a Cancel button while a request is loading and cancels on click", async () => {
    let resolveFetch!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<ApiConsolePage />);

    await user.click(screen.getByRole("button", { name: /send/i }));

    // While loading, Cancel button should appear and Send should not
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /^send$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    // After cancel, Send button returns and no response is shown
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
    expect(screen.queryByText("200")).not.toBeInTheDocument();

    // Resolve the pending fetch to avoid unhandled promise warnings
    resolveFetch(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });
});
