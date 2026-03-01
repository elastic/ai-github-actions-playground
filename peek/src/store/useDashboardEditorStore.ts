import { useDashboardStore } from "./useDashboardStore";

type DashboardStoreState = ReturnType<typeof useDashboardStore.getState>;
type DashboardEditorStoreState = Pick<
  DashboardStoreState,
  | "dashboard"
  | "setTimeRange"
  | "setRefreshInterval"
  | "setTimeZone"
  | "setDashboardTitle"
  | "addPanel"
  | "updatePanel"
  | "removePanel"
  | "duplicatePanel"
  | "updatePanelLayouts"
  | "addParameter"
  | "updateParameter"
  | "removeParameter"
  | "setParameterValue"
  | "loadDefaultDashboard"
>;

export function useDashboardEditorStore<T>(selector: (state: DashboardEditorStoreState) => T): T {
  return useDashboardStore((state) => selector(state));
}
