import type { ConnectionProfile, ElasticsearchConnection, DashboardDefinition } from "../types";

const LEGACY_STORE_NAME = "elastic-peek";
const CONNECTION_STORE_NAME = "elastic-peek-connection";
const UI_STORE_NAME = "elastic-peek-ui";
const QUERY_STORE_NAME = "elastic-peek-query";
const DASHBOARD_STORE_NAME = "elastic-peek-dashboard";

const API_KEY_SESSION_SUFFIX = ":apiKey";
const PASSWORD_SESSION_SUFFIX = ":password";
const PROFILE_SESSION_PREFIX = ":profile:";

interface LegacyPersistedState {
  connection?: ElasticsearchConnection | null;
  connectionProfiles?: ConnectionProfile[];
  activeProfileId?: string | null;
  dashboard?: DashboardDefinition;
  themeMode?: "light" | "dark";
  discoverQueryDraft?: string | null;
  queryHistory?: string[];
}

function copySessionValue(oldKey: string, nextKey: string) {
  const value = sessionStorage.getItem(oldKey);
  if (value !== null) {
    sessionStorage.setItem(nextKey, value);
    sessionStorage.removeItem(oldKey);
  }
}

export function migrateLegacyDashboardStore() {
  const legacyRaw = localStorage.getItem(LEGACY_STORE_NAME);
  if (!legacyRaw) return;

  if (
    localStorage.getItem(CONNECTION_STORE_NAME) ||
    localStorage.getItem(UI_STORE_NAME) ||
    localStorage.getItem(QUERY_STORE_NAME) ||
    localStorage.getItem(DASHBOARD_STORE_NAME)
  ) {
    return;
  }

  try {
    const parsed = JSON.parse(legacyRaw) as { state?: LegacyPersistedState; version?: number };
    const state = parsed.state;
    if (!state) return;

    localStorage.setItem(
      CONNECTION_STORE_NAME,
      JSON.stringify({
        state: {
          connection: state.connection ?? null,
          connectionProfiles: state.connectionProfiles ?? [],
          activeProfileId: state.activeProfileId ?? null,
        },
        version: parsed.version ?? 0,
      }),
    );
    localStorage.setItem(
      UI_STORE_NAME,
      JSON.stringify({
        state: { themeMode: state.themeMode ?? "dark" },
        version: parsed.version ?? 0,
      }),
    );
    localStorage.setItem(
      QUERY_STORE_NAME,
      JSON.stringify({
        state: {
          discoverQueryDraft: state.discoverQueryDraft ?? null,
          queryHistory: state.queryHistory ?? [],
        },
        version: parsed.version ?? 0,
      }),
    );
    localStorage.setItem(
      DASHBOARD_STORE_NAME,
      JSON.stringify({ state: { dashboard: state.dashboard }, version: parsed.version ?? 0 }),
    );

    copySessionValue(
      LEGACY_STORE_NAME + API_KEY_SESSION_SUFFIX,
      CONNECTION_STORE_NAME + API_KEY_SESSION_SUFFIX,
    );
    copySessionValue(
      LEGACY_STORE_NAME + PASSWORD_SESSION_SUFFIX,
      CONNECTION_STORE_NAME + PASSWORD_SESSION_SUFFIX,
    );

    for (const profile of state.connectionProfiles ?? []) {
      copySessionValue(
        LEGACY_STORE_NAME + PROFILE_SESSION_PREFIX + profile.id + API_KEY_SESSION_SUFFIX,
        CONNECTION_STORE_NAME + PROFILE_SESSION_PREFIX + profile.id + API_KEY_SESSION_SUFFIX,
      );
      copySessionValue(
        LEGACY_STORE_NAME + PROFILE_SESSION_PREFIX + profile.id + PASSWORD_SESSION_SUFFIX,
        CONNECTION_STORE_NAME + PROFILE_SESSION_PREFIX + profile.id + PASSWORD_SESSION_SUFFIX,
      );
    }

    localStorage.removeItem(LEGACY_STORE_NAME);
  } catch {
    // Keep legacy state untouched if migration parsing fails.
  }
}
