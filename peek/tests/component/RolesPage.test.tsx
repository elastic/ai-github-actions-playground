import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import RolesPage from "../../src/components/RolesPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

const getCapabilitiesMock = vi.fn();
const getSecurityRolesMock = vi.fn();

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getCapabilities: getCapabilitiesMock,
    getSecurityRoles: getSecurityRolesMock,
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

describe("RolesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
  });

  it("renders roles list sorted alphabetically and selects the first role", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityRolesMock.mockResolvedValue(ROLES_RESPONSE);

    render(
      <MemoryRouter>
        <RolesPage />
      </MemoryRouter>,
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
      <MemoryRouter>
        <RolesPage />
      </MemoryRouter>,
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
      <MemoryRouter>
        <RolesPage />
      </MemoryRouter>,
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
      <MemoryRouter>
        <RolesPage />
      </MemoryRouter>,
    );

    await screen.findByRole("list");
    await user.type(screen.getByPlaceholderText("Search roles"), "nonexistent");

    await screen.findByText("No roles found.");
  });

  it("shows access warning when canReadSecurityRoles is false", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_NO_READ);
    getSecurityRolesMock.mockResolvedValue(ROLES_RESPONSE);

    render(
      <MemoryRouter>
        <RolesPage />
      </MemoryRouter>,
    );

    await screen.findByText("Your credentials may have partial access to security APIs.");
  });

  it("shows access notice on 403 and empties role list", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_NO_READ);
    getSecurityRolesMock.mockRejectedValue({ status: 403, message: "security_exception" });

    render(
      <MemoryRouter>
        <RolesPage />
      </MemoryRouter>,
    );

    await screen.findByText("Your credentials cannot read all Roles data.");
    expect(screen.getByText("Select a role.")).toBeInTheDocument();
  });

  it("shows error alert on non-auth failure", async () => {
    getCapabilitiesMock.mockResolvedValue(CAPS_OK);
    getSecurityRolesMock.mockRejectedValue({ status: 500, message: "internal_error" });

    render(
      <MemoryRouter>
        <RolesPage />
      </MemoryRouter>,
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
      <MemoryRouter>
        <RolesPage />
      </MemoryRouter>,
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
});
