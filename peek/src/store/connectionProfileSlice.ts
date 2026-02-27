/**
 * Connection profile slice — saved profile management.
 *
 * Handles CRUD operations for saved connection profiles, active-profile
 * tracking, per-profile health status, and PIN-based credential
 * encryption/decryption. Storage backend concerns live in
 * `connectionStorageAdapters.ts`.
 */

import type { StateCreator } from "zustand";

import type { ConnectionProfile, ElasticsearchConnection, ProfileHealth } from "../types";
import type { EncryptedPayload } from "../utils/crypto";
import { encryptWithPin, decryptWithPin } from "../utils/crypto";

import { isElectronAvailable } from "./createElectronStorage";
import {
  CONNECTION_STORE_NAME,
  API_KEY_SESSION_SUFFIX,
  PASSWORD_SESSION_SUFFIX,
  PROFILE_SESSION_PREFIX,
  ENCRYPTED_STORE_SUFFIX,
} from "./connectionStorageAdapters";

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
            CONNECTION_STORE_NAME + PROFILE_SESSION_PREFIX + id + PASSWORD_SESSION_SUFFIX,
          )
          .catch(console.error);
      } else {
        sessionStorage.removeItem(
          CONNECTION_STORE_NAME + PROFILE_SESSION_PREFIX + id + API_KEY_SESSION_SUFFIX,
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

  lockProfile: async (id, pin) => {
    const profile = get().connectionProfiles.find((p) => p.id === id);
    if (!profile) return;
    const { apiKey = "", password = "" } = profile.connection;
    const payload = await encryptWithPin(pin, JSON.stringify({ apiKey, password }));
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
});
