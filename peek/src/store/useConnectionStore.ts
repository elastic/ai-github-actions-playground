/**
 * useConnectionStore — thin facade that composes domain slices into one store.
 *
 * The implementation is intentionally kept small here. Domain-specific logic
 * lives in focused modules that can be worked on independently:
 *   - sessionConnectionSlice.ts  — active connection, connected flag, capabilities
 *   - connectionProfileSlice.ts  — saved profiles, health tracking, lock/unlock
 *   - connectionStorageAdapters.ts — split-secret and Electron credential adapters
 *
 * All callers continue to import `useConnectionStore` as before; no migration
 * of existing consumers is required.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  type SessionConnectionSlice,
  createSessionConnectionSlice,
} from "./sessionConnectionSlice";
import {
  type ConnectionProfileSlice,
  createConnectionProfileSlice,
} from "./connectionProfileSlice";
import {
  connectionStorage,
  CONNECTION_STORE_NAME,
  PROFILE_SESSION_PREFIX,
  ENCRYPTED_STORE_SUFFIX,
} from "./connectionStorageAdapters";

export type ConnectionState = SessionConnectionSlice &
  ConnectionProfileSlice & {
    resetConnectionState: () => void;
  };

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get, api) => ({
      ...createSessionConnectionSlice(set, get, api),
      ...createConnectionProfileSlice(set, get, api),

      resetConnectionState: () => {
        for (const profile of get().connectionProfiles) {
          localStorage.removeItem(
            CONNECTION_STORE_NAME + PROFILE_SESSION_PREFIX + profile.id + ENCRYPTED_STORE_SUFFIX,
          );
        }
        void connectionStorage.removeItem(CONNECTION_STORE_NAME);
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
      name: CONNECTION_STORE_NAME,
      storage: connectionStorage,
      partialize: (state) => ({
        connection: state.connection,
        connectionProfiles: state.connectionProfiles,
        activeProfileId: state.activeProfileId,
      }),
    },
  ),
);
