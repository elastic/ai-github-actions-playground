import { describe, it, expect, beforeEach } from "vitest";

import { createSplitSecretStorage } from "../../src/store/createSplitSecretStorage";

interface TestState {
  username: string;
  secret?: string;
}

function makeTestStorage() {
  return createSplitSecretStorage<TestState>({
    restoreSecrets: (_name, state) => ({
      ...state,
      secret: sessionStorage.getItem("test-secret") ?? "",
    }),
    persistSecrets: (_name, state) => {
      sessionStorage.setItem("test-secret", state.secret ?? "");
    },
    stripSecrets: (state) => ({ ...state, secret: "" }),
    clearSecrets: () => {
      sessionStorage.removeItem("test-secret");
    },
  });
}

describe("createSplitSecretStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("getItem returns null when localStorage has no entry", async () => {
    const storage = makeTestStorage();
    expect(await storage.getItem("my-store")).toBeNull();
  });

  it("getItem returns null and recovers gracefully on malformed JSON", async () => {
    localStorage.setItem("my-store", "not-valid-json");
    const storage = makeTestStorage();
    expect(await storage.getItem("my-store")).toBeNull();
  });

  it("getItem returns null when stored value has no state", async () => {
    localStorage.setItem("my-store", JSON.stringify({ version: 1 }));
    const storage = makeTestStorage();
    expect(await storage.getItem("my-store")).toBeNull();
  });

  it("setItem writes stripped state to localStorage and secrets to sessionStorage", async () => {
    const storage = makeTestStorage();
    await storage.setItem("my-store", {
      state: { username: "alice", secret: "hunter2" },
      version: 1,
    });

    const raw = localStorage.getItem("my-store");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { state: TestState };
    expect(parsed.state.secret).toBe("");
    expect(parsed.state.username).toBe("alice");

    expect(sessionStorage.getItem("test-secret")).toBe("hunter2");
  });

  it("getItem restores secrets from sessionStorage", async () => {
    const storage = makeTestStorage();
    await storage.setItem("my-store", {
      state: { username: "alice", secret: "hunter2" },
      version: 1,
    });

    const result = await storage.getItem("my-store");
    expect(result).not.toBeNull();
    expect(result!.state.username).toBe("alice");
    expect(result!.state.secret).toBe("hunter2");
  });

  it("getItem restores empty string when session key is absent", async () => {
    localStorage.setItem(
      "my-store",
      JSON.stringify({ state: { username: "bob", secret: "" }, version: 1 }),
    );
    // sessionStorage has no entry — expect empty string restored
    const storage = makeTestStorage();
    const result = await storage.getItem("my-store");
    expect(result!.state.secret).toBe("");
  });

  it("removeItem clears localStorage and sessionStorage", async () => {
    const storage = makeTestStorage();
    await storage.setItem("my-store", {
      state: { username: "alice", secret: "hunter2" },
      version: 1,
    });

    await storage.removeItem("my-store");

    expect(localStorage.getItem("my-store")).toBeNull();
    expect(sessionStorage.getItem("test-secret")).toBeNull();
  });

  it("removeItem passes the current localStorage raw string to clearSecrets", async () => {
    const cleared: Array<string | null> = [];
    const storage = createSplitSecretStorage<TestState>({
      restoreSecrets: (_name, state) => state,
      persistSecrets: () => {},
      stripSecrets: (state) => state,
      clearSecrets: (_name, localRaw) => {
        cleared.push(localRaw);
      },
    });

    await storage.setItem("my-store", { state: { username: "x" }, version: 0 });
    await storage.removeItem("my-store");

    expect(cleared).toHaveLength(1);
    expect(cleared[0]).not.toBeNull();
  });

  it("removeItem passes null to clearSecrets when localStorage entry is absent", async () => {
    const cleared: Array<string | null> = [];
    const storage = createSplitSecretStorage<TestState>({
      restoreSecrets: (_name, state) => state,
      persistSecrets: () => {},
      stripSecrets: (state) => state,
      clearSecrets: (_name, localRaw) => {
        cleared.push(localRaw);
      },
    });

    await storage.removeItem("nonexistent");
    expect(cleared[0]).toBeNull();
  });
});
