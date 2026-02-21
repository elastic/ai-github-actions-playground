import { useCallback, useMemo } from "react";
import { Responsive, WidthProvider, type Layout } from "react-grid-layout";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useDashboardStore } from "../store/useDashboardStore";
import PanelContainer from "./PanelContainer";

const ResponsiveGrid = WidthProvider(Responsive);

export default function DashboardGrid() {
  const panels = useDashboardStore((s) => s.dashboard.panels);
  const updatePanelLayouts = useDashboardStore((s) => s.updatePanelLayouts);
  const addPanel = useDashboardStore((s) => s.addPanel);
  const setEditingPanelId = useDashboardStore((s) => s.setEditingPanelId);

  const layouts = useMemo<{ lg: Layout[] }>(
    () => ({
      lg: panels.map((p) => ({
        i: p.id,
        x: p.layout.x,
        y: p.layout.y,
        w: p.layout.w,
        h: p.layout.h,
        minW: 2,
        minH: 2,
      })),
    }),
    [panels],
  );

  const handleLayoutChange = useCallback(
    (layout: Layout[]) => {
      const updates = layout.map((l) => ({
        id: l.i,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
      }));
      updatePanelLayouts(updates);
    },
    [updatePanelLayouts],
  );

  const handleAddPanel = useCallback(() => {
    const newPanel = {
      id: crypto.randomUUID(),
      title: "New Panel",
      query: "FROM logs-* | STATS count = COUNT(*) BY @timestamp | SORT @timestamp | LIMIT 50",
      visualization: "timeseries" as const,
      layout: { x: 0, y: Infinity, w: 6, h: 4 },
    };
    addPanel(newPanel);
    setEditingPanelId(newPanel.id);
  }, [addPanel, setEditingPanelId]);

  if (panels.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
          gap: 2,
        }}
      >
        <Typography variant="h6" color="text.secondary">
          No panels yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Add a panel to start visualizing your Elasticsearch data with ES|QL
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddPanel}>
          Add Panel
        </Button>
      </Box>
    );
  }

  return (
    <ResponsiveGrid
      className="dashboard-grid"
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={80}
      onLayoutChange={handleLayoutChange}
      draggableHandle=".panel-drag-handle"
      containerPadding={[0, 0]}
      margin={[12, 12]}
    >
      {panels.map((panel) => (
        <div key={panel.id}>
          <PanelContainer panel={panel} />
        </div>
      ))}
    </ResponsiveGrid>
  );
}
