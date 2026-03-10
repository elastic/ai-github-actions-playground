import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Fade from "@mui/material/Fade";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import LockIcon from "@mui/icons-material/Lock";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { alpha } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import { useEasterEggStore } from "../../store/useEasterEggStore";
import { PAGE_PATHS } from "../../routes/paths";
import { WORLD_MAP, WORLD_MAP_BY_PAGE } from "./worldMap";
import { EASTER_EGG_QUESTS } from "./quests";
import { buildQuestProgress, isObjectiveComplete } from "./progress";
import { REWARD_BY_ID } from "./content";
import type { WorldLocation, QuestObjective } from "./types";
import type { QuestProgress, QuestProgressInput } from "./progress";

/** Duration (ms) of the character walk animation. */
const WALK_DURATION = 800;

/** Decorative trees scattered across the map. */
const TREES = [
  { id: "t1", x: 10, y: 40, e: "\u{1F333}" },
  { id: "t2", x: 40, y: 30, e: "\u{1F332}" },
  { id: "t3", x: 65, y: 60, e: "\u{1F333}" },
  { id: "t4", x: 90, y: 15, e: "\u{1F332}" },
  { id: "t5", x: 35, y: 85, e: "\u{1F333}" },
  { id: "t6", x: 55, y: 5, e: "\u{1F332}" },
  { id: "t7", x: 8, y: 75, e: "\u{1F333}" },
  { id: "t8", x: 92, y: 70, e: "\u{1F332}" },
  { id: "t9", x: 45, y: 60, e: "\u{1F33F}" },
  { id: "t10", x: 12, y: 55, e: "\u{1F33F}" },
];

function getActiveQuestObjectivePages(progress: QuestProgress[]): Set<string> {
  const pages = new Set<string>();
  const active = progress.find((p) => p.unlocked && !p.complete);
  if (!active) return pages;
  for (const obj of active.quest.objectives) {
    if (obj.page) pages.add(obj.page);
  }
  return pages;
}

function MapBuilding({
  location,
  visited,
  isQuestTarget,
  onClick,
}: {
  location: WorldLocation;
  visited: boolean;
  isQuestTarget: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip
      title={
        <>
          <Typography variant="subtitle1">{location.name}</Typography>
          <Typography variant="caption">{location.description}</Typography>
          {isQuestTarget && !visited && (
            <Typography
              variant="caption"
              sx={{ display: "block", mt: 0.5, color: "warning.light" }}
            >
              Quest objective — visit this location!
            </Typography>
          )}
        </>
      }
      placement="top"
      arrow
    >
      <ButtonBase
        onClick={onClick}
        aria-label={`Travel to ${location.name}`}
        sx={{
          position: "absolute",
          left: `${location.mapX}%`,
          top: `${location.mapY}%`,
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          cursor: "pointer",
          transition: "transform 0.15s ease",
          "&:hover": { transform: "translate(-50%, -50%) scale(1.15)" },
          zIndex: 10,
          filter: visited ? "none" : "grayscale(0.5)",
          opacity: visited ? 1 : 0.7,
          ...(isQuestTarget &&
            !visited && {
              filter: "none",
              opacity: 1,
              animation: "questPulse 2s ease-in-out infinite",
              "@keyframes questPulse": {
                "0%, 100%": { transform: "translate(-50%, -50%) scale(1)" },
                "50%": { transform: "translate(-50%, -50%) scale(1.1)" },
              },
            }),
        }}
      >
        <Box
          sx={{
            fontSize: { xs: "1.8rem", sm: "2.2rem", md: "2.5rem" },
            lineHeight: 1,
          }}
        >
          {location.emoji}
        </Box>
        <Typography
          variant="caption"
          sx={{
            mt: 0.5,
            px: 1,
            borderRadius: 1,
            bgcolor: (t) =>
              isQuestTarget && !visited
                ? alpha(t.palette.warning.main, 0.85)
                : alpha(t.palette.common.black, 0.6),
            color: isQuestTarget && !visited ? "common.black" : "common.white",
            fontSize: "0.65rem",
            fontWeight: 600,
            whiteSpace: "nowrap",
            letterSpacing: "0.02em",
          }}
        >
          {location.name}
        </Typography>
        {visited && (
          <Box
            sx={{
              position: "absolute",
              top: -4,
              right: -4,
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: "success.main",
              border: "1.5px solid",
              borderColor: "common.white",
            }}
          />
        )}
      </ButtonBase>
    </Tooltip>
  );
}

function MapCharacter({ x, y, walking }: { x: number; y: number; walking: boolean }) {
  return (
    <Box
      sx={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -80%)",
        fontSize: { xs: "1.6rem", sm: "2rem" },
        lineHeight: 1,
        zIndex: 20,
        transition: walking
          ? `left ${WALK_DURATION}ms ease-in-out, top ${WALK_DURATION}ms ease-in-out`
          : "none",
        animation: walking ? "none" : "characterBounce 1.5s ease-in-out infinite",
        "@keyframes characterBounce": {
          "0%, 100%": { transform: "translate(-50%, -80%)" },
          "50%": { transform: "translate(-50%, -85%)" },
        },
        filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.4))",
        pointerEvents: "none",
      }}
    >
      {"\u{1F9D9}"}
    </Box>
  );
}

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

function QuestJournal({
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

function RewardCelebration({
  title,
  emoji,
  copy,
  onDismiss,
}: {
  title: string;
  emoji: string;
  copy: string;
  onDismiss: () => void;
}) {
  return (
    <Fade in timeout={400}>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "rgba(0,0,0,0.7)",
        }}
      >
        <Box
          sx={{
            textAlign: "center",
            p: 4,
            borderRadius: 3,
            bgcolor: (t) => alpha(t.palette.common.black, 0.9),
            border: "2px solid",
            borderColor: "warning.main",
            maxWidth: 400,
            animation: "rewardPop 0.5s ease-out",
            "@keyframes rewardPop": {
              "0%": { transform: "scale(0.5)", opacity: 0 },
              "70%": { transform: "scale(1.05)" },
              "100%": { transform: "scale(1)", opacity: 1 },
            },
          }}
        >
          <Typography sx={{ fontSize: "3rem", mb: 1 }}>{emoji}</Typography>
          <Typography variant="h6" sx={{ color: "warning.light", fontWeight: 700, mb: 1 }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: "grey.300", mb: 2 }}>
            {copy}
          </Typography>
          <ButtonBase
            onClick={onDismiss}
            sx={{
              px: 3,
              py: 1,
              borderRadius: 2,
              bgcolor: "warning.main",
              color: "common.black",
              fontWeight: 700,
              fontSize: "0.85rem",
              "&:hover": { bgcolor: "warning.dark" },
            }}
          >
            Continue
          </ButtonBase>
        </Box>
      </Box>
    </Fade>
  );
}

export default function IsometricMap() {
  const navigate = useNavigate();
  const {
    mapOpen,
    characterPosition,
    visitedPages,
    completedObjectiveIds,
    rewardMomentsSeen,
    setMapOpen,
    setCharacterPosition,
    acknowledgeRewardMoment,
  } = useEasterEggStore(
    useShallow((s) => ({
      mapOpen: s.mapOpen,
      characterPosition: s.characterPosition,
      visitedPages: s.visitedPages,
      completedObjectiveIds: s.completedObjectiveIds,
      rewardMomentsSeen: s.rewardMomentsSeen,
      setMapOpen: s.setMapOpen,
      setCharacterPosition: s.setCharacterPosition,
      acknowledgeRewardMoment: s.acknowledgeRewardMoment,
    })),
  );

  const [walking, setWalking] = useState(false);

  const progressInput: QuestProgressInput = useMemo(
    () => ({ visitedPages, completedObjectiveIds }),
    [visitedPages, completedObjectiveIds],
  );

  const progress = useMemo(
    () => buildQuestProgress(EASTER_EGG_QUESTS, progressInput),
    [progressInput],
  );

  const questTargetPages = useMemo(() => getActiveQuestObjectivePages(progress), [progress]);

  // Detect newly completed quests and show reward
  const [pendingReward, setPendingReward] = useState<{
    title: string;
    emoji: string;
    copy: string;
    rewardId: string;
  } | null>(null);

  const prevProgressRef = useRef(progress);
  useEffect(() => {
    const prev = prevProgressRef.current;
    prevProgressRef.current = progress;

    for (let i = 0; i < progress.length; i++) {
      const cur = progress[i]!;
      const old = prev[i];
      if (cur.complete && old && !old.complete && !rewardMomentsSeen.includes(cur.quest.rewardId)) {
        const reward = REWARD_BY_ID.get(cur.quest.rewardId);
        if (reward) {
          setPendingReward({
            title: reward.title,
            emoji: reward.emoji,
            copy: reward.copy,
            rewardId: cur.quest.rewardId,
          });
          break;
        }
      }
    }
  }, [progress, rewardMomentsSeen]);

  const handleLocationClick = useCallback(
    (location: WorldLocation) => {
      if (walking || pendingReward) return;

      setWalking(true);
      setCharacterPosition({ x: location.mapX, y: location.mapY });

      setTimeout(() => {
        setWalking(false);
        setMapOpen(false);
        navigate(PAGE_PATHS[location.page].path);
      }, WALK_DURATION + 200);
    },
    [walking, pendingReward, navigate, setMapOpen, setCharacterPosition],
  );

  const handleRewardDismiss = useCallback(() => {
    if (pendingReward) {
      acknowledgeRewardMoment(pendingReward.rewardId);
      setPendingReward(null);
    }
  }, [pendingReward, acknowledgeRewardMoment]);

  return (
    <Fade in={mapOpen} timeout={300} unmountOnExit>
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 1300,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 3,
            py: 1.5,
            bgcolor: (t) => alpha(t.palette.common.black, 0.85),
            borderBottom: "2px solid",
            borderColor: "primary.main",
            zIndex: 40,
          }}
        >
          <Typography variant="h6" sx={{ color: "common.white", fontWeight: 700 }}>
            {"\u{1F5FA}\uFE0F"} Isometric Expedition
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="caption" sx={{ color: "grey.400", fontStyle: "italic" }}>
              Click a location to travel there
            </Typography>
            <IconButton
              size="small"
              aria-label="Close map"
              onClick={() => setMapOpen(false)}
              sx={{ color: "grey.400", "&:hover": { color: "common.white" } }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Map + Journal layout */}
        <Box sx={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* Quest Journal (left panel) */}
          <QuestJournal progress={progress} state={progressInput} />

          {/* Map area — decorative game canvas (hardcoded colors allowed via oxlintrc override) */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: { xs: 0, sm: 320 },
              right: 0,
              bottom: 0,
              overflow: "hidden",
              background:
                "radial-gradient(ellipse at 50% 40%, #2d5016 0%, #1a3a0a 50%, #0d1f05 100%)",
            }}
          >
            {/* Grid lines for isometric feel */}
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), " +
                  "linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
                backgroundSize: "60px 60px",
                transform: "perspective(800px) rotateX(30deg)",
                transformOrigin: "center 60%",
                pointerEvents: "none",
              }}
            />

            {/* Decorative paths between locations */}
            <svg
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 1,
              }}
            >
              {WORLD_MAP.map((loc, i) => {
                const next = WORLD_MAP[i + 1];
                if (!next) return null;
                return (
                  <line
                    key={`${loc.id}-${next.id}`}
                    x1={`${loc.mapX}%`}
                    y1={`${loc.mapY}%`}
                    x2={`${next.mapX}%`}
                    y2={`${next.mapY}%`}
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="2"
                    strokeDasharray="8 6"
                  />
                );
              })}
            </svg>

            {/* Decorative trees */}
            {TREES.map((tree) => (
              <Box
                key={tree.id}
                sx={{
                  position: "absolute",
                  left: `${tree.x}%`,
                  top: `${tree.y}%`,
                  fontSize: { xs: "1rem", sm: "1.3rem" },
                  opacity: 0.5,
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              >
                {tree.e}
              </Box>
            ))}

            {/* Buildings */}
            {WORLD_MAP.map((location) => (
              <MapBuilding
                key={location.id}
                location={location}
                visited={visitedPages.includes(location.page)}
                isQuestTarget={questTargetPages.has(location.page)}
                onClick={() => handleLocationClick(location)}
              />
            ))}

            {/* Character */}
            <MapCharacter x={characterPosition.x} y={characterPosition.y} walking={walking} />
          </Box>

          {/* Reward celebration overlay */}
          {pendingReward && (
            <RewardCelebration
              title={pendingReward.title}
              emoji={pendingReward.emoji}
              copy={pendingReward.copy}
              onDismiss={handleRewardDismiss}
            />
          )}
        </Box>
      </Box>
    </Fade>
  );
}
