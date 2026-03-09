import { useState, useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import sections, { type DocSection } from "../docs/sections";

import EmptyState from "./EmptyState";

/** Navigation groups for the docs sidebar. */
interface NavGroup {
  label: string;
  sectionIds: string[];
}

export const NAV_GROUPS: NavGroup[] = [
  { label: "Getting Started", sectionIds: ["about", "connecting", "cors", "proxy-mode"] },
  {
    label: "Observability",
    sectionIds: [
      "metrics-workflow",
      "logs-workflow",
      "traces-workflow",
      "service-performance",
      "profiling-workflow",
    ],
  },
  {
    label: "Features",
    sectionIds: [
      "dashboard-workflow",
      "discover-workflow",
      "visualizations",
      "keyboard-shortcuts",
      "console",
      "data-streams",
      "dashboard-management",
    ],
  },
  { label: "AI Features", sectionIds: ["chat", "llm-settings"] },
  {
    label: "Cluster Admin",
    sectionIds: [
      "cluster-overview",
      "cluster-health",
      "indices",
      "ingest-pipelines",
      "add-data",
      "ilm",
      "templates",
      "transforms",
      "snapshots",
      "storage-explorer",
      "watcher",
      "tasks",
      "investigate",
    ],
  },
  {
    label: "Infrastructure",
    sectionIds: ["fleet", "kubernetes", "hosts", "nodes"],
  },
  { label: "Security", sectionIds: ["users-roles", "api-keys"] },
];

if (import.meta.env.DEV) {
  const knownIds = new Set(sections.map((s) => s.id));
  for (const group of NAV_GROUPS) {
    for (const id of group.sectionIds) {
      if (!knownIds.has(id)) {
        console.warn(`DocsNavSidebar: unknown sectionId "${id}" in group "${group.label}"`);
      }
    }
  }
}

interface DocsNavSidebarProps {
  filteredSections: DocSection[];
  activeSection: string;
  isSearching: boolean;
  onJumpToSection: (sectionId: string) => void;
}

export default function DocsNavSidebar({
  filteredSections,
  activeSection,
  isSearching,
  onJumpToSection,
}: DocsNavSidebarProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const filteredSectionIds = useMemo(
    () => new Set(filteredSections.map((s) => s.id)),
    [filteredSections],
  );
  // `sections` is a module-level import, so this never needs recomputation.
  const sectionById = useMemo(() => {
    const map = new Map<string, DocSection>();
    for (const s of sections) map.set(s.id, s);
    return map;
  }, []);

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  if (filteredSections.length === 0) {
    return <EmptyState size="small" heading="No results" description="Try a different keyword" />;
  }

  if (isSearching) {
    return (
      <>
        {filteredSections.map((section) => (
          <Button
            key={section.id}
            size="small"
            variant={activeSection === section.id ? "contained" : "text"}
            aria-current={activeSection === section.id ? "location" : undefined}
            onClick={() => onJumpToSection(section.id)}
            sx={{
              justifyContent: "flex-start",
              color: activeSection === section.id ? undefined : "text.secondary",
              textTransform: "none",
              fontWeight: activeSection === section.id ? 600 : 400,
            }}
          >
            {section.title}
          </Button>
        ))}
      </>
    );
  }

  return (
    <>
      {NAV_GROUPS.map((group) => {
        const visibleIds = group.sectionIds.filter((id) => filteredSectionIds.has(id));
        if (visibleIds.length === 0) return null;
        const isCollapsed = collapsedGroups[group.label] ?? false;
        const groupId = `docs-nav-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`;
        return (
          <Box key={group.label}>
            <ButtonBase
              onClick={() => toggleGroup(group.label)}
              aria-expanded={!isCollapsed}
              aria-controls={groupId}
              sx={{
                display: "flex",
                width: "100%",
                justifyContent: "space-between",
                alignItems: "center",
                py: 0.5,
                px: 1,
                borderRadius: 1,
                "&:hover": { bgcolor: "action.hover" },
                "&.Mui-focusVisible": {
                  boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}`,
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "text.secondary",
                }}
              >
                {group.label}
              </Typography>
              <ExpandMoreIcon
                sx={{
                  fontSize: 16,
                  color: "text.secondary",
                  transition: "transform 150ms ease",
                  transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                }}
              />
            </ButtonBase>
            <Collapse id={groupId} in={!isCollapsed} timeout={150}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, pl: 1 }}>
                {visibleIds.map((id) => {
                  const section = sectionById.get(id);
                  if (!section) return null;
                  return (
                    <Button
                      key={id}
                      size="small"
                      variant={activeSection === id ? "contained" : "text"}
                      aria-current={activeSection === id ? "location" : undefined}
                      onClick={() => onJumpToSection(id)}
                      sx={{
                        justifyContent: "flex-start",
                        color: activeSection === id ? undefined : "text.secondary",
                        textTransform: "none",
                        fontWeight: activeSection === id ? 600 : 400,
                        fontSize: "0.8rem",
                      }}
                    >
                      {section.title}
                    </Button>
                  );
                })}
              </Box>
            </Collapse>
          </Box>
        );
      })}
    </>
  );
}
