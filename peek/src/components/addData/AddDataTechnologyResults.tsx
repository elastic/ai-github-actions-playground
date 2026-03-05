import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { COMPONENT_HEIGHTS } from "../../types/tokens";
import EmptyState from "../EmptyState";
import {
  ADD_DATA_EXPERIENCE_LABELS,
  type AddDataTechnologyCatalogEntry,
} from "../../services/addData/catalog";

import { EXPERIENCE_ICONS, TECHNOLOGY_ICONS } from "./addDataTechnologyConstants";

function TechnologyCard({
  tech,
  selected,
  showExperienceLabel,
  onClick,
}: {
  tech: AddDataTechnologyCatalogEntry;
  selected: boolean;
  showExperienceLabel: boolean;
  onClick: () => void;
}) {
  const icon = TECHNOLOGY_ICONS[tech.id] ?? EXPERIENCE_ICONS[tech.experience];

  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      sx={{ display: "block", width: "100%", borderRadius: 1, textAlign: "left" }}
    >
      <Paper
        variant="outlined"
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          height: "100%",
          minHeight: 116,
          p: 2,
          boxShadow: selected ? 2 : 0,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? "primary.main" : "divider",
          cursor: "pointer",
          transition: "border-color 0.15s, box-shadow 0.15s",
          "&:hover": {
            boxShadow: 1,
            borderColor: selected ? "primary.main" : "text.secondary",
          },
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box
            sx={{
              display: "flex",
              flexShrink: 0,
              justifyContent: "center",
              alignItems: "center",
              width: COMPONENT_HEIGHTS.touchTarget,
              height: COMPONENT_HEIGHTS.touchTarget,
              borderRadius: 1,
              bgcolor: selected ? "primary.main" : "action.selected",
              color: selected ? "primary.contrastText" : "text.secondary",
              transition: "background-color 0.15s, color 0.15s",
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {tech.technology}
              </Typography>
              {selected && (
                <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>
                  Selected
                </Typography>
              )}
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "-webkit-box",
                overflow: "hidden",
                textOverflow: "ellipsis",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
              }}
            >
              {tech.summary}
            </Typography>
          </Box>
        </Stack>

        {showExperienceLabel && (
          <Typography variant="caption" color="text.secondary">
            {tech.experience === "servers"
              ? "Servers"
              : ADD_DATA_EXPERIENCE_LABELS[tech.experience]}
          </Typography>
        )}
      </Paper>
    </ButtonBase>
  );
}

interface AddDataTechnologyResultsProps {
  filteredTechnologies: readonly AddDataTechnologyCatalogEntry[];
  selectedTechnology: AddDataTechnologyCatalogEntry | null;
  onSelectTechnology: (tech: AddDataTechnologyCatalogEntry) => void;
  showExperienceLabel?: boolean;
}

export default function AddDataTechnologyResults({
  filteredTechnologies,
  selectedTechnology,
  onSelectTechnology,
  showExperienceLabel = true,
}: AddDataTechnologyResultsProps) {
  return (
    <Box>
      {filteredTechnologies.length === 0 ? (
        <EmptyState
          heading="No matching technologies"
          description="No technologies match your search. Try a different term or choose a category."
          size="small"
        />
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))",
            gap: 1.5,
          }}
        >
          {filteredTechnologies.map((tech) => (
            <TechnologyCard
              key={tech.id}
              tech={tech}
              selected={selectedTechnology?.id === tech.id}
              showExperienceLabel={showExperienceLabel}
              onClick={() => onSelectTechnology(tech)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
