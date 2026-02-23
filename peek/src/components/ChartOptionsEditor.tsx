import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { FormatControls } from "@perses-dev/components";

import type { FormatOptions, VisualizationOptions, VisualizationType } from "../types";

import { getVizEntry } from "./visualizations/vizRegistry";

const DEFAULT_FORMAT: FormatOptions = { unit: "decimal" };

interface Props {
  vizType: VisualizationType;
  options: VisualizationOptions;
  onChange: (options: VisualizationOptions) => void;
}

/** Horizontal row of chart customization controls rendered below the preview. */
export default function ChartOptionsEditor({ vizType, options, onChange }: Props) {
  const format = (options as { format?: FormatOptions }).format ?? DEFAULT_FORMAT;
  const OptionsEditor = getVizEntry(vizType)?.OptionsEditor;
  // Table uses threshold-only options; format controls don't apply
  const showFormat = vizType !== "table";

  const handleFormatChange = (f: FormatOptions) => {
    onChange({ ...options, format: f });
  };

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 2, p: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, mt: 1 }}>
        Options
      </Typography>

      {showFormat && <FormatControls value={format} onChange={handleFormatChange} />}

      {OptionsEditor && showFormat && <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />}

      {OptionsEditor && <OptionsEditor options={options} onChange={onChange} />}
    </Box>
  );
}
