import { useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SearchIcon from "@mui/icons-material/Search";

import {
  ADD_DATA_EXPERIENCE_DESCRIPTIONS,
  ADD_DATA_EXPERIENCE_LABELS,
  ADD_DATA_TECHNOLOGY_CATALOG,
  type AddDataGuidedExperience,
  type AddDataTechnologyCatalogEntry,
} from "../../services/addData/catalog";
import { COMPONENT_HEIGHTS } from "../../types/tokens";

import AddDataTechnologyResults from "./AddDataTechnologyResults";
import ExperienceTile from "./ExperienceTile";
import ExpandableAlternatives from "./guides/ExpandableAlternatives";
import { EXPERIENCE_ICONS } from "./addDataTechnologyConstants";

type HeroCategoryId = "cloud_saas" | "kubernetes" | "servers" | "applications";
type CloudSaasFilter = "all" | "cloud_providers" | "saas_databases";

const HERO_CATEGORIES: ReadonlyArray<{
  id: HeroCategoryId;
  title: string;
  description: string;
  experience: AddDataGuidedExperience;
}> = [
  {
    id: "cloud_saas",
    title: "Cloud and SaaS",
    description: "Monitor cloud services and managed databases.",
    experience: "cloud_providers",
  },
  {
    id: "kubernetes",
    title: "Kubernetes",
    description: "Collect cluster, node, and workload telemetry.",
    experience: "kubernetes",
  },
  {
    id: "servers",
    title: "Laptops and Servers",
    description: "Monitor Linux, Windows, or macOS hosts.",
    experience: "servers",
  },
  {
    id: "applications",
    title: "Applications (APM Agents)",
    description: "Instrument applications with Elastic APM agents.",
    experience: "advanced",
  },
];

interface AddDataStepTechnologyProps {
  selectedTechnology: AddDataTechnologyCatalogEntry | null;
  onSelectTechnology: (tech: AddDataTechnologyCatalogEntry) => void;
  onClearTechnology: () => void;
  technologySearch: string;
  onTechnologySearchChange: (search: string) => void;
}

export default function AddDataStepTechnology({
  selectedTechnology,
  onSelectTechnology,
  onClearTechnology,
  technologySearch,
  onTechnologySearchChange,
}: AddDataStepTechnologyProps) {
  const [selectedHeroCategory, setSelectedHeroCategory] = useState<HeroCategoryId | null>(null);
  const [cloudSaasFilter, setCloudSaasFilter] = useState<CloudSaasFilter>("all");

  const filteredTechnologies = useMemo(() => {
    const query = technologySearch.trim().toLowerCase();

    // If searching, filter across all experiences
    if (query.length > 0) {
      return ADD_DATA_TECHNOLOGY_CATALOG.filter(
        (tech) =>
          tech.technology.toLowerCase().includes(query) ||
          tech.summary.toLowerCase().includes(query) ||
          ADD_DATA_EXPERIENCE_LABELS[tech.experience].toLowerCase().includes(query),
      );
    }

    // If a hero category is selected, filter to that category's technologies
    if (selectedHeroCategory) {
      if (selectedHeroCategory === "cloud_saas") {
        if (cloudSaasFilter !== "all") {
          return ADD_DATA_TECHNOLOGY_CATALOG.filter((tech) => tech.experience === cloudSaasFilter);
        }
        return ADD_DATA_TECHNOLOGY_CATALOG.filter(
          (tech) => tech.experience === "cloud_providers" || tech.experience === "saas_databases",
        );
      }
      if (selectedHeroCategory === "applications") {
        return ADD_DATA_TECHNOLOGY_CATALOG.filter(
          (tech) => tech.experience === "advanced" && tech.guideType === "apm",
        );
      }
      const category = HERO_CATEGORIES.find((hero) => hero.id === selectedHeroCategory);
      if (!category) return [];
      return ADD_DATA_TECHNOLOGY_CATALOG.filter((tech) => tech.experience === category.experience);
    }

    return [];
  }, [technologySearch, selectedHeroCategory, cloudSaasFilter]);

  const advancedTechnologies = useMemo(
    () =>
      ADD_DATA_TECHNOLOGY_CATALOG.filter(
        (tech) => tech.experience === "advanced" && tech.guideType !== "apm",
      ),
    [],
  );

  const showExperienceTiles = !selectedHeroCategory && technologySearch.trim().length === 0;
  const showSearchResults = technologySearch.trim().length > 0;
  return (
    <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", gap: 2, p: 2 }}>
      <Box>
        <Typography variant="h6">What do you want to monitor?</Typography>
      </Box>

      <TextField
        placeholder="Search technologies (e.g., PostgreSQL, Kubernetes...)"
        value={technologySearch}
        onChange={(e) => {
          onTechnologySearchChange(e.target.value);
          if (e.target.value.trim().length > 0) {
            setSelectedHeroCategory(null);
            setCloudSaasFilter("all");
            onClearTechnology();
          }
          onClearTechnology();
        }}
        fullWidth
        size="small"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
            sx: { height: COMPONENT_HEIGHTS.input },
          },
        }}
      />

      {/* Experience hero tiles (2x2 grid) */}
      {showExperienceTiles && (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { sm: "repeat(2, 1fr)", xs: "1fr" },
              gap: 1.5,
            }}
          >
            {HERO_CATEGORIES.map((hero) => (
              <ExperienceTile
                key={hero.id}
                experience={hero.experience}
                title={hero.title}
                description={hero.description}
                icon={hero.id === "applications" ? <AutoAwesomeIcon /> : undefined}
                onClick={() => {
                  setSelectedHeroCategory(hero.id);
                  setCloudSaasFilter("all");
                  if (selectedTechnology) {
                    onClearTechnology();
                  }
                }}
              />
            ))}
          </Box>

          {/* Advanced section — collapsible */}
          <ExpandableAlternatives
            idPrefix="advanced"
            label={ADD_DATA_EXPERIENCE_LABELS.advanced}
            expandedLabel={`Hide ${ADD_DATA_EXPERIENCE_LABELS.advanced.toLowerCase()}`}
            startIcon={EXPERIENCE_ICONS.advanced}
          >
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              {ADD_DATA_EXPERIENCE_DESCRIPTIONS.advanced}
            </Typography>
            <AddDataTechnologyResults
              filteredTechnologies={advancedTechnologies}
              selectedTechnology={selectedTechnology}
              onSelectTechnology={onSelectTechnology}
            />
          </ExpandableAlternatives>
        </>
      )}

      {/* Breadcrumb back to experience selection */}
      {selectedHeroCategory && !showSearchResults && (
        <Button
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={() => {
            setSelectedHeroCategory(null);
            setCloudSaasFilter("all");
            onClearTechnology();
          }}
          sx={{ alignSelf: "flex-start" }}
        >
          {HERO_CATEGORIES.find((hero) => hero.id === selectedHeroCategory)?.title ?? "Back"}
        </Button>
      )}

      {selectedHeroCategory === "cloud_saas" && !showSearchResults && (
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Show:
          </Typography>
          <Button
            size="small"
            variant={cloudSaasFilter === "all" ? "contained" : "outlined"}
            onClick={() => setCloudSaasFilter("all")}
          >
            All
          </Button>
          <Button
            size="small"
            variant={cloudSaasFilter === "cloud_providers" ? "contained" : "outlined"}
            onClick={() => setCloudSaasFilter("cloud_providers")}
          >
            Cloud Providers
          </Button>
          <Button
            size="small"
            variant={cloudSaasFilter === "saas_databases" ? "contained" : "outlined"}
            onClick={() => setCloudSaasFilter("saas_databases")}
          >
            SaaS & Databases
          </Button>
        </Stack>
      )}

      {/* Technology results for selected experience or search */}
      {(selectedHeroCategory || showSearchResults) && (
        <AddDataTechnologyResults
          filteredTechnologies={filteredTechnologies}
          selectedTechnology={selectedTechnology}
          onSelectTechnology={onSelectTechnology}
        />
      )}
    </Paper>
  );
}
