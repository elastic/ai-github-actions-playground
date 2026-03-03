import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { FormatControls } from "@perses-dev/components";

import type { FormatOptions, VisualizationOptions, VisualizationType } from "../types";

import { getPersesPanelEntry } from "./perses/panelRegistry";

const DEFAULT_FORMAT: FormatOptions = { unit: "decimal" };

interface Props {
  vizType: VisualizationType;
  options: VisualizationOptions;
  onChange: (options: VisualizationOptions) => void;
}

/** Sectioned chart customization controls rendered below the preview. */
export default function ChartOptionsEditor({ vizType, options, onChange }: Props) {
  const format = (options as { format?: FormatOptions }).format ?? DEFAULT_FORMAT;
  const OptionsEditor = getPersesPanelEntry(vizType)?.OptionsEditor;
  // Table uses threshold-only options; format controls don't apply
  const showFormat = vizType !== "table";

  const handleFormatChange = (f: FormatOptions) => {
    onChange({ ...options, format: f });
  };

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start", p: 1.5 }}>
      {showFormat && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Format
          </Typography>
          <FormatControls value={format} onChange={handleFormatChange} />
        </Box>
      )}

      {OptionsEditor && showFormat && <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />}

      {OptionsEditor && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Options
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "flex-start" }}>
            <OptionsEditor options={options} onChange={onChange} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
