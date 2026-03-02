import { useCallback, useMemo } from "react";
import {
  Responsive,
  useContainerWidth,
  type Layout,
  type ResponsiveLayouts as Layouts,
} from "react-grid-layout";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import DashboardIcon from "@mui/icons-material/Dashboard";
import { useShallow } from "zustand/react/shallow";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useDashboardEditorStore } from "../store/useDashboardEditorStore";
import { useUIStore } from "../store/useUIStore";
import { createDefaultPanel } from "../dashboards/panel";

import PanelContainer from "./PanelContainer";
import EmptyState from "./EmptyState";
import {
  fromReactGridLayoutItems,
  toPersesPanelLayouts,
  toReactGridLayouts,
} from "./perses/layoutAdapter";

interface DashboardGridProps {
  staticMode?: boolean;
}

export default function DashboardGrid({ staticMode = true }: DashboardGridProps) {
  const { width, containerRef, mounted } = useContainerWidth();
  const { panels, updatePanelLayouts, addPanel, loadDefaultDashboard } = useDashboardEditorStore(
    useShallow((s) => ({
      panels: s.dashboard.panels,
      updatePanelLayouts: s.updatePanelLayouts,
      addPanel: s.addPanel,
      loadDefaultDashboard: s.loadDefaultDashboard,
    })),
  );
  const setEditingPanelId = useUIStore((s) => s.setEditingPanelId);

  const layouts = useMemo<Layouts>(
    () => toReactGridLayouts(toPersesPanelLayouts(panels)),
    [panels],
  );

  const handleLayoutChange = useCallback(
    (layout: Layout) => {
      const updates = fromReactGridLayoutItems(layout);
      updatePanelLayouts(updates);
    },
    [updatePanelLayouts],
  );

  const handleAddPanel = useCallback(() => {
    const newPanel = createDefaultPanel();
    addPanel(newPanel);
    setEditingPanelId(newPanel.id);
  }, [addPanel, setEditingPanelId]);

  if (panels.length === 0) {
    return (
      <EmptyState
        icon={<DashboardIcon sx={{ fontSize: 40 }} />}
        heading="No panels yet"
        description="Load the default dashboard to get started, or add a panel to build your own."
        action={
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<DashboardIcon />}
              onClick={loadDefaultDashboard}
            >
              Load Default Dashboard
            </Button>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddPanel}>
              Add Panel
            </Button>
          </Box>
        }
      />
    );
  }

  return (
    <Box ref={containerRef}>
      {mounted && (
        <Responsive
          className="dashboard-grid"
          width={width}
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={80}
          dragConfig={{ enabled: !staticMode }}
          resizeConfig={{ enabled: !staticMode }}
          onDragStop={staticMode ? undefined : handleLayoutChange}
          onResizeStop={staticMode ? undefined : handleLayoutChange}
          containerPadding={[0, 0]}
          margin={[12, 12]}
        >
          {panels.map((panel) => (
            <div key={panel.id}>
              <PanelContainer panel={panel} />
            </div>
          ))}
        </Responsive>
      )}
    </Box>
  );
}
