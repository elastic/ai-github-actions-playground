// @vitest-environment jsdom
// happy-dom has a known issue with user.type + nuqs URL-based search filtering
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

import RolesPage from "../../src/components/RolesPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const getCapabilitiesMock = vi.fn();
const getSecurityRolesMock = vi.fn();
const getSecurityUsersMock = vi.fn();

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getCapabilities: getCapabilitiesMock,
    getSecurityRoles: getSecurityRolesMock,
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

const ROLES_RESPONSE = {
  superuser: {
    cluster: ["all"],
    indices: [{ names: ["*"], privileges: ["all"] }],
  },
  viewer: {
    cluster: ["monitor"],
    indices: [{ names: ["logs-*"], privileges: ["read"] }],
  },
  empty_role: {
    cluster: [],
    indices: [],
  },
};

const USERS_RESPONSE = {
  elastic: {
    username: "elastic",
    enabled: true,
    roles: ["superuser"],
    full_name: null,
    email: null,
    metadata: {},
  },
  alice: {
    username: "alice",
    enabled: true,
    roles: ["viewer"],
    full_name: null,
    email: null,
    metadata: {},
  },
};

describe("RolesPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
    getSecurityUsersMock.mockResolvedValue(USERS_RESPONSE);
  });

  it("renders roles list sorted alphabetically and selects the first role", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityRolesMock.mockResolvedValue(ROLES_RESPONSE);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NuqsTestingAdapter hasMemory>
            <RolesPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // First role alphabetically is "empty_role"
    await screen.findByRole("heading", { level: 6, name: "empty_role" });
    expect(screen.getByText("No cluster privileges.")).toBeInTheDocument();
  });

  it("shows detail panel for a selected role with cluster privileges", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityRolesMock.mockResolvedValue(ROLES_RESPONSE);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NuqsTestingAdapter hasMemory>
            <RolesPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByRole("heading", { level: 6, name: "empty_role" });
    await user.click(screen.getByRole("button", { name: /superuser/i }));

    await screen.findByRole("heading", { level: 6, name: "superuser" });
    expect(screen.getByText("all")).toBeInTheDocument();
  });

  it("filters the list panel by search term", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityRolesMock.mockResolvedValue(ROLES_RESPONSE);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NuqsTestingAdapter hasMemory>
            <RolesPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const list = await screen.findByRole("list");
    await within(list).findByText("superuser");

    await user.type(screen.getByPlaceholderText("Search roles"), "viewer");

    await waitFor(() => {
      const listItems = within(list).getAllByRole("button");
      expect(listItems).toHaveLength(1);
      expect(within(list).getByText("viewer")).toBeInTheDocument();
    });
  });

  it("shows empty state when no roles match search", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityRolesMock.mockResolvedValue(ROLES_RESPONSE);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NuqsTestingAdapter hasMemory>
            <RolesPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByRole("list");
    await user.type(screen.getByPlaceholderText("Search roles"), "nonexistent");

    await screen.findByText("No roles found.");
  });

  it("clears the detail panel when search excludes the selected role", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityRolesMock.mockResolvedValue(ROLES_RESPONSE);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NuqsTestingAdapter hasMemory>
            <RolesPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Wait for detail panel to show the first role
    await screen.findByRole("heading", { level: 6, name: "empty_role" });

    // Type a search that matches nothing
    await user.type(screen.getByPlaceholderText("Search roles"), "nonexistent");

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { level: 6, name: "empty_role" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Select a role.")).toBeInTheDocument();
    });

    await user.clear(screen.getByPlaceholderText("Search roles"));
    await screen.findByRole("heading", { level: 6, name: "empty_role" });
    expect(screen.queryByText("Select a role.")).not.toBeInTheDocument();
  });

  it("shows access warning when canReadSecurityRoles is false", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_NO_READ);
    getSecurityRolesMock.mockResolvedValue(ROLES_RESPONSE);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NuqsTestingAdapter hasMemory>
            <RolesPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText("Your credentials may have partial access to security APIs.");
  });

  it("shows access notice on 403 and empties role list", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_NO_READ);
    getSecurityRolesMock.mockRejectedValue({ status: 403, message: "security_exception" });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NuqsTestingAdapter hasMemory>
            <RolesPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText("Your credentials cannot read all role data.");
    expect(screen.getByText("Select a role.")).toBeInTheDocument();
  });

  it("shows error alert on non-auth failure", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityRolesMock.mockRejectedValue({ status: 500, message: "internal_error" });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NuqsTestingAdapter hasMemory>
            <RolesPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText("internal_error");
  });

  it("refreshes data when Refresh button is clicked", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityRolesMock.mockResolvedValueOnce(ROLES_RESPONSE).mockResolvedValueOnce({
      viewer: ROLES_RESPONSE.viewer,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NuqsTestingAdapter hasMemory>
            <RolesPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const list = await screen.findByRole("list");
    await within(list).findByText("superuser");
    await user.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(within(list).queryByText("superuser")).not.toBeInTheDocument();
      expect(within(list).getByText("viewer")).toBeInTheDocument();
    });
    expect(getSecurityRolesMock).toHaveBeenCalledTimes(2);
  });

  it("shows assigned users in the detail pane for the selected role", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityRolesMock.mockResolvedValue(ROLES_RESPONSE);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NuqsTestingAdapter hasMemory>
            <RolesPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // empty_role is selected first alphabetically — no assigned users
    await screen.findByRole("heading", { level: 6, name: "empty_role" });
    expect(screen.getByText("No users assigned.")).toBeInTheDocument();
  });

  it("pre-selects a role from the ?role= URL search param", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityRolesMock.mockResolvedValue(ROLES_RESPONSE);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/roles?role=superuser"]}>
          <NuqsTestingAdapter searchParams="?role=superuser" hasMemory>
            <RolesPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // superuser should be pre-selected rather than empty_role
    await screen.findByRole("heading", { level: 6, name: "superuser" });
    expect(screen.getByText("all")).toBeInTheDocument();
  });

  it("shows assigned users when a role with assignments is selected", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityRolesMock.mockResolvedValue(ROLES_RESPONSE);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NuqsTestingAdapter hasMemory>
            <RolesPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByRole("heading", { level: 6, name: "empty_role" });
    await user.click(screen.getByRole("button", { name: /superuser/i }));

    await screen.findByRole("heading", { level: 6, name: "superuser" });
    await waitFor(() => {
      expect(screen.getByText("elastic")).toBeInTheDocument();
    });
  });

  it("updates selected role when ?role query param changes on same route", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityRolesMock.mockResolvedValue(ROLES_RESPONSE);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/roles?role=superuser"]}>
          <NuqsTestingAdapter searchParams="?role=superuser" hasMemory>
            <RolesPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByRole("heading", { level: 6, name: "superuser" });
    // Clicking a different role in the sidebar updates the URL via nuqs
    await user.click(screen.getByRole("button", { name: /viewer/i }));

    expect(await screen.findByRole("heading", { level: 6, name: "viewer" })).toBeInTheDocument();
  });

  it("navigates to /users?username=<name> when an assigned user chip is clicked", async () => {
    const user = userEvent.setup();
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityRolesMock.mockResolvedValue(ROLES_RESPONSE);

    function LocationDisplay() {
      const location = useLocation();
      return <div data-testid="location-display">{location.pathname + location.search}</div>;
    }

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/roles?role=superuser"]}>
          <NuqsTestingAdapter searchParams="?role=superuser" hasMemory>
            <Routes>
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/users" element={null} />
            </Routes>
            <LocationDisplay />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByRole("heading", { level: 6, name: "superuser" });
    await waitFor(() => {
      expect(screen.getByText("elastic")).toBeInTheDocument();
    });

    const chip = screen.getByRole("button", { name: "View user: elastic" });
    await user.click(chip);

    await waitFor(() => {
      expect(screen.getByTestId("location-display").textContent).toBe("/users?username=elastic");
    });
  });
});
