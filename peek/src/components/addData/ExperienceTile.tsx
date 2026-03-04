import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import {
  ADD_DATA_EXPERIENCE_DESCRIPTIONS,
  ADD_DATA_EXPERIENCE_LABELS,
  type AddDataGuidedExperience,
} from "../../services/addData/catalog";
import { interactiveCardSx } from "../interactiveCardSx";

import { EXPERIENCE_ICONS } from "./addDataTechnologyConstants";

interface ExperienceTileProps {
  experience: AddDataGuidedExperience;
  onClick: () => void;
}

export default function ExperienceTile({ experience, onClick }: ExperienceTileProps) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{ display: "block", width: "100%", borderRadius: 1, textAlign: "left" }}
    >
      <Paper
        variant="outlined"
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          height: "100%",
          p: 2,
          cursor: "pointer",
          ...interactiveCardSx,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: 48,
            height: 48,
            borderRadius: 1.5,
            bgcolor: "action.selected",
            color: "text.secondary",
          }}
        >
          {EXPERIENCE_ICONS[experience]}
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {ADD_DATA_EXPERIENCE_LABELS[experience]}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {ADD_DATA_EXPERIENCE_DESCRIPTIONS[experience]}
        </Typography>
      </Paper>
    </ButtonBase>
  );
}
