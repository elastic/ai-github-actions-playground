import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DashboardIcon from "@mui/icons-material/Dashboard";
import { useShallow } from "zustand/react/shallow";

import { useDashboardFromUrl } from "../hooks/useDashboardFromUrl";
import { useDashboardCatalogStore } from "../store/useDashboardCatalogStore";

import DashboardGrid from "./DashboardGrid";
import EmptyState from "./EmptyState";

export default function DashboardViewPage() {
  const { found } = useDashboardFromUrl();
  const navigate = useNavigate();
  const createDashboard = useDashboardCatalogStore(useShallow((s) => s.createDashboard));

  const handleCreate = useCallback(() => {
    const id = createDashboard();
    navigate(`/dashboards/${id}`);
  }, [createDashboard, navigate]);

  if (!found)
    return (
      <EmptyState
        icon={<DashboardIcon sx={{ fontSize: 32 }} />}
        heading="Dashboard not found"
        description="The dashboard you requested does not exist or may have been deleted."
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/dashboards")}
            >
              Back to dashboards
            </Button>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleCreate}>
              Create dashboard
            </Button>
          </Stack>
        }
      />
    );

  return <DashboardGrid />;
}
