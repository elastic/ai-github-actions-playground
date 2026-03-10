import { useMemo } from "react";
import Badge from "@mui/material/Badge";
import Fab from "@mui/material/Fab";
import Tooltip from "@mui/material/Tooltip";
import MapIcon from "@mui/icons-material/Map";
import { useShallow } from "zustand/react/shallow";

import { useEasterEggStore } from "../../store/useEasterEggStore";
import { EASTER_EGG_QUESTS } from "./quests";
import { buildQuestProgress } from "./progress";

export default function GoToMapFab() {
  const { setMapOpen, visitedPages, completedObjectiveIds } = useEasterEggStore(
    useShallow((s) => ({
      setMapOpen: s.setMapOpen,
      visitedPages: s.visitedPages,
      completedObjectiveIds: s.completedObjectiveIds,
    })),
  );

  const progress = useMemo(
    () => buildQuestProgress(EASTER_EGG_QUESTS, { visitedPages, completedObjectiveIds }),
    [visitedPages, completedObjectiveIds],
  );

  const completed = progress.filter((p) => p.complete).length;
  const total = progress.length;
  const allDone = completed === total;

  return (
    <Tooltip title={allDone ? "Open world map" : `Quests: ${completed}/${total}`} placement="left">
      <Badge
        badgeContent={allDone ? "\u2713" : `${completed}/${total}`}
        color={allDone ? "success" : "warning"}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 1200,
          "& .MuiBadge-badge": { fontWeight: 700, fontSize: "0.7rem" },
        }}
      >
        <Fab
          size="medium"
          color="primary"
          aria-label="Open world map"
          onClick={() => setMapOpen(true)}
        >
          <MapIcon />
        </Fab>
      </Badge>
    </Tooltip>
  );
}
