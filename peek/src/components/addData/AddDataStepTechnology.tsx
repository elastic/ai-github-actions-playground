import { useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Collapse from "@mui/material/Collapse";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";

import {
  ADD_DATA_EXPERIENCE_DESCRIPTIONS,
  ADD_DATA_EXPERIENCE_LABELS,
  ADD_DATA_TECHNOLOGY_CATALOG,
  type AddDataGuidedExperience,
  type AddDataTechnologyCatalogEntry,
} from "../../services/addData/catalog";

import AddDataTechnologyResults from "./AddDataTechnologyResults";
import ExperienceTile from "./ExperienceTile";
import { EXPERIENCE_ICONS } from "./addDataTechnologyConstants";

const PRIMARY_EXPERIENCES: readonly AddDataGuidedExperience[] = [
  "cloud_providers",
  "kubernetes",
  "servers",
  "saas_databases",
];

interface AddDataStepTechnologyProps {
  selectedTechnology: AddDataTechnologyCatalogEntry | null;
  onSelectTechnology: (tech: AddDataTechnologyCatalogEntry) => void;
  onClearTechnology: () => void;
  technologySearch: string;
  onTechnologySearchChange: (search: string) => void;
  onContinue: () => void;
}

export default function AddDataStepTechnology({
  selectedTechnology,
  onSelectTechnology,
  onClearTechnology,
  technologySearch,
  onTechnologySearchChange,
  onContinue,
}: AddDataStepTechnologyProps) {
  const [selectedExperience, setSelectedExperience] = useState<AddDataGuidedExperience | null>(
    null,
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);

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

    // If an experience is selected, filter to that experience
    if (selectedExperience) {
      return ADD_DATA_TECHNOLOGY_CATALOG.filter((tech) => tech.experience === selectedExperience);
    }

    return [];
  }, [technologySearch, selectedExperience]);

  const advancedTechnologies = useMemo(
    () => ADD_DATA_TECHNOLOGY_CATALOG.filter((tech) => tech.experience === "advanced"),
    [],
  );

  const showExperienceTiles = !selectedExperience && technologySearch.trim().length === 0;
  const showSearchResults = technologySearch.trim().length > 0;

  return (
    <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", gap: 2, p: 2 }}>
      <Box>
        <Typography variant="h6">What are you monitoring?</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Pick a technology to tailor environment choices, setup commands, and verification checks.
        </Typography>
      </Box>

      <TextField
        placeholder="Search integrations..."
        value={technologySearch}
        onChange={(e) => {
          onTechnologySearchChange(e.target.value);
          if (e.target.value.trim().length > 0) {
            setSelectedExperience(null);
            onClearTechnology();
          }
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
          },
        }}
      />

      {/* Experience hero tiles (2x2 grid) */}
      {showExperienceTiles && (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
              gap: 1.5,
            }}
          >
            {PRIMARY_EXPERIENCES.map((exp) => (
              <ExperienceTile
                key={exp}
                experience={exp}
                onClick={() => {
                  setSelectedExperience(exp);
                  if (selectedTechnology && selectedTechnology.experience !== exp) {
                    onClearTechnology();
                  }
                }}
              />
            ))}
          </Box>

          {/* Advanced section — collapsible */}
          <Box>
            <ButtonBase
              onClick={() => setAdvancedOpen((prev) => !prev)}
              aria-expanded={advancedOpen}
              aria-controls="advanced-technologies-panel"
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                py: 1,
                px: 0.5,
                borderRadius: 1,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {EXPERIENCE_ICONS.advanced}
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {ADD_DATA_EXPERIENCE_LABELS.advanced}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {ADD_DATA_EXPERIENCE_DESCRIPTIONS.advanced}
                </Typography>
              </Stack>
              <ExpandMoreIcon
                fontSize="small"
                sx={{
                  transform: advancedOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}
              />
            </ButtonBase>
            <Collapse in={advancedOpen}>
              <Box id="advanced-technologies-panel" role="region" sx={{ pt: 1 }}>
                <AddDataTechnologyResults
                  filteredTechnologies={advancedTechnologies}
                  selectedTechnology={selectedTechnology}
                  onSelectTechnology={onSelectTechnology}
                />
              </Box>
            </Collapse>
          </Box>
        </>
      )}

      {/* Breadcrumb back to experience selection */}
      {selectedExperience && !showSearchResults && (
        <Button
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={() => {
            setSelectedExperience(null);
            onClearTechnology();
          }}
          sx={{ alignSelf: "flex-start" }}
        >
          {ADD_DATA_EXPERIENCE_LABELS[selectedExperience]}
        </Button>
      )}

      {/* Technology results for selected experience or search */}
      {(selectedExperience || showSearchResults) && (
        <AddDataTechnologyResults
          filteredTechnologies={filteredTechnologies}
          selectedTechnology={selectedTechnology}
          onSelectTechnology={onSelectTechnology}
        />
      )}

      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" onClick={onContinue} disabled={selectedTechnology === null}>
          Continue
        </Button>
      </Stack>
    </Paper>
  );
}
