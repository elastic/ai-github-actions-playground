import { useDashboardStore } from "./useDashboardStore";

type DashboardStoreState = ReturnType<typeof useDashboardStore.getState>;
type DashboardCatalogStoreState = Pick<
  DashboardStoreState,
  | "dashboard"
  | "dashboards"
  | "activeDashboardId"
  | "setActiveDashboard"
  | "createDashboard"
  | "renameDashboard"
  | "duplicateDashboard"
  | "archiveDashboard"
  | "toggleFavoriteDashboard"
  | "deleteDashboard"
  | "restoreDashboard"
  | "exportDashboard"
  | "exportWorkspace"
  | "importDashboard"
  | "importWorkspace"
>;

export function useDashboardCatalogStore<T>(selector: (state: DashboardCatalogStoreState) => T): T {
  return useDashboardStore((state) => selector(state));
}
