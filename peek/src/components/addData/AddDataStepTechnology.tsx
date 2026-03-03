import { useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloudIcon from "@mui/icons-material/Cloud";
import CodeIcon from "@mui/icons-material/Code";
import DevicesIcon from "@mui/icons-material/Devices";
import LanIcon from "@mui/icons-material/Lan";
import SearchIcon from "@mui/icons-material/Search";
import StorageIcon from "@mui/icons-material/Storage";
import ViewInArIcon from "@mui/icons-material/ViewInAr";

import EmptyState from "../EmptyState";
import {
  ADD_DATA_CATEGORY_LABELS,
  ADD_DATA_TECHNOLOGY_CATALOG,
  type AddDataTechnologyCatalogEntry,
  type AddDataTechnologyCategory,
} from "../../services/addData/catalog";

type TechnologyCategoryFilter = "all" | AddDataTechnologyCategory;

const SIGNAL_COLORS: Record<string, "info" | "success" | "warning"> = {
  logs: "info",
  metrics: "success",
  traces: "warning",
};

const CATEGORY_ICONS: Record<AddDataTechnologyCategory, React.ReactElement> = {
  cloud: <CloudIcon fontSize="small" />,
  containers: <ViewInArIcon fontSize="small" />,
  databases: <StorageIcon fontSize="small" />,
  applications: <CodeIcon fontSize="small" />,
  operating_systems: <DevicesIcon fontSize="small" />,
  network: <LanIcon fontSize="small" />,
};

interface AddDataStepTechnologyProps {
  selectedTechnology: AddDataTechnologyCatalogEntry | null;
  onSelectTechnology: (tech: AddDataTechnologyCatalogEntry) => void;
  technologySearch: string;
  onTechnologySearchChange: (search: string) => void;
  activeCategory: TechnologyCategoryFilter;
  onActiveCategoryChange: (category: TechnologyCategoryFilter) => void;
  onContinue: () => void;
}

export type { TechnologyCategoryFilter };

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

export default function AddDataStepTechnology({
  selectedTechnology,
  onSelectTechnology,
  technologySearch,
  onTechnologySearchChange,
  activeCategory,
  onActiveCategoryChange,
  onContinue,
}: AddDataStepTechnologyProps) {
  const recommendedTechnologies = useMemo(
    () => ADD_DATA_TECHNOLOGY_CATALOG.filter((tech) => tech.recommended),
    [],
  );

  const filteredTechnologies = useMemo(() => {
    const query = technologySearch.trim().toLowerCase();
    return ADD_DATA_TECHNOLOGY_CATALOG.filter((tech) => {
      if (tech.recommended && activeCategory === "all" && query.length === 0) return false;
      const categoryMatches = activeCategory === "all" || tech.category === activeCategory;
      const queryMatches =
        query.length === 0 ||
        tech.technology.toLowerCase().includes(query) ||
        tech.summary.toLowerCase().includes(query) ||
        tech.category.toLowerCase().includes(query);
      return categoryMatches && queryMatches;
    });
  }, [activeCategory, technologySearch]);

  const showRecommended = activeCategory === "all" && technologySearch.trim().length === 0;

  return (
    <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", gap: 2, p: 2 }}>
      <Box>
        <Typography variant="h6">Step 1: What are you monitoring?</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Pick a technology to tailor environment choices, setup commands, and verification checks.
        </Typography>
      </Box>

      <TextField
        placeholder="Search integrations..."
        value={technologySearch}
        onChange={(e) => onTechnologySearchChange(e.target.value)}
        fullWidth
        size="small"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          },
        }}
      />

      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {(
          [
            "all",
            ...(Object.keys(ADD_DATA_CATEGORY_LABELS) as AddDataTechnologyCategory[]),
          ] as TechnologyCategoryFilter[]
        ).map((category) => (
          <Chip
            key={category}
            label={category === "all" ? "All" : ADD_DATA_CATEGORY_LABELS[category]}
            icon={category !== "all" ? CATEGORY_ICONS[category] : undefined}
            size="small"
            variant={activeCategory === category ? "filled" : "outlined"}
            color={activeCategory === category ? "primary" : "default"}
            onClick={() => onActiveCategoryChange(category)}
            aria-pressed={activeCategory === category}
            sx={{ cursor: "pointer" }}
          />
        ))}
      </Stack>

      {showRecommended && (
        <Box>
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

      <Box>
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

      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" onClick={onContinue} disabled={selectedTechnology === null}>
          Continue to step 2
        </Button>
      </Stack>
    </Paper>
  );
}
