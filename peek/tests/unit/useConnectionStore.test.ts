import { describe, it, expect, beforeEach, vi } from "vitest";

import * as esServices from "../../src/services/es";
import { useConnectionStore } from "../../src/store/useConnectionStore";

describe("useConnectionStore", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useConnectionStore.getState().resetConnectionState();
  });

  it("saveConnectionProfile and deleteConnectionProfile work", () => {
    const id = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "dev-key" });

    expect(id).toBeTruthy();
    expect(useConnectionStore.getState().connectionProfiles).toHaveLength(1);

    useConnectionStore.getState().deleteConnectionProfile(id!);

    expect(useConnectionStore.getState().connectionProfiles).toHaveLength(0);
  });

  it("deleteConnectionProfile removes stale profileHealthMap entry", () => {
    const id = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "dev-key" });

    expect(id).toBeTruthy();

    useConnectionStore.getState().setProfileHealth(id!, {
      status: "healthy",
      checkedAt: "2026-03-03T00:00:00.000Z",
      errorSummary: null,
    });

    expect(useConnectionStore.getState().profileHealthMap[id!]).toBeDefined();

    useConnectionStore.getState().deleteConnectionProfile(id!);

    expect(useConnectionStore.getState().connectionProfiles).toHaveLength(0);
    expect(useConnectionStore.getState().profileHealthMap[id!]).toBeUndefined();
  });

  it("resetConnectionState clears connection and profiles", () => {
    useConnectionStore.setState({
      connection: { url: "https://example.com", apiKey: "key" },
      connected: true,
    });
    useConnectionStore
      .getState()
      .saveConnectionProfile("Prod", { url: "https://prod.example.com", apiKey: "prod-key" });

    useConnectionStore.getState().resetConnectionState();

    const state = useConnectionStore.getState();
    expect(state.connection).toBeNull();
    expect(state.connected).toBe(false);
    expect(state.connectionProfiles).toEqual([]);
    expect(state.activeProfileId).toBeNull();
  });
});

describe("useConnectionStore connection profiles", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useConnectionStore.getState().resetConnectionState();
  });

  it("saveConnectionProfile creates a profile from the provided connection", () => {
    const conn = { url: "https://dev.example.com", apiKey: "dev-key" };

    const id = useConnectionStore.getState().saveConnectionProfile("Dev Cluster", conn);

    expect(id).toBeTruthy();
    const state = useConnectionStore.getState();
    expect(state.connectionProfiles).toHaveLength(1);
    expect(state.connectionProfiles[0].name).toBe("Dev Cluster");
    expect(state.connectionProfiles[0].connection.url).toBe("https://dev.example.com");
    expect(state.connectionProfiles[0].connection.apiKey).toBe("dev-key");
    expect(state.activeProfileId).toBe(id);
  });

  it("saveConnectionProfile adds multiple profiles", () => {
    useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "dev-key" });
    useConnectionStore
      .getState()
      .saveConnectionProfile("Prod", { url: "https://prod.example.com", apiKey: "prod-key" });

    expect(useConnectionStore.getState().connectionProfiles).toHaveLength(2);
  });

  it("deleteConnectionProfile clears activeProfileId when deleting the active profile", () => {
    const conn = { url: "https://dev.example.com", apiKey: "dev-key" };
    const id = useConnectionStore.getState().saveConnectionProfile("Dev", conn);
    expect(useConnectionStore.getState().activeProfileId).toBe(id);

    useConnectionStore.getState().deleteConnectionProfile(id!);

    expect(useConnectionStore.getState().activeProfileId).toBeNull();
  });

  it("deleteConnectionProfile preserves activeProfileId when deleting a different profile", () => {
    const devId = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "dev-key" });
    const prodId = useConnectionStore
      .getState()
      .saveConnectionProfile("Prod", { url: "https://prod.example.com", apiKey: "prod-key" });

    useConnectionStore.getState().deleteConnectionProfile(devId!);

    expect(useConnectionStore.getState().activeProfileId).toBe(prodId);
    expect(useConnectionStore.getState().connectionProfiles).toHaveLength(1);
  });

  it("renameConnectionProfile updates the profile name", () => {
    const conn = { url: "https://dev.example.com", apiKey: "dev-key" };
    const id = useConnectionStore.getState().saveConnectionProfile("Dev", conn);

    useConnectionStore.getState().renameConnectionProfile(id!, "Development");

    const profile = useConnectionStore.getState().connectionProfiles[0];
    expect(profile.name).toBe("Development");
    expect(profile.connection.url).toBe("https://dev.example.com");
  });

  it("getConnectionProfile returns the correct profile", () => {
    const conn = { url: "https://dev.example.com", apiKey: "dev-key" };
    const id = useConnectionStore.getState().saveConnectionProfile("Dev", conn);

    const profile = useConnectionStore.getState().getConnectionProfile(id!);

    expect(profile).toBeDefined();
    expect(profile!.name).toBe("Dev");
  });

  it("getConnectionProfile returns undefined for unknown id", () => {
    const profile = useConnectionStore.getState().getConnectionProfile("nonexistent");

    expect(profile).toBeUndefined();
  });

  it("setActiveProfileId updates the active profile", () => {
    useConnectionStore.getState().setActiveProfileId("some-id");

    expect(useConnectionStore.getState().activeProfileId).toBe("some-id");
  });

  it("saveConnectionProfile returns null for duplicate name", () => {
    useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "dev-key" });
    const id = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev2.example.com", apiKey: "key2" });

    expect(id).toBeNull();
    expect(useConnectionStore.getState().connectionProfiles).toHaveLength(1);
  });

  it("deleteConnectionProfile cleans up sessionStorage credentials", () => {
    const id = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "dev-key" });
    const apiKeyKey = `elastic-peek-connection:profile:${id}:apiKey`;
    const otlpApiKeyKey = `elastic-peek-connection:profile:${id}:otlpApiKey`;
    const passwordKey = `elastic-peek-connection:profile:${id}:password`;
    sessionStorage.setItem(apiKeyKey, "dev-key");
    sessionStorage.setItem(otlpApiKeyKey, "otlp-key");
    sessionStorage.setItem(passwordKey, "dev-pass");

    useConnectionStore.getState().deleteConnectionProfile(id!);

    expect(sessionStorage.getItem(apiKeyKey)).toBeNull();
    expect(sessionStorage.getItem(otlpApiKeyKey)).toBeNull();
    expect(sessionStorage.getItem(passwordKey)).toBeNull();
  });

  it("resetConnectionState clears connection profiles", () => {
    useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "dev-key" });
    expect(useConnectionStore.getState().connectionProfiles).toHaveLength(1);

    useConnectionStore.getState().resetConnectionState();

    expect(useConnectionStore.getState().connectionProfiles).toHaveLength(0);
    expect(useConnectionStore.getState().activeProfileId).toBeNull();
  });
});

describe("useConnectionStore profileHealthMap", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useConnectionStore.getState().resetConnectionState();
  });

  it("setProfileHealth records healthy status for a profile", () => {
    const id = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "dev-key" });

    useConnectionStore.getState().setProfileHealth(id!, {
      status: "healthy",
      checkedAt: "2026-01-01T00:00:00.000Z",
      errorSummary: null,
    });

    const health = useConnectionStore.getState().profileHealthMap[id!];
    expect(health).toBeDefined();
    expect(health.status).toBe("healthy");
    expect(health.errorSummary).toBeNull();
    expect(health.checkedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("setProfileHealth records needs_attention status with error summary", () => {
    const id = useConnectionStore
      .getState()
      .saveConnectionProfile("Prod", { url: "https://prod.example.com", apiKey: "prod-key" });

    useConnectionStore.getState().setProfileHealth(id!, {
      status: "needs_attention",
      checkedAt: "2026-01-01T00:00:01.000Z",
      errorSummary: "Connection refused",
    });

    const health = useConnectionStore.getState().profileHealthMap[id!];
    expect(health.status).toBe("needs_attention");
    expect(health.errorSummary).toBe("Connection refused");
  });

  it("setProfileHealth overwrites an existing health entry", () => {
    const id = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "dev-key" });

    useConnectionStore.getState().setProfileHealth(id!, {
      status: "needs_attention",
      checkedAt: "2026-01-01T00:00:00.000Z",
      errorSummary: "Timeout",
    });
    useConnectionStore.getState().setProfileHealth(id!, {
      status: "healthy",
      checkedAt: "2026-01-01T00:00:01.000Z",
      errorSummary: null,
    });

    const health = useConnectionStore.getState().profileHealthMap[id!];
    expect(health.status).toBe("healthy");
    expect(health.errorSummary).toBeNull();
  });

  it("setProfileHealth does not affect health entries for other profiles", () => {
    const devId = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "dev-key" });
    const prodId = useConnectionStore
      .getState()
      .saveConnectionProfile("Prod", { url: "https://prod.example.com", apiKey: "prod-key" });

    useConnectionStore.getState().setProfileHealth(devId!, {
      status: "healthy",
      checkedAt: "2026-01-01T00:00:00.000Z",
      errorSummary: null,
    });
    useConnectionStore.getState().setProfileHealth(prodId!, {
      status: "needs_attention",
      checkedAt: "2026-01-01T00:00:01.000Z",
      errorSummary: "Auth failed",
    });

    expect(useConnectionStore.getState().profileHealthMap[devId!].status).toBe("healthy");
    expect(useConnectionStore.getState().profileHealthMap[prodId!].status).toBe("needs_attention");
  });

  it("resetConnectionState clears profileHealthMap", () => {
    const id = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "dev-key" });

    useConnectionStore.getState().setProfileHealth(id!, {
      status: "healthy",
      checkedAt: "2026-01-01T00:00:00.000Z",
      errorSummary: null,
    });
    expect(Object.keys(useConnectionStore.getState().profileHealthMap)).toHaveLength(1);

    useConnectionStore.getState().resetConnectionState();

    expect(useConnectionStore.getState().profileHealthMap).toEqual({});
  });
});

describe("useConnectionStore profile switch actions", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useConnectionStore.getState().resetConnectionState();
    vi.restoreAllMocks();
  });

  it("switchConnectionProfile sets active connection and marks profile healthy", async () => {
    const profileId = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "dev-key" });
    const capabilities = {
      canManageDataStreams: true,
      canCreateApiKeys: true,
      canReadSecurityUsers: true,
      canReadSecurityRoles: true,
      canReadApiKeys: true,
    };
    vi.spyOn(esServices, "fetchCapabilitiesForConnection").mockResolvedValue(capabilities);

    const result = await useConnectionStore.getState().switchConnectionProfile(profileId!);
    const state = useConnectionStore.getState();

    expect(result).toEqual({ ok: true, profileName: "Dev" });
    expect(state.connection).toEqual({ url: "https://dev.example.com", apiKey: "dev-key" });
    expect(state.connected).toBe(true);
    expect(state.capabilities).toEqual(capabilities);
    expect(state.activeProfileId).toBe(profileId);
    expect(state.profileHealthMap[profileId!].status).toBe("healthy");
  });

  it("retestConnectionProfile marks profile as needs_attention on failure", async () => {
    const profileId = useConnectionStore
      .getState()
      .saveConnectionProfile("Prod", { url: "https://prod.example.com", apiKey: "prod-key" });
    vi.spyOn(esServices, "fetchCapabilitiesForConnection").mockRejectedValue(
      new Error("Connection refused"),
    );

    const result = await useConnectionStore.getState().retestConnectionProfile(profileId!);
    const health = useConnectionStore.getState().profileHealthMap[profileId!];

    expect(result).toEqual({
      ok: false,
      profileName: "Prod",
      message: "Error: Connection refused",
    });
    expect(health.status).toBe("needs_attention");
    expect(health.errorSummary).toBe("Error: Connection refused");
  });
});
