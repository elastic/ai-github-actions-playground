import { memo } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";

import type { DashboardDefinition } from "../types";

interface DashboardCardProps {
  entry: DashboardDefinition;
  isActive: boolean;
  selectedTags: string[];
  onNavigate: (id: string) => void;
  onOpenMenu: (event: React.MouseEvent<HTMLElement>, entry: DashboardDefinition) => void;
  onToggleFavorite: (event: React.MouseEvent<HTMLElement>, id: string) => void;
  onToggleTag: (tag: string) => void;
}

export default memo(function DashboardCard({
  entry,
  isActive,
  selectedTags,
  onNavigate,
  onOpenMenu,
  onToggleFavorite,
  onToggleTag,
}: DashboardCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        position: "relative",
        opacity: entry.archived ? 0.6 : 1,
        ...(isActive && {
          borderWidth: 2,
          borderColor: "primary.main",
        }),
      }}
    >
      <CardActionArea onClick={() => onNavigate(entry.id)}>
        <CardContent sx={{ pb: 1 }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.5, pr: 6 }}>
            <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 600 }} noWrap>
              {entry.title}
            </Typography>
            {isActive && <Chip label="Active" size="small" color="primary" />}
            {entry.archived && <Chip label="Archived" size="small" variant="outlined" />}
          </Box>
          {entry.description && (
            <Typography
              variant="body2"
              color="text.primary"
              sx={{
                display: "-webkit-box",
                overflow: "hidden",
                mb: 1,
                textOverflow: "ellipsis",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
              }}
            >
              {entry.description}
            </Typography>
          )}
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="caption" color="text.primary">
              {entry.panels.length} panel{entry.panels.length !== 1 ? "s" : ""}
            </Typography>
            <Typography variant="caption" color="text.primary">
              Updated {new Date(entry.updatedAt).toLocaleDateString()}
            </Typography>
          </Stack>
          {entry.tags && entry.tags.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              {entry.tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  variant={selectedTags.includes(tag) ? "filled" : "outlined"}
                  color={selectedTags.includes(tag) ? "primary" : "default"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTag(tag);
                  }}
                  aria-label={`Filter by tag ${tag}`}
                  aria-pressed={selectedTags.includes(tag)}
                />
              ))}
            </Stack>
          )}
        </CardContent>
      </CardActionArea>
      <IconButton
        size="small"
        sx={{ position: "absolute", top: 8, right: 8 }}
        onClick={(e) => onOpenMenu(e, entry)}
        aria-label={`Actions for ${entry.title}`}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Tooltip title={entry.favoritedAt ? "Remove from favorites" : "Add to favorites"}>
        <IconButton
          size="small"
          sx={{ position: "absolute", top: 8, right: 36 }}
          onClick={(e) => onToggleFavorite(e, entry.id)}
          aria-label={
            entry.favoritedAt
              ? `Remove ${entry.title} from favorites`
              : `Add ${entry.title} to favorites`
          }
          aria-pressed={Boolean(entry.favoritedAt)}
        >
          {entry.favoritedAt ? (
            <StarIcon fontSize="small" color="warning" />
          ) : (
            <StarBorderIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    </Card>
  );
});
