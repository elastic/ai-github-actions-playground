import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ConnectionProfile, ElasticsearchConnection, ProfileHealth } from "../types";
import type { UserCapabilities } from "../services/es";

import { createSplitSecretStorage } from "./createSplitSecretStorage";

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
          connection: {
            ...profile.connection,
            apiKey: pApiKey,
            password: pPassword,
          },
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
          sessionStorage.removeItem(
            STORE_NAME + PROFILE_SESSION_PREFIX + id + API_KEY_SESSION_SUFFIX,
          );
          sessionStorage.removeItem(
            STORE_NAME + PROFILE_SESSION_PREFIX + id + PASSWORD_SESSION_SUFFIX,
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

      resetConnectionState: () => {
        splitStorage.removeItem(STORE_NAME);
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
      storage: splitStorage,
      partialize: (state) => ({
        connection: state.connection,
        connectionProfiles: state.connectionProfiles,
        activeProfileId: state.activeProfileId,
      }),
    },
  ),
);
