import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, Link, useLocation } from "react-router-dom";

import UsersPage from "../../src/components/UsersPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const getCapabilitiesMock = vi.fn();
const getSecurityUsersMock = vi.fn();

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getCapabilities: getCapabilitiesMock,
    getSecurityUsers: getSecurityUsersMock,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

const CAPS_OK = {
  canManageDataStreams: false,
  canReadSecurityUsers: true,
  canReadSecurityRoles: true,
};
const CAPS_NO_READ = {
  canManageDataStreams: false,
  canReadSecurityUsers: false,
  canReadSecurityRoles: false,
};

const USERS_RESPONSE = {
  elastic: {
    username: "elastic",
    enabled: true,
    roles: ["superuser"],
    full_name: "Built-in superuser",
    email: null,
    metadata: { _reserved: true },
  },
  kibana_system: {
    username: "kibana_system",
    enabled: true,
    roles: ["kibana_system"],
    full_name: null,
    email: null,
    metadata: {},
  },
  alice: {
    username: "alice",
    enabled: false,
    roles: [],
    full_name: "Alice Smith",
    email: "alice@example.com",
    metadata: {},
  },
};

describe("UsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
  });

  it("renders users list sorted alphabetically and selects the first user", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityUsersMock.mockResolvedValue(USERS_RESPONSE);

    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );

    // First user alphabetically is "alice"
    await screen.findByRole("heading", { level: 6, name: "alice" });
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.getByText("No assigned roles.")).toBeInTheDocument();
  });

  it("shows detail panel for a selected user", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityUsersMock.mockResolvedValue(USERS_RESPONSE);

    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 6, name: "alice" });
    await user.click(screen.getByRole("button", { name: /elastic/i }));

    await screen.findByRole("heading", { level: 6, name: "elastic" });
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("superuser")).toBeInTheDocument();
  });

  it("filters the list panel by search term", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityUsersMock.mockResolvedValue(USERS_RESPONSE);

    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );

    // Wait for the list to populate
    const list = await screen.findByRole("list");
    await within(list).findByText("elastic");

    await user.type(screen.getByPlaceholderText("Search users"), "elastic");

    await waitFor(() => {
      const listItems = within(list).getAllByRole("button");
      expect(listItems).toHaveLength(1);
      expect(within(list).getByText("elastic")).toBeInTheDocument();
    });
  });

  it("shows empty state when no users match search", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityUsersMock.mockResolvedValue(USERS_RESPONSE);

    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );

    await screen.findByRole("list");
    await user.type(screen.getByPlaceholderText("Search users"), "nonexistent");

    await screen.findByText("No users found.");
  });

  it("shows access warning when canReadSecurityUsers is false", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_NO_READ);
    getSecurityUsersMock.mockResolvedValue(USERS_RESPONSE);

    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );

    await screen.findByText("Your credentials may have partial access to security APIs.");
  });

  it("shows access notice on 403 and empties user list", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_NO_READ);
    getSecurityUsersMock.mockRejectedValue({ status: 403, message: "security_exception" });

    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );

    await screen.findByText("Your credentials cannot read all user data.");
    expect(screen.getByText("Select a user.")).toBeInTheDocument();
  });

  it("shows error alert on non-auth failure", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityUsersMock.mockRejectedValue({ status: 500, message: "internal_error" });

    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );

    await screen.findByText("internal_error");
  });

  it("does not throw when Clipboard API is unavailable", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityUsersMock.mockResolvedValue(USERS_RESPONSE);

    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });

    try {
      render(
        <MemoryRouter>
          <UsersPage />
        </MemoryRouter>,
      );

      await screen.findByRole("heading", { level: 6, name: "alice" });
      await user.click(screen.getByRole("button", { name: "Copy API call" }));
      expect(screen.getByRole("heading", { level: 6, name: "alice" })).toBeInTheDocument();
    } finally {
      if (original !== undefined) {
        Object.defineProperty(navigator, "clipboard", original);
      } else {
        Reflect.deleteProperty(navigator, "clipboard");
      }
    }
  });

  it("refreshes data when Refresh button is clicked", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityUsersMock.mockResolvedValueOnce(USERS_RESPONSE).mockResolvedValueOnce({
      elastic: USERS_RESPONSE.elastic,
    });

    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );

    const list = await screen.findByRole("list");
    await within(list).findByText("alice");
    await user.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(within(list).queryByText("alice")).not.toBeInTheDocument();
      expect(within(list).getByText("elastic")).toBeInTheDocument();
    });
    expect(getSecurityUsersMock).toHaveBeenCalledTimes(2);
  });

  it("navigates to /roles?role=<name> when a role chip is clicked", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityUsersMock.mockResolvedValue(USERS_RESPONSE);

    function LocationDisplay() {
      const location = useLocation();
      return <div data-testid="location-display">{location.pathname + location.search}</div>;
    }

    render(
      <MemoryRouter>
        <UsersPage />
        <LocationDisplay />
      </MemoryRouter>,
    );

    // Select the elastic user (has superuser role)
    await screen.findByRole("heading", { level: 6, name: "alice" });
    await user.click(screen.getByRole("button", { name: /elastic/i }));
    await screen.findByRole("heading", { level: 6, name: "elastic" });

    // Click the superuser role chip
    const chip = screen.getByRole("button", { name: "View role: superuser" });
    await user.click(chip);

    await waitFor(() => {
      expect(screen.getByTestId("location-display").textContent).toBe("/roles?role=superuser");
    });
  });

  it("pre-selects a user from the ?username= URL search param", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityUsersMock.mockResolvedValue(USERS_RESPONSE);

    render(
      <MemoryRouter initialEntries={["/users?username=elastic"]}>
        <UsersPage />
      </MemoryRouter>,
    );

    // elastic should be pre-selected rather than alice (first alphabetically)
    await screen.findByRole("heading", { level: 6, name: "elastic" });
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("superuser")).toBeInTheDocument();
  });

  it("updates selected user when ?username= query param changes on same route", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityUsersMock.mockResolvedValue(USERS_RESPONSE);

    render(
      <MemoryRouter initialEntries={["/users?username=elastic"]}>
        <Routes>
          <Route
            path="/users"
            element={
              <>
                <Link to="/users?username=alice">Switch to alice</Link>
                <UsersPage />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 6, name: "elastic" });
    await user.click(screen.getByRole("link", { name: "Switch to alice" }));

    expect(await screen.findByRole("heading", { level: 6, name: "alice" })).toBeInTheDocument();
  });
});
