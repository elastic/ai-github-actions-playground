import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LockIcon from "@mui/icons-material/Lock";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { alpha } from "@mui/material/styles";

import { WORLD_MAP_BY_PAGE } from "./worldMap";
import { isObjectiveComplete } from "./progress";
import { REWARD_BY_ID } from "./content";
import type { QuestObjective } from "./types";
import type { QuestProgress, QuestProgressInput } from "./progress";

function ObjectiveRow({
  objective,
  done,
  locationName,
}: {
  objective: QuestObjective;
  done: boolean;
  locationName?: string;
}) {
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", mb: 1 }}>
      {done ? (
        <CheckCircleIcon
          sx={{ fontSize: "1rem", color: "success.light", mt: "2px", flexShrink: 0 }}
        />
      ) : (
        <RadioButtonUncheckedIcon
          sx={{ fontSize: "1rem", color: "grey.500", mt: "2px", flexShrink: 0 }}
        />
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            fontWeight: 600,
            color: done ? "grey.500" : "common.white",
            textDecoration: done ? "line-through" : "none",
          }}
        >
          {objective.title}
          {locationName && !done && (
            <Typography component="span" variant="caption" sx={{ color: "warning.light", ml: 0.5 }}>
              ({locationName})
            </Typography>
          )}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: done ? "grey.600" : "grey.400", lineHeight: 1.3, display: "block" }}
        >
          {objective.description}
        </Typography>
      </Box>
    </Box>
  );
}

export default function QuestJournal({
  progress,
  state,
}: {
  progress: QuestProgress[];
  state: QuestProgressInput;
}) {
  const active = progress.find((p) => p.unlocked && !p.complete);
  const allComplete = progress.every((p) => p.complete);

  return (
    <Box
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        bottom: 0,
        width: { xs: "100%", sm: 320 },
        bgcolor: (t) => alpha(t.palette.common.black, 0.88),
        borderRight: "1px solid",
        borderColor: (t) => alpha(t.palette.primary.main, 0.3),
        overflowY: "auto",
        zIndex: 30,
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Typography variant="h6" sx={{ color: "common.white", fontWeight: 700, fontSize: "1rem" }}>
        {"\u{1F4DC}"} Quest Journal
      </Typography>

      {allComplete && (
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: (t) => alpha(t.palette.success.main, 0.15),
            border: "1px solid",
            borderColor: "success.dark",
            textAlign: "center",
          }}
        >
          <Typography sx={{ fontSize: "2rem", mb: 1 }}>{"\u{1F3C6}"}</Typography>
          <Typography variant="body2" sx={{ color: "success.light", fontWeight: 700 }}>
            All quests complete!
          </Typography>
          <Typography variant="caption" sx={{ color: "grey.400" }}>
            You've explored every corner of the observability toolkit. Well done, adventurer!
          </Typography>
        </Box>
      )}

      {progress.map((qp) => {
        const isActive = qp === active;
        const isLocked = !qp.unlocked && !qp.complete;

        return (
          <Box
            key={qp.quest.id}
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: (t) =>
                isActive
                  ? alpha(t.palette.primary.main, 0.12)
                  : alpha(t.palette.common.white, 0.04),
              border: "1px solid",
              borderColor: (t) =>
                isActive
                  ? alpha(t.palette.primary.main, 0.4)
                  : qp.complete
                    ? alpha(t.palette.success.main, 0.3)
                    : "transparent",
              opacity: isLocked ? 0.5 : 1,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              {qp.complete ? (
                <CheckCircleIcon sx={{ fontSize: "1.1rem", color: "success.light" }} />
              ) : isLocked ? (
                <LockIcon sx={{ fontSize: "1.1rem", color: "grey.600" }} />
              ) : (
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    border: "2px solid",
                    borderColor: isActive ? "primary.light" : "grey.600",
                    flexShrink: 0,
                  }}
                />
              )}
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: isLocked ? "grey.600" : "common.white" }}
              >
                {qp.quest.title}
              </Typography>
              {isActive && (
                <Typography
                  variant="caption"
                  sx={{
                    ml: "auto",
                    px: 1,
                    py: "1px",
                    borderRadius: 1,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Active
                </Typography>
              )}
            </Box>

            <Typography
              variant="caption"
              sx={{
                color: isLocked ? "grey.700" : "grey.400",
                display: "block",
                mb: 1,
                lineHeight: 1.4,
              }}
            >
              {isLocked ? "Complete the previous quest to unlock." : qp.quest.description}
            </Typography>

            {!isLocked && (
              <>
                <LinearProgress
                  variant="determinate"
                  value={qp.totalCount > 0 ? (qp.completedCount / qp.totalCount) * 100 : 0}
                  sx={{
                    mb: 1,
                    height: 4,
                    borderRadius: 2,
                    bgcolor: (t) => alpha(t.palette.common.white, 0.1),
                    "& .MuiLinearProgress-bar": {
                      bgcolor: qp.complete ? "success.main" : "primary.main",
                    },
                  }}
                />
                {isActive &&
                  qp.quest.objectives.map((obj) => {
                    const objDone = isObjectiveComplete(obj, state);
                    const loc = obj.page ? WORLD_MAP_BY_PAGE.get(obj.page) : undefined;
                    return (
                      <ObjectiveRow
                        key={obj.id}
                        objective={obj}
                        done={objDone}
                        locationName={loc?.name}
                      />
                    );
                  })}
                {qp.complete && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                    {(() => {
                      const reward = REWARD_BY_ID.get(qp.quest.rewardId);
                      if (!reward) return null;
                      return (
                        <Typography variant="caption" sx={{ color: "warning.light" }}>
                          {reward.emoji} {reward.title}
                        </Typography>
                      );
                    })()}
                  </Box>
                )}
              </>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
