import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Fade from "@mui/material/Fade";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";

export default function RewardCelebration({
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
          bgcolor: (t) => alpha(t.palette.common.black, 0.7),
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
