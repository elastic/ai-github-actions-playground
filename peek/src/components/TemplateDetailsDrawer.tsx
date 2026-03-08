import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";

import type { useSimulatedIndexTemplate } from "../hooks/useTemplates";
import type { ComponentTemplateRow, IndexTemplateRow } from "../services/es";

interface TemplateDetailsDrawerProps {
  selectedTemplate: IndexTemplateRow | null;
  selectedComponentTemplate: ComponentTemplateRow | null;
  simulatedTemplate: ReturnType<typeof useSimulatedIndexTemplate>;
  onClose: () => void;
}

export default function TemplateDetailsDrawer({
  selectedTemplate,
  selectedComponentTemplate,
  simulatedTemplate,
  onClose,
}: TemplateDetailsDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={Boolean(selectedTemplate || selectedComponentTemplate)}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", md: 560 },
          p: 1,
          backgroundColor: "background.default",
        },
      }}
    >
      {selectedTemplate && (
        <>
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1 }}
          >
            <Typography variant="subtitle1">Template Details</Typography>
            <IconButton size="small" aria-label="Close template details" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 1, py: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              NAME
            </Typography>
            <Typography variant="body2" gutterBottom sx={{ fontFamily: "monospace" }}>
              {selectedTemplate.name}
            </Typography>

            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              INDEX PATTERNS
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
              {selectedTemplate.indexPatterns.map((pattern, index) => (
                <Chip key={`${pattern}-${index}`} label={pattern} size="small" variant="outlined" />
              ))}
            </Box>

            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              PRIORITY
            </Typography>
            <Typography variant="body2" gutterBottom>
              {selectedTemplate.priority}
            </Typography>

            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              DATA STREAM
            </Typography>
            <Typography variant="body2" gutterBottom>
              {selectedTemplate.dataStreamEnabled ? "Enabled" : "Disabled"}
            </Typography>

            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              VERSION
            </Typography>
            <Typography variant="body2" gutterBottom>
              {selectedTemplate.version}
            </Typography>

            {selectedTemplate.composedOf.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  COMPOSED OF (in order)
                </Typography>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
                  {selectedTemplate.composedOf.map((component, index) => (
                    <Chip
                      key={`${component}-${index}`}
                      label={`${index + 1}. ${component}`}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </>
            )}

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                SIMULATED OUTPUT
              </Typography>
              <Paper
                variant="outlined"
                sx={{ p: 1, maxHeight: 260, overflow: "auto", fontSize: "0.75rem" }}
              >
                {simulatedTemplate.status === "loading" ? (
                  <LinearProgress />
                ) : simulatedTemplate.status === "error" ? (
                  <Typography variant="body2" color="error">
                    {simulatedTemplate.error}
                  </Typography>
                ) : (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {JSON.stringify(
                      simulatedTemplate.status === "success" ? simulatedTemplate.data : {},
                      null,
                      2,
                    )}
                  </pre>
                )}
              </Paper>
            </Box>

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                RAW JSON
              </Typography>
              <Paper
                variant="outlined"
                sx={{ p: 1, maxHeight: 300, overflow: "auto", fontSize: "0.75rem" }}
              >
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {JSON.stringify(selectedTemplate.raw ?? selectedTemplate, null, 2)}
                </pre>
              </Paper>
            </Box>
          </Box>
        </>
      )}

      {!selectedTemplate && selectedComponentTemplate && (
        <>
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1 }}
          >
            <Typography variant="subtitle1">Component Template Details</Typography>
            <IconButton size="small" aria-label="Close template details" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 1, py: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              NAME
            </Typography>
            <Typography variant="body2" gutterBottom sx={{ fontFamily: "monospace" }}>
              {selectedComponentTemplate.name}
            </Typography>

            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              VERSION
            </Typography>
            <Typography variant="body2" gutterBottom>
              {selectedComponentTemplate.version}
            </Typography>

            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              INCLUDES
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
              {selectedComponentTemplate.hasMappings && (
                <Chip label="Mappings" size="small" variant="outlined" />
              )}
              {selectedComponentTemplate.hasSettings && (
                <Chip label="Settings" size="small" variant="outlined" />
              )}
              {selectedComponentTemplate.hasAliases && (
                <Chip label="Aliases" size="small" variant="outlined" />
              )}
              {!selectedComponentTemplate.hasMappings &&
                !selectedComponentTemplate.hasSettings &&
                !selectedComponentTemplate.hasAliases && (
                  <Typography variant="body2" color="text.secondary">
                    None
                  </Typography>
                )}
            </Box>

            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              USED BY
            </Typography>
            <Typography variant="body2" gutterBottom>
              {selectedComponentTemplate.usedByCount} index template
              {selectedComponentTemplate.usedByCount !== 1 ? "s" : ""}
            </Typography>
          </Box>
        </>
      )}
    </Drawer>
  );
}
