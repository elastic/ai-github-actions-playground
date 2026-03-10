import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Fade from "@mui/material/Fade";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import { alpha } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import { useEasterEggStore } from "../../store/useEasterEggStore";
import { PAGE_PATHS } from "../../routes/paths";
import { WORLD_MAP } from "./worldMap";
import { EASTER_EGG_QUESTS } from "./quests";
import { buildQuestProgress } from "./progress";
import { REWARD_BY_ID } from "./content";
import type { WorldLocation } from "./types";
import type { QuestProgress, QuestProgressInput } from "./progress";
import MapBuilding from "./MapBuilding";
import QuestJournal from "./QuestJournal";
import RewardCelebration from "./RewardCelebration";

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
