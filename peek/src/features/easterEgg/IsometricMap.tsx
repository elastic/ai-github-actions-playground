import { useState, useCallback } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Fade from "@mui/material/Fade";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import { useEasterEggStore } from "../../store/useEasterEggStore";
import { PAGE_PATHS } from "../../routes/paths";
import { WORLD_MAP } from "./worldMap";
import type { WorldLocation } from "./types";

/** Duration (ms) of the character walk animation. */
const WALK_DURATION = 800;

/** Decorative trees scattered across the map. */
const TREES = [
  { id: "t1", x: 10, y: 40, e: "🌳" },
  { id: "t2", x: 40, y: 30, e: "🌲" },
  { id: "t3", x: 65, y: 60, e: "🌳" },
  { id: "t4", x: 90, y: 15, e: "🌲" },
  { id: "t5", x: 35, y: 85, e: "🌳" },
  { id: "t6", x: 55, y: 5, e: "🌲" },
  { id: "t7", x: 8, y: 75, e: "🌳" },
  { id: "t8", x: 92, y: 70, e: "🌲" },
  { id: "t9", x: 45, y: 60, e: "🌿" },
  { id: "t10", x: 12, y: 55, e: "🌿" },
];

function MapBuilding({
  location,
  visited,
  onClick,
}: {
  location: WorldLocation;
  visited: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip
      title={
        <>
          <Typography variant="subtitle1">{location.name}</Typography>
          <Typography variant="caption">{location.description}</Typography>
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
            bgcolor: (t) => alpha(t.palette.common.black, 0.6),
            color: "common.white",
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
      🧙
    </Box>
  );
}

export default function IsometricMap() {
  const navigate = useNavigate();
  const { mapOpen, characterPosition, visitedPages, setMapOpen, setCharacterPosition } =
    useEasterEggStore(
      useShallow((s) => ({
        mapOpen: s.mapOpen,
        characterPosition: s.characterPosition,
        visitedPages: s.visitedPages,
        setMapOpen: s.setMapOpen,
        setCharacterPosition: s.setCharacterPosition,
      })),
    );

  const [walking, setWalking] = useState(false);

  const handleLocationClick = useCallback(
    (location: WorldLocation) => {
      if (walking) return;

      // Start walking animation
      setWalking(true);
      setCharacterPosition({ x: location.mapX, y: location.mapY });

      // After walk completes, navigate to the page
      setTimeout(() => {
        setWalking(false);
        setMapOpen(false);
        navigate(PAGE_PATHS[location.page].path);
      }, WALK_DURATION + 200);
    },
    [walking, navigate, setMapOpen, setCharacterPosition],
  );

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
            zIndex: 2,
          }}
        >
          <Typography variant="h6" sx={{ color: "common.white", fontWeight: 700 }}>
            🗺️ Isometric Expedition
          </Typography>
          <Typography variant="caption" sx={{ color: "grey.400", fontStyle: "italic" }}>
            Click a location to travel there
          </Typography>
        </Box>

        {/* Map area — decorative game canvas (hardcoded colors allowed via oxlintrc override) */}
        <Box
          sx={{
            flex: 1,
            position: "relative",
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
              onClick={() => handleLocationClick(location)}
            />
          ))}

          {/* Character */}
          <MapCharacter x={characterPosition.x} y={characterPosition.y} walking={walking} />
        </Box>
      </Box>
    </Fade>
  );
}
