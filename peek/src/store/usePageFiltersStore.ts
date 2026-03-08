/**
 * Backward-compatibility barrel.
 *
 * The monolithic store has been decomposed into domain-scoped stores:
 *
 *   - useFleetFiltersStore
 *   - useProfilingFiltersStore
 *   - useServiceFiltersStore
 *   - useKubernetesFiltersStore
 *   - useHostsFiltersStore
 *
 * Import directly from the domain store that owns the state you need.
 * This barrel re-exports only the **types** that were previously defined here
 * so that existing type-only imports keep working.
 *
 * @deprecated Import from the domain-specific store files instead.
 */

export type { ProfilingViewMode } from "./useProfilingFiltersStore";
export type { FleetViewTab, AgentFilter } from "./useFleetFiltersStore";
