import { useShallow } from "zustand/react/shallow";

import { PAGE_MANIFEST } from "../routes/manifest";
import { useDashboardCatalogStore } from "../store/useDashboardCatalogStore";
import { useQueryStore } from "../store/useQueryStore";
import { useTracesStore } from "../store/useTracesStore";

export function useChatScreenContextSummary(pathname: string): string {
  const discoverQueryDraft = useQueryStore((s) => s.discoverQueryDraft);
  const selectedTraceId = useTracesStore((s) => s.selectedTraceId);
  const { dashboards, activeDashboardId } = useDashboardCatalogStore(
    useShallow((s) => ({
      dashboards: s.dashboards,
      activeDashboardId: s.activeDashboardId,
    })),
  );

  const pageLabel =
    Object.values(PAGE_MANIFEST).find((page) => page.path === pathname)?.nav.label ?? pathname;
  const activeDashboard = dashboards.find((dashboard) => dashboard.id === activeDashboardId);

  const lines = [
    `Current page: ${pageLabel} (${pathname})`,
    activeDashboard ? `Active dashboard: ${activeDashboard.title}` : null,
    discoverQueryDraft ? `Query Lab draft: ${discoverQueryDraft}` : null,
    selectedTraceId ? `Selected trace ID: ${selectedTraceId}` : null,
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}
