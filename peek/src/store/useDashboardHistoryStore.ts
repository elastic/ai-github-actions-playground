import { useDashboardStore } from "./useDashboardStore";

type DashboardStoreState = ReturnType<typeof useDashboardStore.getState>;
type DashboardHistoryStoreState = Pick<
  DashboardStoreState,
  "historyPast" | "historyFuture" | "undoDashboardChange" | "redoDashboardChange"
> & {
  canUndo: boolean;
  canRedo: boolean;
};

export function useDashboardHistoryStore<T>(selector: (state: DashboardHistoryStoreState) => T): T {
  return useDashboardStore((state) =>
    selector({
      historyPast: state.historyPast,
      historyFuture: state.historyFuture,
      undoDashboardChange: state.undoDashboardChange,
      redoDashboardChange: state.redoDashboardChange,
      canUndo: state.historyPast.length > 0,
      canRedo: state.historyFuture.length > 0,
    }),
  );
}
