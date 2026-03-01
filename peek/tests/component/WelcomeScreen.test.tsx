import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import WelcomeScreen from "../../src/components/WelcomeScreen";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useUIStore } from "../../src/store/useUIStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

// Provide a controllable fetch stub so demo-config fetching can be simulated.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const DEMO_CONFIG = {
  url: "https://demo.es.io:443",
  username: "demo-user",
  password: "demo-pass",
};

function mockDemoConfig(config: typeof DEMO_CONFIG | null) {
  if (config === null) {
    fetchMock.mockResolvedValue(new Response("Not Found", { status: 404 }));
  } else {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(config), { status: 200 }));
  }
}

describe("WelcomeScreen", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
    fetchMock.mockReset();
  });

  it('shows "Connect to Elasticsearch" button when disconnected', () => {
    mockDemoConfig(null);
    render(<WelcomeScreen />);
    expect(screen.getByRole("button", { name: /connect to elasticsearch/i })).toBeInTheDocument();
  });

  it("clicking the button opens the connection dialog", async () => {
    mockDemoConfig(null);
    const user = userEvent.setup();
    render(<WelcomeScreen />);

    await user.click(screen.getByRole("button", { name: /connect to elasticsearch/i }));

    expect(useUIStore.getState().connectionDialogOpen).toBe(true);
  });

  it('does not show "Try the Demo" button when demo.json is absent', async () => {
    mockDemoConfig(null);
    render(<WelcomeScreen />);
    // Allow the fetch to resolve
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /try the demo/i })).not.toBeInTheDocument();
  });

  it('shows "Try the Demo" button when demo.json is present', async () => {
    mockDemoConfig(DEMO_CONFIG);
    render(<WelcomeScreen />);
    await screen.findByRole("button", { name: /try the demo/i });
  });

  it('clicking "Try the Demo" connects with demo credentials on success', async () => {
    // First call → demo.json; second call → cluster info; third call → capabilities
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(DEMO_CONFIG), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ cluster_name: "demo" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ cluster: { manage_data_stream: true } }), { status: 200 }),
      );

    const user = userEvent.setup();
    render(<WelcomeScreen />);

    const demoButton = await screen.findByRole("button", { name: /try the demo/i });
    await user.click(demoButton);

    await waitFor(() => expect(useConnectionStore.getState().connected).toBe(true));
    expect(useConnectionStore.getState().connection).toMatchObject({
      url: DEMO_CONFIG.url,
      username: DEMO_CONFIG.username,
      password: DEMO_CONFIG.password,
    });
    expect(useConnectionStore.getState().capabilities).toEqual({
      canManageDataStreams: true,
      canCreateApiKeys: false,
      canReadSecurityUsers: false,
      canReadSecurityRoles: false,
      canReadApiKeys: false,
    });
  });

  it("shows error message when demo connection fails", async () => {
    useConnectionStore.getState().setCapabilities({
      canManageDataStreams: true,
      canReadSecurityUsers: false,
      canReadSecurityRoles: false,
    });
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(DEMO_CONFIG), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { reason: "Unauthorized" } }), { status: 401 }),
      );

    const user = userEvent.setup();
    render(<WelcomeScreen />);

    const demoButton = await screen.findByRole("button", { name: /try the demo/i });
    await user.click(demoButton);

    await screen.findByText(/unauthorized/i);
    expect(useConnectionStore.getState().connected).toBe(false);
    expect(useConnectionStore.getState().capabilities).toBeNull();
  });
});
