import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CategoryIcon from "@mui/icons-material/Category";
import DnsIcon from "@mui/icons-material/Dns";
import TagIcon from "@mui/icons-material/Tag";

import type { GroupBy } from "./storageExplorerTreeUtils";

const GROUP_BY_META: Record<
  GroupBy,
  { label: string; icon: ReactNode; ariaLabel: string; description: string; emptyLabel: string }
> = {
  instance: {
    label: "Instance",
    description:
      "Explore storage by Elasticsearch node first, then drill into telemetry and indices.",
    icon: <DnsIcon fontSize="small" />,
    ariaLabel: "Group by instance",
    emptyLabel: "No instance examples yet",
  },
  type: {
    label: "Type",
    description: "Explore your storage based on telemetry type (logs, metrics, or traces).",
    icon: <CategoryIcon fontSize="small" />,
    ariaLabel: "Group by type",
    emptyLabel: "No telemetry type examples yet",
  },
  namespace: {
    label: "Namespace",
    description: "Explore storage by namespace so environments and tenants are easy to compare.",
    icon: <TagIcon fontSize="small" />,
    ariaLabel: "Group by namespace",
    emptyLabel: "No namespace examples yet",
  },
};

interface StorageExplorerGroupChooserProps {
  chooserPreviews: Record<GroupBy, string[]>;
  onSelectGroupBy: (groupBy: GroupBy) => void;
}

function GroupByChoiceButton({
  groupBy,
  previewValues,
  onSelect,
}: {
  groupBy: GroupBy;
  previewValues: string[];
  onSelect: (groupBy: GroupBy) => void;
}) {
  const meta = GROUP_BY_META[groupBy];

  return (
    <Button
      variant="outlined"
      size="large"
      onClick={() => onSelect(groupBy)}
      aria-label={meta.ariaLabel}
      startIcon={meta.icon}
      sx={{
        minHeight: 120,
        p: 1.5,
        justifyContent: "flex-start",
        width: { xs: "100%", sm: "auto" },
        flex: { sm: "1 1 260px" },
        textAlign: "left",
        textTransform: "none",
        color: "text.primary",
        bgcolor: "background.paper",
        borderColor: "border.subtle",
        "&:hover": {
          bgcolor: "action.hover",
          borderColor: "text.secondary",
        },
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {meta.label}
        </Typography>
        <Typography variant="caption" sx={{ textTransform: "none", lineHeight: 1.25 }}>
          {meta.description}
        </Typography>
        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
          {previewValues.length > 0 ? (
            previewValues.map((value) => (
              <Chip
                key={`preview-${groupBy}-${value}`}
                size="small"
                label={value}
                sx={{
                  height: 18,
                  bgcolor: "action.selected",
                  color: "text.primary",
                  border: 1,
                  borderColor: "border.subtle",
                }}
              />
            ))
          ) : (
            <Typography variant="caption" sx={{ textTransform: "none", opacity: 0.9 }}>
              {meta.emptyLabel}
            </Typography>
          )}
        </Stack>
      </Box>
    </Button>
  );
}

export default function StorageExplorerGroupChooser({
  chooserPreviews,
  onSelectGroupBy,
}: StorageExplorerGroupChooserProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1, minHeight: 0, overflow: "auto" }}>
      <Typography variant="h6" component="h2" gutterBottom>
        How would you like to slice it?
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Pick how you want to start the storage tree. You can change this from the controls above the
        table.
      </Typography>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        sx={{ mt: 2 }}
      >
        <GroupByChoiceButton
          groupBy="instance"
          previewValues={chooserPreviews.instance}
          onSelect={onSelectGroupBy}
        />
        <GroupByChoiceButton
          groupBy="type"
          previewValues={chooserPreviews.type}
          onSelect={onSelectGroupBy}
        />
        <GroupByChoiceButton
          groupBy="namespace"
          previewValues={chooserPreviews.namespace}
          onSelect={onSelectGroupBy}
        />
      </Stack>
    </Paper>
  );
}
