import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import Markdown from "react-markdown";

import { usePackageBuilderStore } from "../../store/usePackageBuilderStore";

export default function StepDocs() {
  const readmeContent = usePackageBuilderStore((s) => s.readmeContent);
  const setReadmeContent = usePackageBuilderStore((s) => s.setReadmeContent);
  const regenerateReadme = usePackageBuilderStore((s) => s.regenerateReadme);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h6">Documentation</Typography>
          <Typography variant="body2" color="text.secondary">
            Edit the package README that users see in Fleet / Integrations UI.
          </Typography>
        </Box>
        <Button
          size="small"
          startIcon={<AutoFixHighIcon />}
          onClick={regenerateReadme}
          variant="outlined"
        >
          Regenerate from metadata
        </Button>
      </Box>

      <Box sx={{ display: "flex", gap: 2, flex: 1, minHeight: 300 }}>
        {/* Markdown editor */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            docs/README.md
          </Typography>
          <TextField
            value={readmeContent}
            onChange={(e) => setReadmeContent(e.target.value)}
            multiline
            fullWidth
            sx={{
              flex: 1,
              "& .MuiInputBase-root": {
                fontFamily: "monospace",
                fontSize: 13,
                alignItems: "flex-start",
              },
              "& textarea": { minHeight: 300 },
            }}
            size="small"
          />
        </Box>

        {/* Live markdown preview */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Preview
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              flex: 1,
              p: 2,
              overflow: "auto",
              minHeight: 300,
              "& table": { borderCollapse: "collapse", width: "100%" },
              "& th, & td": {
                border: "1px solid",
                borderColor: "divider",
                px: 1,
                py: 0.5,
                textAlign: "left",
              },
              "& code": {
                fontFamily: "monospace",
                bgcolor: "action.hover",
                px: 0.5,
                borderRadius: 0.5,
              },
              "& pre": { bgcolor: "action.hover", p: 1.5, borderRadius: 1, overflow: "auto" },
              "& h1": { fontSize: "1.4rem", mt: 0 },
              "& h2": { fontSize: "1.15rem" },
            }}
          >
            <Markdown>
              {readmeContent ||
                "*No content yet. Click 'Regenerate from metadata' to auto-create a README.*"}
            </Markdown>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
