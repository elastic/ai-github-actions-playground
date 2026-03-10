import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { PAGE_PATHS } from "../../routes/paths";
import { useEasterEggStore } from "../../store/useEasterEggStore";
import { REWARD_BY_ID } from "./content";
import { buildQuestProgress } from "./progress";
import { EASTER_EGG_QUESTS } from "./quests";
import { getMatchedPageId } from "./routeMatching";
import { WORLD_MAP_BY_PAGE } from "./worldMap";

export default function IsometricOverlay() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    visitedPages,
    completedObjectiveIds,
    rewardMomentsSeen,
    completeObjective,
    acknowledgeRewardMoment,
  } = useEasterEggStore((state) => ({
    visitedPages: state.visitedPages,
    completedObjectiveIds: state.completedObjectiveIds,
    rewardMomentsSeen: state.rewardMomentsSeen,
    completeObjective: state.completeObjective,
    acknowledgeRewardMoment: state.acknowledgeRewardMoment,
  }));

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
    if (rewardIds.length === 0) return undefined;
    const rewardId = rewardIds[0];
    if (!rewardId) return undefined;
    return REWARD_BY_ID.get(rewardId);
  }, [questProgress, rewardMomentsSeen]);

  return (
    <Box
      aria-label="Isometric quest overlay"
      sx={{
        pointerEvents: "none",
        position: "fixed",
        top: 72,
        right: { md: 16, xs: 8 },
        zIndex: 1200,
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
            <Chip
              size="small"
              icon={<MapOutlinedIcon />}
              label={`${questProgress.filter((q) => q.complete).length}/${questProgress.length} quests`}
            />
          </Box>

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
              sx={{ p: 1, borderColor: "success.main", bgcolor: "success.50" }}
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
                              <Button size="small" onClick={() => navigate(objectivePagePath)}>
                                Go
                              </Button>
                            )}
                          {!done && unlocked && canConfirmHere && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => completeObjective(objective.id)}
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
        </Stack>
      </Paper>
    </Box>
  );
}
