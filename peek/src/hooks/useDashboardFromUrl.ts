import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import { useDashboardStore } from "../store/useDashboardStore";

export function useDashboardFromUrl() {
  const { id } = useParams<{ id: string }>();
  const { dashboards, activeDashboardId, setActiveDashboard } = useDashboardStore(
    useShallow((s) => ({
      dashboards: s.dashboards,
      activeDashboardId: s.activeDashboardId,
      setActiveDashboard: s.setActiveDashboard,
    })),
  );

  const found = id ? dashboards.some((d) => d.id === id) : false;

  useEffect(() => {
    if (id && found && id !== activeDashboardId) {
      setActiveDashboard(id);
    }
  }, [id, found, activeDashboardId, setActiveDashboard]);

  return { dashboardId: id, found };
}
