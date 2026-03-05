/**
 * Storage adapter configuration for the connection store.
 *
 * Extracts the persisted-state type, key constants, credential-stripping
 * helpers, and both the browser split-secret and Electron IPC storage
 * adapters so they can evolve independently of the domain state slices.
 */

import type { ConnectionProfile, ElasticsearchConnection } from "../types";

import { createSplitSecretStorage } from "./createSplitSecretStorage";
import { createElectronStorage, isElectronAvailable } from "./createElectronStorage";

// ---------------------------------------------------------------------------
// Persisted-state shape
// ---------------------------------------------------------------------------

export type PersistedConnectionState = {
  connection?: ElasticsearchConnection | null;
  connectionProfiles?: ConnectionProfile[];
  activeProfileId?: string | null;
};

// ---------------------------------------------------------------------------
// Storage key constants
// ---------------------------------------------------------------------------

export const CONNECTION_STORE_NAME = "elastic-peek-connection";
export const API_KEY_SESSION_SUFFIX = ":apiKey";
export const OTLP_API_KEY_SESSION_SUFFIX = ":otlpApiKey";
export const PASSWORD_SESSION_SUFFIX = ":password";
export const PROFILE_SESSION_PREFIX = ":profile:";
export const ENCRYPTED_STORE_SUFFIX = ":enc";

// ---------------------------------------------------------------------------
// Credential-stripping helpers (keep secrets out of localStorage)
// ---------------------------------------------------------------------------

export function stripCredentials(conn: ElasticsearchConnection): ElasticsearchConnection {
  return { ...conn, apiKey: "", password: "", otlpApiKey: "" };
}

export function stripProfileCredentials(profiles: ConnectionProfile[]): ConnectionProfile[] {
  return profiles.map((p) => ({ ...p, connection: stripCredentials(p.connection) }));
}

// ---------------------------------------------------------------------------
// Browser split-secret storage — credentials in sessionStorage, rest in localStorage
// ---------------------------------------------------------------------------

export const splitStorage = createSplitSecretStorage<PersistedConnectionState>({
  restoreSecrets: (name, state) => {
    const restored = { ...state };
    if (restored.connection) {
      const apiKey = sessionStorage.getItem(name + API_KEY_SESSION_SUFFIX) ?? "";
      const otlpApiKey = sessionStorage.getItem(name + OTLP_API_KEY_SESSION_SUFFIX) ?? "";
      const password = sessionStorage.getItem(name + PASSWORD_SESSION_SUFFIX) ?? "";
      restored.connection = { ...restored.connection, apiKey, otlpApiKey, password };
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
        const pOtlpApiKey =
          sessionStorage.getItem(
            name + PROFILE_SESSION_PREFIX + profile.id + OTLP_API_KEY_SESSION_SUFFIX,
          ) ?? "";
        return {
          ...profile,
          connection: {
            ...profile.connection,
            apiKey: pApiKey,
            password: pPassword,
            otlpApiKey: pOtlpApiKey,
          },
        };
      });
    }
    return restored;
  },
  persistSecrets: (name, state) => {
    sessionStorage.setItem(name + API_KEY_SESSION_SUFFIX, state.connection?.apiKey ?? "");
    sessionStorage.setItem(name + OTLP_API_KEY_SESSION_SUFFIX, state.connection?.otlpApiKey ?? "");
    sessionStorage.setItem(name + PASSWORD_SESSION_SUFFIX, state.connection?.password ?? "");
    for (const profile of state.connectionProfiles ?? []) {
      sessionStorage.setItem(
        name + PROFILE_SESSION_PREFIX + profile.id + API_KEY_SESSION_SUFFIX,
        profile.connection.apiKey ?? "",
      );
      sessionStorage.setItem(
        name + PROFILE_SESSION_PREFIX + profile.id + OTLP_API_KEY_SESSION_SUFFIX,
        profile.connection.otlpApiKey ?? "",
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
        const stored = JSON.parse(localRaw) as { state: PersistedConnectionState };
        for (const profile of stored.state.connectionProfiles ?? []) {
          sessionStorage.removeItem(
            name + PROFILE_SESSION_PREFIX + profile.id + API_KEY_SESSION_SUFFIX,
          );
          sessionStorage.removeItem(
            name + PROFILE_SESSION_PREFIX + profile.id + OTLP_API_KEY_SESSION_SUFFIX,
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
    sessionStorage.removeItem(name + OTLP_API_KEY_SESSION_SUFFIX);
    sessionStorage.removeItem(name + PASSWORD_SESSION_SUFFIX);
  },
});

// ---------------------------------------------------------------------------
// Electron storage — async, uses safeStorage via IPC instead of sessionStorage
// ---------------------------------------------------------------------------

export const electronStorage = createElectronStorage<PersistedConnectionState>({
  restoreSecrets: async (name, state) => {
    const api = window.electronAPI!;
    const restored = { ...state };
    if (restored.connection) {
      const apiKey = await api.retrieveCredential(name + API_KEY_SESSION_SUFFIX);
      const otlpApiKey = await api.retrieveCredential(name + OTLP_API_KEY_SESSION_SUFFIX);
      const password = await api.retrieveCredential(name + PASSWORD_SESSION_SUFFIX);
      restored.connection = { ...restored.connection, apiKey, otlpApiKey, password };
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
          const pOtlpApiKey = await api.retrieveCredential(
            name + PROFILE_SESSION_PREFIX + profile.id + OTLP_API_KEY_SESSION_SUFFIX,
          );
          return {
            ...profile,
            connection: {
              ...profile.connection,
              apiKey: pApiKey,
              password: pPassword,
              otlpApiKey: pOtlpApiKey,
            },
          };
        }),
      );
    }
    return restored;
  },
  persistSecrets: async (name, state) => {
    const api = window.electronAPI!;
    await api.storeCredential(name + API_KEY_SESSION_SUFFIX, state.connection?.apiKey ?? "");
    await api.storeCredential(
      name + OTLP_API_KEY_SESSION_SUFFIX,
      state.connection?.otlpApiKey ?? "",
    );
    await api.storeCredential(name + PASSWORD_SESSION_SUFFIX, state.connection?.password ?? "");
    await Promise.all(
      (state.connectionProfiles ?? []).flatMap((profile) => [
        api.storeCredential(
          name + PROFILE_SESSION_PREFIX + profile.id + API_KEY_SESSION_SUFFIX,
          profile.connection.apiKey ?? "",
        ),
        api.storeCredential(
          name + PROFILE_SESSION_PREFIX + profile.id + OTLP_API_KEY_SESSION_SUFFIX,
          profile.connection.otlpApiKey ?? "",
        ),
        api.storeCredential(
          name + PROFILE_SESSION_PREFIX + profile.id + PASSWORD_SESSION_SUFFIX,
          profile.connection.password ?? "",
        ),
      ]),
    );
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
    const collectDeleteFailures = (
      results: PromiseSettledResult<unknown>[],
      keys: string[],
    ): Error[] =>
      results
        .map((result, index) => ({ result, key: keys[index] }))
        .filter(
          (entry): entry is { result: PromiseRejectedResult; key: string } =>
            entry.result.status === "rejected",
        )
        .map(
          ({ result, key }) =>
            new Error(`Failed to delete credential "${key}": ${String(result.reason)}`),
        );
    const deletionFailures: Error[] = [];

    if (localRaw) {
      let stored: { state: PersistedConnectionState } | null = null;
      try {
        const parsed = JSON.parse(localRaw) as unknown;
        if (
          parsed &&
          typeof parsed === "object" &&
          "state" in parsed &&
          parsed.state &&
          typeof parsed.state === "object"
        ) {
          stored = parsed as { state: PersistedConnectionState };
        }
      } catch {
        /* ignore parse errors during cleanup */
      }
      if (stored) {
        const storedProfiles = Array.isArray(stored.state.connectionProfiles)
          ? stored.state.connectionProfiles
          : [];
        const profileDeleteKeys = storedProfiles.flatMap((profile) => [
          name + PROFILE_SESSION_PREFIX + profile.id + API_KEY_SESSION_SUFFIX,
          name + PROFILE_SESSION_PREFIX + profile.id + OTLP_API_KEY_SESSION_SUFFIX,
          name + PROFILE_SESSION_PREFIX + profile.id + PASSWORD_SESSION_SUFFIX,
        ]);
        const profileDeleteResults = await Promise.allSettled(
          profileDeleteKeys.map((key) => api.deleteCredential(key)),
        );
        deletionFailures.push(...collectDeleteFailures(profileDeleteResults, profileDeleteKeys));
      }
    }
    const baseDeleteKeys = [
      name + API_KEY_SESSION_SUFFIX,
      name + OTLP_API_KEY_SESSION_SUFFIX,
      name + PASSWORD_SESSION_SUFFIX,
    ];
    const baseDeleteResults = await Promise.allSettled(
      baseDeleteKeys.map((key) => api.deleteCredential(key)),
    );
    deletionFailures.push(...collectDeleteFailures(baseDeleteResults, baseDeleteKeys));
    if (deletionFailures.length > 0) {
      throw new AggregateError(deletionFailures, "Failed to delete one or more credentials");
    }
  },
});

// Use safeStorage-backed async storage in Electron; sessionStorage split in web browsers
export const connectionStorage = isElectronAvailable() ? electronStorage : splitStorage;
