import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import EmptyState from "../EmptyState";
import {
  ADD_DATA_CATEGORY_LABELS,
  type AddDataTechnologyCatalogEntry,
} from "../../services/addData/catalog";

import { CATEGORY_ICONS, SIGNAL_COLORS } from "./addDataTechnologyConstants";

function TechnologyCard({
  tech,
  selected,
  onClick,
  variant = "standard",
}: {
  tech: AddDataTechnologyCatalogEntry;
  selected: boolean;
  onClick: () => void;
  variant?: "standard" | "hero";
}) {
  const isHero = variant === "hero";

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
          p: isHero ? 2 : 1.5,
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
              width: isHero ? 44 : 36,
              height: isHero ? 44 : 36,
              borderRadius: 1,
              bgcolor: selected ? "primary.main" : "action.selected",
              color: selected ? "primary.contrastText" : "text.secondary",
              transition: "background-color 0.15s, color 0.15s",
            }}
          >
            {CATEGORY_ICONS[tech.category]}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant={isHero ? "subtitle1" : "body2"} sx={{ fontWeight: 600 }} noWrap>
                {tech.technology}
              </Typography>
              {selected && <Chip label="Selected" size="small" color="primary" />}
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "-webkit-box",
                overflow: "hidden",
                textOverflow: "ellipsis",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: isHero ? 2 : 1,
              }}
            >
              {tech.summary}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {tech.expectedSignals.map((signal) => (
            <Chip
              key={signal}
              label={signal}
              size="small"
              variant="outlined"
              color={SIGNAL_COLORS[signal] ?? "default"}
              sx={{ height: 20, fontSize: "0.7rem" }}
            />
          ))}
          <Chip
            label={ADD_DATA_CATEGORY_LABELS[tech.category]}
            size="small"
            variant="outlined"
            sx={{ height: 20, ml: "auto", fontSize: "0.7rem" }}
          />
        </Stack>
      </Paper>
    </ButtonBase>
  );
}

interface AddDataTechnologyResultsProps {
  showRecommended: boolean;
  recommendedTechnologies: readonly AddDataTechnologyCatalogEntry[];
  filteredTechnologies: readonly AddDataTechnologyCatalogEntry[];
  selectedTechnology: AddDataTechnologyCatalogEntry | null;
  onSelectTechnology: (tech: AddDataTechnologyCatalogEntry) => void;
}

export default function AddDataTechnologyResults({
  showRecommended,
  recommendedTechnologies,
  filteredTechnologies,
  selectedTechnology,
  onSelectTechnology,
}: AddDataTechnologyResultsProps) {
  return (
    <Box>
      {showRecommended && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
            Recommended
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))",
              gap: 1.5,
            }}
          >
            {recommendedTechnologies.map((tech) => (
              <TechnologyCard
                key={tech.id}
                tech={tech}
                selected={selectedTechnology?.id === tech.id}
                onClick={() => onSelectTechnology(tech)}
                variant="hero"
              />
            ))}
          </Box>
        </Box>
      )}

      {showRecommended && (
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
          All integrations
        </Typography>
      )}
      {filteredTechnologies.length === 0 ? (
        <EmptyState
          heading="No integrations found"
          description="No integrations match your search. Try a different query or category."
          size="small"
        />
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))",
            gap: 1,
          }}
        >
          {filteredTechnologies.map((tech) => (
            <TechnologyCard
              key={tech.id}
              tech={tech}
              selected={selectedTechnology?.id === tech.id}
              onClick={() => onSelectTechnology(tech)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
