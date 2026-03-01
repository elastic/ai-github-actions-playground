import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ConnectionProfileSwitcher from "../../src/components/ConnectionProfileSwitcher";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useUIStore } from "../../src/store/useUIStore";
import * as esService from "../../src/services/es";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

describe("ConnectionProfileSwitcher expected behavior", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
  });

  it("keeps current profile active when switching to another profile fails", async () => {
    const user = userEvent.setup();
    const devId = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "key" });
    const prodId = useConnectionStore
      .getState()
      .saveConnectionProfile("Prod", { url: "https://prod.example.com", apiKey: "key2" });

    expect(devId).toBeDefined();
    expect(prodId).toBeDefined();
    useConnectionStore.getState().setActiveProfileId(devId);
    useConnectionStore.getState().setConnection({ url: "https://dev.example.com", apiKey: "key" });
    useConnectionStore.getState().setConnected(true);
    useConnectionStore.getState().setCapabilities({
      canManageDataStreams: true,
      canReadSecurityUsers: true,
      canReadSecurityRoles: true,
    });

    vi.spyOn(esService, "fetchCapabilitiesForConnection").mockRejectedValue(
      new Error("switch failed"),
    );

    render(<ConnectionProfileSwitcher />);

    await user.click(screen.getByLabelText("Switch connection profile"));
    await user.click(screen.getByRole("menuitem", { name: /Prod/i }));

    await waitFor(() => {
      expect(useUIStore.getState().connectionDialogOpen).toBe(true);
    });

    expect(useConnectionStore.getState().activeProfileId).toBe(devId);
    expect(useConnectionStore.getState().connection?.url).toBe("https://dev.example.com");
    expect(useConnectionStore.getState().connected).toBe(true);
    expect(useConnectionStore.getState().capabilities).toEqual({
      canManageDataStreams: true,
      canReadSecurityUsers: true,
      canReadSecurityRoles: true,
    });
    expect(useConnectionStore.getState().profileHealthMap[prodId]?.status).toBe("needs_attention");
    expect(useConnectionStore.getState().profileHealthMap[devId]).toBeUndefined();
  });
});
