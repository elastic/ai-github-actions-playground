import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { APM_LANGUAGE_CATALOG } from "../../../services/addData/apmCatalog";
import type { ApmLanguageDefinition } from "../../../services/addData/apmCatalog";

export interface ApmConfigureProps {
  selectedLanguage: ApmLanguageDefinition | null;
  onSelectLanguage: (lang: ApmLanguageDefinition) => void;
}

export default function ApmConfigure({ selectedLanguage, onSelectLanguage }: ApmConfigureProps) {
  return (
    <>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        Select your application language
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {APM_LANGUAGE_CATALOG.map((lang) => {
          const isSelected = selectedLanguage?.languageId === lang.languageId;
          return (
            <ButtonBase
              key={lang.languageId}
              onClick={() => onSelectLanguage(lang)}
              aria-pressed={isSelected}
              sx={{ borderRadius: 1 }}
            >
              <Paper
                variant="outlined"
                sx={{
                  py: 1,
                  px: 2,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? "primary.main" : undefined,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {lang.label}
                </Typography>
              </Paper>
            </ButtonBase>
          );
        })}
      </Stack>
    </>
  );
}
