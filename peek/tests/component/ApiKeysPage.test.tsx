import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";

import ApiKeysPage from "../../src/components/ApiKeysPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

const getCapabilitiesMock = vi.fn();
const getApiKeysMock = vi.fn();

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getCapabilities: getCapabilitiesMock,
    getApiKeys: getApiKeysMock,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

const CAPS_OK = {
  canManageDataStreams: false,
  canReadSecurityUsers: true,
  canReadSecurityRoles: true,
  canReadApiKeys: true,
};
const CAPS_NO_READ = {
  canManageDataStreams: false,
  canReadSecurityUsers: false,
  canReadSecurityRoles: false,
  canReadApiKeys: false,
};

const NOW = Date.now();

const API_KEYS_RESPONSE = {
  api_keys: [
    {
      id: "key-1",
      name: "ingest-key",
      username: "elastic",
      creation: NOW - 30 * 86_400_000,
      expiration: NOW + 30 * 86_400_000,
      invalidated: false,
      metadata: {},
    },
    {
      id: "key-2",
      name: "never-expiring-key",
      username: "admin",
      creation: NOW - 120 * 86_400_000,
      expiration: null,
      invalidated: false,
      metadata: { purpose: "legacy" },
    },
    {
      id: "key-3",
      name: "old-invalidated-key",
      username: "elastic",
      creation: NOW - 200 * 86_400_000,
      expiration: NOW - 100 * 86_400_000,
      invalidated: true,
      metadata: {},
    },
  ],
};

describe("ApiKeysPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
  });

  it("renders API keys list sorted alphabetically and selects the first key", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getApiKeysMock.mockResolvedValue(API_KEYS_RESPONSE);

    render(
      <MemoryRouter>
        <ApiKeysPage />
      </MemoryRouter>,
    );

    // First key alphabetically is "ingest-key"
    await screen.findByRole("heading", { level: 6, name: "ingest-key" });
  });

  it("shows detail panel for a selected API key", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getApiKeysMock.mockResolvedValue(API_KEYS_RESPONSE);

    render(
      <MemoryRouter>
        <ApiKeysPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 6, name: "ingest-key" });
    await user.click(screen.getByRole("button", { name: /never-expiring-key/i }));

    await screen.findByRole("heading", { level: 6, name: "never-expiring-key" });
    expect(screen.getByText("Never expires")).toBeInTheDocument();
  });

  it("shows 'Invalidated' chip for invalidated keys", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getApiKeysMock.mockResolvedValue(API_KEYS_RESPONSE);

    render(
      <MemoryRouter>
        <ApiKeysPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 6, name: "ingest-key" });
    await user.click(screen.getByRole("button", { name: /old-invalidated-key/i }));

    await screen.findByRole("heading", { level: 6, name: "old-invalidated-key" });
    expect(screen.getByText("Invalidated")).toBeInTheDocument();
  });

  it("filters the list by search term", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getApiKeysMock.mockResolvedValue(API_KEYS_RESPONSE);

    render(
      <MemoryRouter>
        <ApiKeysPage />
      </MemoryRouter>,
    );

    const list = await screen.findByRole("list");
    await within(list).findByText("ingest-key");

    await user.type(screen.getByPlaceholderText("Search API keys"), "never");

    await waitFor(() => {
      const listItems = within(list).getAllByRole("button");
      expect(listItems).toHaveLength(1);
      expect(within(list).getByText("never-expiring-key")).toBeInTheDocument();
    });
  });

  it("shows empty state when no keys match search", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getApiKeysMock.mockResolvedValue(API_KEYS_RESPONSE);

    render(
      <MemoryRouter>
        <ApiKeysPage />
      </MemoryRouter>,
    );

    await screen.findByRole("list");
    await user.type(screen.getByPlaceholderText("Search API keys"), "nonexistent");

    await screen.findByText("No API keys found.");
  });

  it("shows access warning when canReadApiKeys is false", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_NO_READ);
    getApiKeysMock.mockResolvedValue(API_KEYS_RESPONSE);

    render(
      <MemoryRouter>
        <ApiKeysPage />
      </MemoryRouter>,
    );

    await screen.findByText("Your credentials may have partial access to security APIs.");
    expect(getApiKeysMock).toHaveBeenCalledTimes(1);
  });

  it("shows access notice on 403 and empties key list", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_NO_READ);
    getApiKeysMock.mockRejectedValue({ status: 403, message: "security_exception" });

    render(
      <MemoryRouter>
        <ApiKeysPage />
      </MemoryRouter>,
    );

    await screen.findByText("Your credentials cannot list API keys.");
    expect(screen.getByText("Select an API key.")).toBeInTheDocument();
  });

  it("shows error alert on non-auth failure", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getApiKeysMock.mockRejectedValue({ status: 500, message: "internal_error" });

    render(
      <MemoryRouter>
        <ApiKeysPage />
      </MemoryRouter>,
    );

    await screen.findByText("internal_error");
  });

  it("navigates to /users?username=<owner> when owner chip is clicked", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getApiKeysMock.mockResolvedValue(API_KEYS_RESPONSE);

    function LocationDisplay() {
      const location = useLocation();
      return <div data-testid="location-display">{location.pathname + location.search}</div>;
    }

    render(
      <MemoryRouter>
        <ApiKeysPage />
        <LocationDisplay />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 6, name: "ingest-key" });

    const chip = screen.getByRole("button", { name: "View user: elastic" });
    await user.click(chip);

    await waitFor(() => {
      expect(screen.getByTestId("location-display").textContent).toBe("/users?username=elastic");
    });
  });

  it("refreshes data when Refresh button is clicked", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getApiKeysMock
      .mockResolvedValueOnce(API_KEYS_RESPONSE)
      .mockResolvedValueOnce({ api_keys: [API_KEYS_RESPONSE.api_keys[0]] });

    render(
      <MemoryRouter>
        <ApiKeysPage />
      </MemoryRouter>,
    );

    const list = await screen.findByRole("list");
    await within(list).findByText("never-expiring-key");
    await user.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(within(list).queryByText("never-expiring-key")).not.toBeInTheDocument();
      expect(within(list).getByText("ingest-key")).toBeInTheDocument();
    });
    expect(getApiKeysMock).toHaveBeenCalledTimes(2);
  });
});
