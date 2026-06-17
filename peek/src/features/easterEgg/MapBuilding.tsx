import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";

import type { WorldLocation } from "./types";

export default function MapBuilding({
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
