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
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {APM_LANGUAGE_CATALOG.map((lang) => (
          <Paper
            key={lang.languageId}
            variant="outlined"
            onClick={() => onSelectLanguage(lang)}
            sx={{
              py: 1,
              px: 2,
              borderWidth: selectedLanguage?.languageId === lang.languageId ? 2 : 1,
              borderColor:
                selectedLanguage?.languageId === lang.languageId ? "primary.main" : undefined,
              cursor: "pointer",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {lang.label}
            </Typography>
          </Paper>
        ))}
      </Stack>
    </>
  );
}
