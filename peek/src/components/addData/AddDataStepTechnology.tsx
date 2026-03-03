import { useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";

import {
  ADD_DATA_CATEGORY_LABELS,
  ADD_DATA_TECHNOLOGY_CATALOG,
  type AddDataTechnologyCatalogEntry,
  type AddDataTechnologyCategory,
} from "../../services/addData/catalog";

type TechnologyCategoryFilter = "all" | AddDataTechnologyCategory;
const CATEGORIES: readonly TechnologyCategoryFilter[] = [
  "all",
  ...(Object.keys(ADD_DATA_CATEGORY_LABELS) as AddDataTechnologyCategory[]),
];

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
      const categoryMatches = activeCategory === "all" || tech.category === activeCategory;
      const queryMatches =
        query.length === 0 ||
        tech.technology.toLowerCase().includes(query) ||
        tech.summary.toLowerCase().includes(query);
      return categoryMatches && queryMatches;
    });
  }, [activeCategory, technologySearch]);

  return (
    <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1.5 }}>
      <Typography variant="h6">Step 1: What are you monitoring?</Typography>
      <Typography variant="body2" color="text.secondary">
        Pick a technology to tailor environment choices, setup commands, verification checks, and
        next actions.
      </Typography>
      <TextField
        label="Search technologies"
        value={technologySearch}
        onChange={(e) => onTechnologySearchChange(e.target.value)}
        fullWidth
      />
      <ToggleButtonGroup
        value={activeCategory}
        exclusive
        size="small"
        onChange={(_, value: TechnologyCategoryFilter | null) => {
          if (value) onActiveCategoryChange(value);
        }}
        aria-label="Technology category"
      >
        {CATEGORIES.map((category) => (
          <ToggleButton key={category} value={category}>
            {category === "all" ? "All" : ADD_DATA_CATEGORY_LABELS[category]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Stack spacing={1}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Recommended for you
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {recommendedTechnologies.map((tech) => (
            <Button
              key={tech.id}
              size="small"
              variant={selectedTechnology?.id === tech.id ? "contained" : "outlined"}
              onClick={() => onSelectTechnology(tech)}
            >
              {tech.technology}
            </Button>
          ))}
        </Stack>
      </Stack>

      <Stack spacing={1}>
        {filteredTechnologies.map((tech) => (
          <Paper key={tech.id} variant="outlined" sx={{ p: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {tech.technology}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {ADD_DATA_CATEGORY_LABELS[tech.category]} • {tech.summary}
                </Typography>
              </Box>
              <Button
                size="small"
                variant={selectedTechnology?.id === tech.id ? "contained" : "outlined"}
                onClick={() => onSelectTechnology(tech)}
              >
                {selectedTechnology?.id === tech.id ? "Selected" : "Choose"}
              </Button>
            </Stack>
          </Paper>
        ))}
      </Stack>

      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" onClick={onContinue} disabled={selectedTechnology === null}>
          Continue to step 2
        </Button>
      </Stack>
    </Paper>
  );
}
