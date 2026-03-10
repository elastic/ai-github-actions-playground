import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import { alpha } from "@mui/material/styles";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import { PAGE_PATHS } from "../../routes/paths";
import { useEasterEggStore } from "../../store/useEasterEggStore";
import { REWARD_BY_ID } from "./content";
import { buildQuestProgress } from "./progress";
import { EASTER_EGG_QUESTS } from "./quests";
import { getMatchedPageId } from "./routeMatching";
import { WORLD_MAP_BY_PAGE } from "./worldMap";

export default function IsometricOverlay() {
  const overlayBodyId = "isometric-quest-overlay-body";
  const location = useLocation();
  const navigate = useNavigate();
  const { visitedPages, completedObjectiveIds, rewardMomentsSeen } = useEasterEggStore(
    useShallow((state) => ({
      visitedPages: state.visitedPages,
      completedObjectiveIds: state.completedObjectiveIds,
      rewardMomentsSeen: state.rewardMomentsSeen,
    })),
  );
  const completeObjective = useEasterEggStore((state) => state.completeObjective);
  const acknowledgeRewardMoment = useEasterEggStore((state) => state.acknowledgeRewardMoment);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const currentPage = getMatchedPageId(location.pathname);
  const currentLocation = currentPage ? WORLD_MAP_BY_PAGE.get(currentPage) : undefined;

  const questProgress = useMemo(
    () => buildQuestProgress(EASTER_EGG_QUESTS, { visitedPages, completedObjectiveIds }),
    [visitedPages, completedObjectiveIds],
  );

  const pendingReward = useMemo(() => {
    const rewardIds = questProgress
      .filter((progress) => progress.complete)
      .map((progress) => progress.quest.rewardId)
      .filter((rewardId) => !rewardMomentsSeen.includes(rewardId));
    return rewardIds[0] ? REWARD_BY_ID.get(rewardIds[0]) : undefined;
  }, [questProgress, rewardMomentsSeen]);

  return (
    <Box
      aria-label="Isometric quest overlay"
      sx={{
        pointerEvents: "none",
        position: "fixed",
        top: { md: 72, xs: "auto" },
        bottom: { md: "auto", xs: 16 },
        right: { md: 16, xs: 8 },
        zIndex: { md: 1200, xs: 1100 },
        width: { md: 360, xs: 320 },
        maxWidth: "calc(100vw - 16px)",
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          pointerEvents: "auto",
          p: 1.5,
          borderColor: "primary.main",
          backdropFilter: "blur(6px)",
          backgroundColor: "background.paper",
        }}
      >
        <Stack spacing={1.25}>
          <Box
            sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Isometric Expedition
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <Chip
                size="small"
                icon={<MapOutlinedIcon />}
                label={`${questProgress.filter((q) => q.complete).length}/${questProgress.length} quests`}
              />
              <IconButton
                size="small"
                onClick={() => setIsCollapsed((value) => !value)}
                aria-label={isCollapsed ? "Expand quest overlay" : "Collapse quest overlay"}
                aria-expanded={!isCollapsed}
                aria-controls={overlayBodyId}
              >
                {isCollapsed ? (
                  <ExpandMoreIcon fontSize="small" />
                ) : (
                  <ExpandLessIcon fontSize="small" />
                )}
              </IconButton>
            </Stack>
          </Box>

          {!isCollapsed && (
            <Box id={overlayBodyId}>
              {currentLocation && (
                <Paper variant="outlined" sx={{ p: 1, borderColor: "divider" }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ textTransform: "uppercase" }}
                  >
                    Current location
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {currentLocation.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {currentLocation.description}
                  </Typography>
                </Paper>
              )}

              {pendingReward && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1,
                    borderColor: "success.main",
                    bgcolor: (t) => alpha(t.palette.success.main, 0.08),
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {pendingReward.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {pendingReward.copy}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => acknowledgeRewardMoment(pendingReward.id)}
                    >
                      Acknowledge reward
                    </Button>
                  </Box>
                </Paper>
              )}

              <Divider />

              <Stack spacing={1}>
                {questProgress.map((progress) => {
                  const { quest, unlocked, complete, completedCount, totalCount } = progress;
                  return (
                    <Paper
                      key={quest.id}
                      variant="outlined"
                      sx={{ p: 1, opacity: unlocked ? 1 : 0.75 }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {quest.title}
                        </Typography>
                        {complete ? (
                          <TaskAltIcon fontSize="small" color="success" />
                        ) : unlocked ? (
                          <RadioButtonUncheckedIcon fontSize="small" color="action" />
                        ) : (
                          <LockOutlinedIcon fontSize="small" color="disabled" />
                        )}
                      </Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 0.5, mb: 1 }}
                      >
                        {quest.description}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={totalCount === 0 ? 0 : (completedCount / totalCount) * 100}
                        sx={{ height: 6, borderRadius: 999, mb: 1 }}
                      />
                      <Stack spacing={0.75}>
                        {quest.objectives.map((objective) => {
                          const done = progress.completedObjectiveIds.includes(objective.id);
                          const objectivePagePath = objective.page
                            ? PAGE_PATHS[objective.page].path
                            : undefined;
                          const canConfirmHere =
                            !done &&
                            objective.kind === "confirmAction" &&
                            objective.page !== undefined &&
                            currentPage === objective.page;

                          return (
                            <Box
                              key={objective.id}
                              sx={{ display: "flex", alignItems: "center", gap: 1 }}
                            >
                              {done ? (
                                <CheckCircleOutlineIcon fontSize="small" color="success" />
                              ) : (
                                <RadioButtonUncheckedIcon fontSize="small" color="disabled" />
                              )}
                              <Typography
                                variant="caption"
                                sx={{ flex: 1 }}
                                color={done ? "text.primary" : "text.secondary"}
                              >
                                {objective.title}
                              </Typography>
                              {!done &&
                                unlocked &&
                                objectivePagePath &&
                                objective.kind === "visitPage" && (
                                  <Button
                                    size="small"
                                    onClick={() => navigate(objectivePagePath)}
                                    aria-label={`Go to ${objective.title}`}
                                  >
                                    Go
                                  </Button>
                                )}
                              {!done && unlocked && canConfirmHere && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => completeObjective(objective.id)}
                                  aria-label={`Complete objective: ${objective.title}`}
                                >
                                  Complete
                                </Button>
                              )}
                            </Box>
                          );
                        })}
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            </Box>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
