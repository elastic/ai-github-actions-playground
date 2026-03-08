import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import type { useSimulatedIndexTemplate } from "../hooks/useTemplates";
import type { ComponentTemplateRow, IndexTemplateRow } from "../services/es";

import DetailSurface from "./DetailSurface";

interface JsonViewerProps {
  content?: unknown;
  maxHeight: number;
  children?: React.ReactNode;
}

function JsonViewer({ content, maxHeight, children }: JsonViewerProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1, maxHeight, overflow: "auto", fontSize: "0.75rem" }}>
      {children ?? (
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {JSON.stringify(content ?? {}, null, 2)}
        </pre>
      )}
    </Paper>
  );
}

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
  const title = selectedTemplate ? "Template Details" : "Component Template Details";

  return (
    <DetailSurface
      open={Boolean(selectedTemplate || selectedComponentTemplate)}
      onClose={onClose}
      title={title}
      bodySx={{ px: 1, py: 1 }}
    >
      {selectedTemplate && (
        <>
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
            <JsonViewer
              maxHeight={260}
              content={simulatedTemplate.status === "success" ? simulatedTemplate.data : {}}
            >
              {simulatedTemplate.status === "loading" ? (
                <LinearProgress />
              ) : simulatedTemplate.status === "error" ? (
                <Typography variant="body2" color="error">
                  {simulatedTemplate.error}
                </Typography>
              ) : null}
            </JsonViewer>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              RAW JSON
            </Typography>
            <JsonViewer maxHeight={300} content={selectedTemplate.raw ?? selectedTemplate} />
          </Box>
        </>
      )}

      {!selectedTemplate && selectedComponentTemplate && (
        <>
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

          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              RAW JSON
            </Typography>
            <JsonViewer maxHeight={300} content={selectedComponentTemplate} />
          </Box>
        </>
      )}
    </DetailSurface>
  );
}
