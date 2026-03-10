import Fab from "@mui/material/Fab";
import Tooltip from "@mui/material/Tooltip";
import MapIcon from "@mui/icons-material/Map";

import { useEasterEggStore } from "../../store/useEasterEggStore";

export default function GoToMapFab() {
  const setMapOpen = useEasterEggStore((s) => s.setMapOpen);

  return (
    <Tooltip title="Open world map" placement="left">
      <Fab
        size="medium"
        color="primary"
        aria-label="Open world map"
        onClick={() => setMapOpen(true)}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 1200,
        }}
      >
        <MapIcon />
      </Fab>
    </Tooltip>
  );
}
