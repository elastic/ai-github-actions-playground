import { useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";

import {
  ADD_DATA_CATEGORY_LABELS,
  ADD_DATA_TECHNOLOGY_CATALOG,
  type AddDataTechnologyCatalogEntry,
  type AddDataTechnologyCategory,
} from "../../services/addData/catalog";

import AddDataTechnologyResults from "./AddDataTechnologyResults";
import { CATEGORY_ICONS } from "./addDataTechnologyConstants";

type TechnologyCategoryFilter = "all" | AddDataTechnologyCategory;

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

      <AddDataTechnologyResults
        showRecommended={showRecommended}
        recommendedTechnologies={recommendedTechnologies}
        filteredTechnologies={filteredTechnologies}
        selectedTechnology={selectedTechnology}
        onSelectTechnology={onSelectTechnology}
      />

      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" onClick={onContinue} disabled={selectedTechnology === null}>
          Continue to step 2
        </Button>
      </Stack>
    </Paper>
  );
}
