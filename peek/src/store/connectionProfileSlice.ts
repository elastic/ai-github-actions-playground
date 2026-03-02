/**
 * Connection profile slice — saved profile management.
 *
 * Handles CRUD operations for saved connection profiles, active-profile
 * tracking, per-profile health status, and PIN-based credential
 * encryption/decryption. Storage backend concerns live in
 * `connectionStorageAdapters.ts`.
 */

import type { StateCreator } from "zustand";
import { z } from "zod";

import { fetchCapabilitiesForConnection, isElasticsearchError } from "../services/es";
import type { ConnectionProfile, ElasticsearchConnection, ProfileHealth } from "../types";
import type { EncryptedPayload } from "../utils/crypto";
import { encryptWithPin, decryptWithPin } from "../utils/crypto";

import { isElectronAvailable } from "./createElectronStorage";
import {
  CONNECTION_STORE_NAME,
  API_KEY_SESSION_SUFFIX,
  OTLP_API_KEY_SESSION_SUFFIX,
  PASSWORD_SESSION_SUFFIX,
  PROFILE_SESSION_PREFIX,
  ENCRYPTED_STORE_SUFFIX,
} from "./connectionStorageAdapters";

let latestSwitchRequestId = 0;
const latestRequestIdByProfileId = new Map<string, number>();
const latestRetestIdByProfileId = new Map<string, number>();

const credentialsSchema = z
  .object({
    apiKey: z.string().optional().catch(""),
    otlpApiKey: z.string().optional().catch(""),
    password: z.string().optional().catch(""),
  })
  .strict();

export type SwitchOrRetestProfileResult =
  | { ok: true; profileName: string }
  | { ok: false; profileName: string | null; message: string };

export interface ConnectionProfileSlice {
  connectionProfiles: ConnectionProfile[];
  activeProfileId: string | null;
  profileHealthMap: Record<string, ProfileHealth>;

  saveConnectionProfile: (name: string, connection: ElasticsearchConnection) => string | null;
  deleteConnectionProfile: (id: string) => void;
  renameConnectionProfile: (id: string, name: string) => void;
  setActiveProfileId: (id: string | null) => void;
  getConnectionProfile: (id: string) => ConnectionProfile | undefined;
  setProfileHealth: (id: string, health: ProfileHealth) => void;
  switchConnectionProfile: (id: string) => Promise<SwitchOrRetestProfileResult>;
  retestConnectionProfile: (id: string) => Promise<SwitchOrRetestProfileResult>;
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
}

export const createConnectionProfileSlice: StateCreator<
  ConnectionProfileSlice,
  [],
  [],
  ConnectionProfileSlice
> = (set, get) => ({
  connectionProfiles: [],
  activeProfileId: null,
  profileHealthMap: {},

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
      latestRequestIdByProfileId.delete(id);
      latestRetestIdByProfileId.delete(id);
      if (isElectronAvailable()) {
        // Fire-and-forget: credential deletion is async but UI update is sync.
        // Errors are logged but do not block the profile removal.
        void window
          .electronAPI!.deleteCredential(
            CONNECTION_STORE_NAME + PROFILE_SESSION_PREFIX + id + API_KEY_SESSION_SUFFIX,
          )
          .catch(console.error);
        void window
          .electronAPI!.deleteCredential(
            CONNECTION_STORE_NAME + PROFILE_SESSION_PREFIX + id + OTLP_API_KEY_SESSION_SUFFIX,
          )
          .catch(console.error);
        void window
          .electronAPI!.deleteCredential(
            CONNECTION_STORE_NAME + PROFILE_SESSION_PREFIX + id + PASSWORD_SESSION_SUFFIX,
          )
          .catch(console.error);
      } else {
        sessionStorage.removeItem(
          CONNECTION_STORE_NAME + PROFILE_SESSION_PREFIX + id + API_KEY_SESSION_SUFFIX,
        );
        sessionStorage.removeItem(
          CONNECTION_STORE_NAME + PROFILE_SESSION_PREFIX + id + OTLP_API_KEY_SESSION_SUFFIX,
        );
        sessionStorage.removeItem(
          CONNECTION_STORE_NAME + PROFILE_SESSION_PREFIX + id + PASSWORD_SESSION_SUFFIX,
        );
      }
      localStorage.removeItem(
        CONNECTION_STORE_NAME + PROFILE_SESSION_PREFIX + id + ENCRYPTED_STORE_SUFFIX,
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

  switchConnectionProfile: async (id) => {
    const profile = get().connectionProfiles.find((p) => p.id === id);
    if (!profile) {
      return { ok: false, profileName: null, message: "Connection profile not found" };
    }
    const prevActiveProfileId = get().activeProfileId;
    const requestId = ++latestSwitchRequestId;
    latestRequestIdByProfileId.set(id, requestId);
    set({ activeProfileId: id });
    try {
      const caps = await fetchCapabilitiesForConnection(profile.connection);
      if (get().activeProfileId !== id || latestRequestIdByProfileId.get(id) !== requestId) {
        return { ok: true, profileName: profile.name };
      }
      set((s) => ({
        connection: profile.connection,
        connected: true,
        capabilities: caps,
        activeProfileId: id,
        profileHealthMap: {
          ...s.profileHealthMap,
          [id]: {
            status: "healthy",
            checkedAt: new Date().toISOString(),
            errorSummary: null,
          },
        },
      }));
      return { ok: true, profileName: profile.name };
    } catch (err: unknown) {
      const message = isElasticsearchError(err) ? err.message : String(err);
      if (get().activeProfileId !== id || latestRequestIdByProfileId.get(id) !== requestId) {
        return { ok: false, profileName: profile.name, message };
      }
      set((s) => {
        const prevStillExists =
          prevActiveProfileId !== null &&
          s.connectionProfiles.some((p) => p.id === prevActiveProfileId);
        const targetStillExists = s.connectionProfiles.some((p) => p.id === id);
        return {
          activeProfileId:
            s.activeProfileId === id
              ? prevStillExists
                ? prevActiveProfileId
                : null
              : s.activeProfileId,
          profileHealthMap: targetStillExists
            ? {
                ...s.profileHealthMap,
                [id]: {
                  status: "needs_attention",
                  checkedAt: new Date().toISOString(),
                  errorSummary: message,
                },
              }
            : s.profileHealthMap,
        };
      });
      return { ok: false, profileName: profile.name, message };
    }
  },

  retestConnectionProfile: async (id) => {
    const profile = get().connectionProfiles.find((p) => p.id === id);
    if (!profile) {
      return { ok: false, profileName: null, message: "Connection profile not found" };
    }
    const retestId = (latestRetestIdByProfileId.get(id) ?? 0) + 1;
    latestRetestIdByProfileId.set(id, retestId);
    try {
      await fetchCapabilitiesForConnection(profile.connection);
      if (latestRetestIdByProfileId.get(id) !== retestId) {
        return { ok: true, profileName: profile.name };
      }
      set((s) => ({
        profileHealthMap: {
          ...s.profileHealthMap,
          [id]: {
            status: "healthy",
            checkedAt: new Date().toISOString(),
            errorSummary: null,
          },
        },
      }));
      return { ok: true, profileName: profile.name };
    } catch (err: unknown) {
      const message = isElasticsearchError(err) ? err.message : String(err);
      if (latestRetestIdByProfileId.get(id) !== retestId) {
        return { ok: false, profileName: profile.name, message };
      }
      set((s) => ({
        profileHealthMap: {
          ...s.profileHealthMap,
          [id]: {
            status: "needs_attention",
            checkedAt: new Date().toISOString(),
            errorSummary: message,
          },
        },
      }));
      return { ok: false, profileName: profile.name, message };
    }
  },

  lockProfile: async (id, pin) => {
    const profile = get().connectionProfiles.find((p) => p.id === id);
    if (!profile) return;
    const { apiKey = "", password = "", otlpApiKey = "" } = profile.connection;
    const payload = await encryptWithPin(pin, JSON.stringify({ apiKey, password, otlpApiKey }));
    // Re-check: profile may have been deleted while awaiting encryption.
    if (!get().connectionProfiles.some((p) => p.id === id)) return;
    localStorage.setItem(
      CONNECTION_STORE_NAME + PROFILE_SESSION_PREFIX + id + ENCRYPTED_STORE_SUFFIX,
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
      CONNECTION_STORE_NAME + PROFILE_SESSION_PREFIX + id + ENCRYPTED_STORE_SUFFIX,
    );
    if (!raw) return false;
    try {
      const payload = JSON.parse(raw) as EncryptedPayload;
      const plaintext = await decryptWithPin(pin, payload);
      if (plaintext === null) return false;
      const result = credentialsSchema.safeParse(JSON.parse(plaintext));
      if (!result.success) return false;
      const { apiKey = "", otlpApiKey = "", password = "" } = result.data;
      set((s) => ({
        connectionProfiles: s.connectionProfiles.map((p) =>
          p.id === id ? { ...p, connection: { ...p.connection, apiKey, otlpApiKey, password } } : p,
        ),
      }));
      return true;
    } catch {
      return false;
    }
  },
});
