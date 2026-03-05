import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import {
  ADD_DATA_EXPERIENCE_DESCRIPTIONS,
  ADD_DATA_EXPERIENCE_LABELS,
  type AddDataGuidedExperience,
} from "../../services/addData/catalog";
import { interactiveCardSxWithBg } from "../interactiveCardSx";

import { EXPERIENCE_ICONS } from "./addDataTechnologyConstants";

interface ExperienceTileProps {
  experience: AddDataGuidedExperience;
  onClick: () => void;
  title?: string;
  description?: string;
  icon?: ReactNode;
}

export default function ExperienceTile({
  experience,
  onClick,
  title,
  description,
  icon,
}: ExperienceTileProps) {
  const resolvedTitle =
    title ?? (experience === "servers" ? "Servers" : ADD_DATA_EXPERIENCE_LABELS[experience]);
  const resolvedDescription = description ?? ADD_DATA_EXPERIENCE_DESCRIPTIONS[experience];
  const resolvedIcon = icon ?? EXPERIENCE_ICONS[experience];
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
          gap: 1.5,
          height: "100%",
          minHeight: 160,
          p: 2.5,
          cursor: "pointer",
          ...interactiveCardSxWithBg,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: 56,
            height: 56,
            borderRadius: 1.5,
            bgcolor: "action.selected",
            color: "text.secondary",
          }}
        >
          {resolvedIcon}
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {resolvedTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {resolvedDescription}
        </Typography>
      </Paper>
    </ButtonBase>
  );
}
