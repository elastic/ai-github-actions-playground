import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ConnectionProfile, ElasticsearchConnection, ProfileHealth } from "../types";
import type { UserCapabilities } from "../services/es";
import type { EncryptedPayload } from "../utils/crypto";
import { encryptWithPin, decryptWithPin } from "../utils/crypto";

import { createSplitSecretStorage } from "./createSplitSecretStorage";
import { createElectronStorage, isElectronAvailable } from "./createElectronStorage";

interface ConnectionState {
  connection: ElasticsearchConnection | null;
  connected: boolean;
  capabilities: UserCapabilities | null;
  connectionProfiles: ConnectionProfile[];
  activeProfileId: string | null;
  profileHealthMap: Record<string, ProfileHealth>;

  setConnection: (conn: ElasticsearchConnection) => void;
  setConnected: (connected: boolean) => void;
  setCapabilities: (caps: UserCapabilities | null) => void;
  saveConnectionProfile: (name: string, connection: ElasticsearchConnection) => string | null;
  deleteConnectionProfile: (id: string) => void;
  renameConnectionProfile: (id: string, name: string) => void;
  setActiveProfileId: (id: string | null) => void;
  getConnectionProfile: (id: string) => ConnectionProfile | undefined;
  setProfileHealth: (id: string, health: ProfileHealth) => void;
  /**
   * Encrypt the profile's credentials with a PIN and persist them to localStorage.
   * After this call the profile is marked `encrypted: true`; credentials remain
   * available in memory for the remainder of the session.
   */
  lockProfile: (id: string, pin: string) => Promise<void>;
  /**
   * Decrypt the profile's credentials from localStorage using the supplied PIN.
   * Returns `true` on success, `false` if the PIN is wrong or no encrypted data exists.
   */
  unlockProfile: (id: string, pin: string) => Promise<boolean>;
  resetConnectionState: () => void;
}

type PersistedState = {
  connection?: ElasticsearchConnection | null;
  connectionProfiles?: ConnectionProfile[];
  activeProfileId?: string | null;
};

const STORE_NAME = "elastic-peek-connection";
const API_KEY_SESSION_SUFFIX = ":apiKey";
const PASSWORD_SESSION_SUFFIX = ":password";
const PROFILE_SESSION_PREFIX = ":profile:";
const ENCRYPTED_STORE_SUFFIX = ":enc";

function stripCredentials(conn: ElasticsearchConnection): ElasticsearchConnection {
  return { ...conn, apiKey: "", password: "" };
}

function stripProfileCredentials(profiles: ConnectionProfile[]): ConnectionProfile[] {
  return profiles.map((p) => ({ ...p, connection: stripCredentials(p.connection) }));
}

const splitStorage = createSplitSecretStorage<PersistedState>({
  restoreSecrets: (name, state) => {
    const restored = { ...state };
    if (restored.connection) {
      const apiKey = sessionStorage.getItem(name + API_KEY_SESSION_SUFFIX) ?? "";
      const password = sessionStorage.getItem(name + PASSWORD_SESSION_SUFFIX) ?? "";
      restored.connection = { ...restored.connection, apiKey, password };
    }
    if (restored.connectionProfiles) {
      restored.connectionProfiles = restored.connectionProfiles.map((profile) => {
        const pApiKey =
          sessionStorage.getItem(
            name + PROFILE_SESSION_PREFIX + profile.id + API_KEY_SESSION_SUFFIX,
          ) ?? "";
        const pPassword =
          sessionStorage.getItem(
            name + PROFILE_SESSION_PREFIX + profile.id + PASSWORD_SESSION_SUFFIX,
          ) ?? "";
        return {
          ...profile,
          connection: { ...profile.connection, apiKey: pApiKey, password: pPassword },
        };
      });
    }
    return restored;
  },
  persistSecrets: (name, state) => {
    sessionStorage.setItem(name + API_KEY_SESSION_SUFFIX, state.connection?.apiKey ?? "");
    sessionStorage.setItem(name + PASSWORD_SESSION_SUFFIX, state.connection?.password ?? "");
    for (const profile of state.connectionProfiles ?? []) {
      sessionStorage.setItem(
        name + PROFILE_SESSION_PREFIX + profile.id + API_KEY_SESSION_SUFFIX,
        profile.connection.apiKey ?? "",
      );
      sessionStorage.setItem(
        name + PROFILE_SESSION_PREFIX + profile.id + PASSWORD_SESSION_SUFFIX,
        profile.connection.password ?? "",
      );
    }
  },
  stripSecrets: (state) => {
    const profiles = state.connectionProfiles ?? [];
    return {
      ...state,
      connection: state.connection ? stripCredentials(state.connection) : state.connection,
      connectionProfiles: profiles.length > 0 ? stripProfileCredentials(profiles) : profiles,
    };
  },
  clearSecrets: (name, localRaw) => {
    if (localRaw) {
      try {
        const stored = JSON.parse(localRaw) as { state: PersistedState };
        for (const profile of stored.state.connectionProfiles ?? []) {
          sessionStorage.removeItem(
            name + PROFILE_SESSION_PREFIX + profile.id + API_KEY_SESSION_SUFFIX,
          );
          sessionStorage.removeItem(
            name + PROFILE_SESSION_PREFIX + profile.id + PASSWORD_SESSION_SUFFIX,
          );
        }
      } catch {
        /* ignore parse errors during cleanup */
      }
    }
    sessionStorage.removeItem(name + API_KEY_SESSION_SUFFIX);
    sessionStorage.removeItem(name + PASSWORD_SESSION_SUFFIX);
  },
});

// ---------------------------------------------------------------------------
// Electron storage — async, uses safeStorage via IPC instead of sessionStorage
// ---------------------------------------------------------------------------

const electronStorage = createElectronStorage<PersistedState>({
  restoreSecrets: async (name, state) => {
    const api = window.electronAPI!;
    const restored = { ...state };
    if (restored.connection) {
      const apiKey = await api.retrieveCredential(name + API_KEY_SESSION_SUFFIX);
      const password = await api.retrieveCredential(name + PASSWORD_SESSION_SUFFIX);
      restored.connection = { ...restored.connection, apiKey, password };
    }
    if (restored.connectionProfiles) {
      restored.connectionProfiles = await Promise.all(
        restored.connectionProfiles.map(async (profile) => {
          const pApiKey = await api.retrieveCredential(
            name + PROFILE_SESSION_PREFIX + profile.id + API_KEY_SESSION_SUFFIX,
          );
          const pPassword = await api.retrieveCredential(
            name + PROFILE_SESSION_PREFIX + profile.id + PASSWORD_SESSION_SUFFIX,
          );
          return {
            ...profile,
            connection: { ...profile.connection, apiKey: pApiKey, password: pPassword },
          };
        }),
      );
    }
    return restored;
  },
  persistSecrets: async (name, state) => {
    const api = window.electronAPI!;
    await api.storeCredential(name + API_KEY_SESSION_SUFFIX, state.connection?.apiKey ?? "");
    await api.storeCredential(name + PASSWORD_SESSION_SUFFIX, state.connection?.password ?? "");
    for (const profile of state.connectionProfiles ?? []) {
      await api.storeCredential(
        name + PROFILE_SESSION_PREFIX + profile.id + API_KEY_SESSION_SUFFIX,
        profile.connection.apiKey ?? "",
      );
      await api.storeCredential(
        name + PROFILE_SESSION_PREFIX + profile.id + PASSWORD_SESSION_SUFFIX,
        profile.connection.password ?? "",
      );
    }
  },
  stripSecrets: (state) => {
    const profiles = state.connectionProfiles ?? [];
    return {
      ...state,
      connection: state.connection ? stripCredentials(state.connection) : state.connection,
      connectionProfiles: profiles.length > 0 ? stripProfileCredentials(profiles) : profiles,
    };
  },
  clearSecrets: async (name, localRaw) => {
    const api = window.electronAPI!;
    if (localRaw) {
      try {
        const stored = JSON.parse(localRaw) as { state: PersistedState };
        for (const profile of stored.state.connectionProfiles ?? []) {
          await api.deleteCredential(
            name + PROFILE_SESSION_PREFIX + profile.id + API_KEY_SESSION_SUFFIX,
          );
          await api.deleteCredential(
            name + PROFILE_SESSION_PREFIX + profile.id + PASSWORD_SESSION_SUFFIX,
          );
        }
      } catch {
        /* ignore parse errors during cleanup */
      }
    }
    await api.deleteCredential(name + API_KEY_SESSION_SUFFIX);
    await api.deleteCredential(name + PASSWORD_SESSION_SUFFIX);
  },
});

// Use safeStorage-backed async storage in Electron; sessionStorage split in web browsers
const storage = isElectronAvailable() ? electronStorage : splitStorage;

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      connection: null,
      connected: false,
      capabilities: null,
      connectionProfiles: [],
      activeProfileId: null,
      profileHealthMap: {},

      setConnection: (conn) => set({ connection: conn }),
      setConnected: (connected) => set({ connected }),
      setCapabilities: (caps) => set({ capabilities: caps }),

      saveConnectionProfile: (name, connection) => {
        const { connectionProfiles } = get();
        if (connectionProfiles.some((p) => p.name === name)) return null;
        const id = crypto.randomUUID();
        const profile: ConnectionProfile = { id, name, connection: { ...connection } };
        set({ connectionProfiles: [...connectionProfiles, profile], activeProfileId: id });
        return id;
      },

      deleteConnectionProfile: (id) =>
        set((s) => {
          if (isElectronAvailable()) {
            // Fire-and-forget: credential deletion is async but UI update is sync.
            // Errors are logged but do not block the profile removal.
            void window
              .electronAPI!.deleteCredential(
                STORE_NAME + PROFILE_SESSION_PREFIX + id + API_KEY_SESSION_SUFFIX,
              )
              .catch(console.error);
            void window
              .electronAPI!.deleteCredential(
                STORE_NAME + PROFILE_SESSION_PREFIX + id + PASSWORD_SESSION_SUFFIX,
              )
              .catch(console.error);
          } else {
            sessionStorage.removeItem(
              STORE_NAME + PROFILE_SESSION_PREFIX + id + API_KEY_SESSION_SUFFIX,
            );
            sessionStorage.removeItem(
              STORE_NAME + PROFILE_SESSION_PREFIX + id + PASSWORD_SESSION_SUFFIX,
            );
          }
          localStorage.removeItem(
            STORE_NAME + PROFILE_SESSION_PREFIX + id + ENCRYPTED_STORE_SUFFIX,
          );
          const filtered = s.connectionProfiles.filter((p) => p.id !== id);
          return {
            connectionProfiles: filtered,
            activeProfileId: s.activeProfileId === id ? null : s.activeProfileId,
          };
        }),

      renameConnectionProfile: (id, name) =>
        set((s) => ({
          connectionProfiles: s.connectionProfiles.map((p) => (p.id === id ? { ...p, name } : p)),
        })),

      setActiveProfileId: (id) => set({ activeProfileId: id }),

      getConnectionProfile: (id) => {
        return get().connectionProfiles.find((p) => p.id === id);
      },

      setProfileHealth: (id, health) =>
        set((s) => ({ profileHealthMap: { ...s.profileHealthMap, [id]: health } })),

      lockProfile: async (id, pin) => {
        const profile = get().connectionProfiles.find((p) => p.id === id);
        if (!profile) return;
        const { apiKey = "", password = "" } = profile.connection;
        const payload = await encryptWithPin(pin, JSON.stringify({ apiKey, password }));
        localStorage.setItem(
          STORE_NAME + PROFILE_SESSION_PREFIX + id + ENCRYPTED_STORE_SUFFIX,
          JSON.stringify(payload),
        );
        set((s) => ({
          connectionProfiles: s.connectionProfiles.map((p) =>
            p.id === id ? { ...p, encrypted: true } : p,
          ),
        }));
      },

      unlockProfile: async (id, pin) => {
        const raw = localStorage.getItem(
          STORE_NAME + PROFILE_SESSION_PREFIX + id + ENCRYPTED_STORE_SUFFIX,
        );
        if (!raw) return false;
        try {
          const payload = JSON.parse(raw) as EncryptedPayload;
          const plaintext = await decryptWithPin(pin, payload);
          if (plaintext === null) return false;
          const parsed: unknown = JSON.parse(plaintext);
          if (typeof parsed !== "object" || parsed === null) return false;
          const creds = parsed as Record<string, unknown>;
          const apiKey = typeof creds.apiKey === "string" ? creds.apiKey : "";
          const password = typeof creds.password === "string" ? creds.password : "";
          set((s) => ({
            connectionProfiles: s.connectionProfiles.map((p) =>
              p.id === id ? { ...p, connection: { ...p.connection, apiKey, password } } : p,
            ),
          }));
          return true;
        } catch {
          return false;
        }
      },

      resetConnectionState: () => {
        for (const profile of get().connectionProfiles) {
          localStorage.removeItem(
            STORE_NAME + PROFILE_SESSION_PREFIX + profile.id + ENCRYPTED_STORE_SUFFIX,
          );
        }
        void storage.removeItem(STORE_NAME);
        set({
          connection: null,
          connected: false,
          capabilities: null,
          connectionProfiles: [],
          activeProfileId: null,
          profileHealthMap: {},
        });
      },
    }),
    {
      name: STORE_NAME,
      storage,
      partialize: (state) => ({
        connection: state.connection,
        connectionProfiles: state.connectionProfiles,
        activeProfileId: state.activeProfileId,
      }),
    },
  ),
);
