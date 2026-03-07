import { useState, useCallback } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import TuneIcon from "@mui/icons-material/Tune";
import { useShallow } from "zustand/react/shallow";

import { useDashboardEditorStore } from "../store/useDashboardEditorStore";
import { useConnectionStore } from "../store/useConnectionStore";
import type { DashboardParameter } from "../types";

import { EMPTY_PARAMETERS } from "./parameter-bar/parameterUtils";
import ParameterControl from "./parameter-bar/ParameterControl";
import ParameterDialog from "./parameter-bar/ParameterDialog";

export default function ParameterBar() {
  const { parameters, setParameterValue, addParameter, updateParameter, removeParameter } =
    useDashboardEditorStore(
      useShallow((s) => ({
        parameters: s.dashboard.parameters ?? EMPTY_PARAMETERS,
        setParameterValue: s.setParameterValue,
        addParameter: s.addParameter,
        updateParameter: s.updateParameter,
        removeParameter: s.removeParameter,
      })),
    );
  const connection = useConnectionStore((s) => s.connection);
  const activeProfileId = useConnectionStore((s) => s.activeProfileId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DashboardParameter | null>(null);

  const openAdd = useCallback(() => {
    setEditing(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((param: DashboardParameter) => {
    setEditing(param);
    setDialogOpen(true);
  }, []);

  const handleDialogSave = useCallback(
    (param: DashboardParameter, previousName: string | null) => {
      if (previousName !== null && previousName !== param.name) {
        removeParameter(previousName);
        addParameter(param);
      } else if (previousName !== null) {
        updateParameter(param.name, param);
      } else {
        addParameter(param);
      }
    },
    [addParameter, updateParameter, removeParameter],
  );

  if (parameters.length === 0 && !dialogOpen) {
    return (
      <Box
        sx={{
          display: "flex",
          gap: 1,
          alignItems: "center",
          py: 0.5,
          px: 2,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <TuneIcon sx={{ color: "text.secondary", fontSize: 16 }} />
        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
          Variables
        </Typography>
        <Tooltip title="Add variable">
          <IconButton size="small" onClick={openAdd} aria-label="Add variable">
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          alignItems: "center",
          py: 0.5,
          px: 2,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <TuneIcon sx={{ color: "text.secondary", fontSize: 16 }} />
        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
          Variables
        </Typography>

        {parameters.map((param) => (
          <ParameterControl
            key={`${param.name}:${param.type}:${String(param.value)}`}
            param={param}
            activeProfileId={activeProfileId}
            connection={connection}
            parameters={parameters}
            onChange={(val) => setParameterValue(param.name, val)}
            onEdit={() => openEdit(param)}
            onDelete={() => removeParameter(param.name)}
          />
        ))}

        <Tooltip title="Add variable">
          <IconButton size="small" onClick={openAdd} aria-label="Add variable">
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <ParameterDialog
        open={dialogOpen}
        editing={editing}
        activeProfileId={activeProfileId}
        connection={connection}
        parameters={parameters}
        onClose={() => setDialogOpen(false)}
        onSave={handleDialogSave}
      />
    </>
  );
}
