// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

import { createElectronStorage, isElectronAvailable } from "../../src/store/createElectronStorage";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

interface TestState {
  username: string;
  secret?: string;
}

function makeIpcMock() {
  const store: Record<string, string> = {};
  return {
    storeCredential: vi.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    retrieveCredential: vi.fn(async (key: string) => store[key] ?? ""),
    deleteCredential: vi.fn(async (key: string) => {
      delete store[key];
    }),
    store,
  };
}

function makeTestStorage(ipc: ReturnType<typeof makeIpcMock>) {
  return createElectronStorage<TestState>({
    restoreSecrets: async (_name, state) => ({
      ...state,
      secret: await ipc.retrieveCredential("test-secret"),
    }),
    persistSecrets: async (_name, state) => {
      await ipc.storeCredential("test-secret", state.secret ?? "");
    },
    stripSecrets: (state) => ({ ...state, secret: "" }),
    clearSecrets: async () => {
      await ipc.deleteCredential("test-secret");
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createElectronStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("getItem returns null when localStorage has no entry", async () => {
    const ipc = makeIpcMock();
    const storage = makeTestStorage(ipc);
    expect(await storage.getItem("my-store")).toBeNull();
  });

  it("getItem returns null on malformed JSON", async () => {
    const ipc = makeIpcMock();
    const storage = makeTestStorage(ipc);
    localStorage.setItem("my-store", "not-valid-json");
    expect(await storage.getItem("my-store")).toBeNull();
  });

  it("setItem writes stripped state to localStorage and secrets via IPC", async () => {
    const ipc = makeIpcMock();
    const storage = makeTestStorage(ipc);

    await storage.setItem("my-store", {
      state: { username: "alice", secret: "hunter2" },
      version: 1,
    });

    const raw = localStorage.getItem("my-store");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { state: TestState };
    expect(parsed.state.secret).toBe(""); // stripped from localStorage
    expect(parsed.state.username).toBe("alice");

    expect(ipc.storeCredential).toHaveBeenCalledWith("test-secret", "hunter2");
  });

  it("getItem restores secrets from IPC", async () => {
    const ipc = makeIpcMock();
    const storage = makeTestStorage(ipc);

    await storage.setItem("my-store", {
      state: { username: "alice", secret: "hunter2" },
      version: 1,
    });

    const result = await storage.getItem("my-store");
    expect(result).not.toBeNull();
    expect(result!.state.username).toBe("alice");
    expect(result!.state.secret).toBe("hunter2");
    expect(ipc.retrieveCredential).toHaveBeenCalledWith("test-secret");
  });

  it("removeItem clears localStorage and calls deleteCredential", async () => {
    const ipc = makeIpcMock();
    const storage = makeTestStorage(ipc);

    await storage.setItem("my-store", {
      state: { username: "alice", secret: "hunter2" },
      version: 1,
    });

    await storage.removeItem("my-store");

    expect(localStorage.getItem("my-store")).toBeNull();
    expect(ipc.deleteCredential).toHaveBeenCalledWith("test-secret");
  });
});

// ---------------------------------------------------------------------------
// isElectronAvailable
// ---------------------------------------------------------------------------

describe("isElectronAvailable", () => {
  it("returns false when window.electronAPI is not set", () => {
    expect(isElectronAvailable()).toBe(false);
  });

  it("returns true when window.electronAPI.isElectron is true", () => {
    Object.defineProperty(window, "electronAPI", {
      value: { isElectron: true },
      writable: true,
      configurable: true,
    });
    expect(isElectronAvailable()).toBe(true);
    Object.defineProperty(window, "electronAPI", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });
});
