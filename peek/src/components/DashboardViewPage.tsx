import { Navigate } from "react-router-dom";

import { useDashboardFromUrl } from "../hooks/useDashboardFromUrl";

import DashboardGrid from "./DashboardGrid";

export default function DashboardViewPage() {
  const { found } = useDashboardFromUrl();
  if (!found) return <Navigate to="/dashboards" replace />;
  return <DashboardGrid />;
}
