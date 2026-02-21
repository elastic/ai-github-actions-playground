import { useMemo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import sections from "../docs/sections";

function normalizeText(text: string): string {
  return text.toLowerCase();
}

export default function DocsPage() {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id ?? "");

  const filteredSections = useMemo(() => {
    const query = normalizeText(search.trim());
    if (!query) return sections;
    return sections.filter((section) =>
      normalizeText(`${section.title} ${section.body.join(" ")}`).includes(query),
    );
  }, [search]);

  const jumpToSection = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
    const target = document.getElementById(sectionId);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <Box sx={{ display: "flex", flex: 1, minHeight: 0, gap: 1.5 }}>
      <Paper
        variant="outlined"
        sx={{ width: 320, flexShrink: 0, p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          Docs
        </Typography>
        <TextField
          size="small"
          label="Search docs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by topic or keyword"
        />
        <Divider />
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, overflowY: "auto" }}>
          {filteredSections.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No sections match your search.
            </Typography>
          ) : (
            filteredSections.map((section) => (
              <Button
                key={section.id}
                size="small"
                variant={activeSection === section.id ? "contained" : "text"}
                onClick={() => jumpToSection(section.id)}
                sx={{ justifyContent: "flex-start", textTransform: "none" }}
              >
                {section.title}
              </Button>
            ))
          )}
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ flex: 1, p: 2, overflowY: "auto" }}>
        {filteredSections.map((section) => (
          <Box key={section.id} id={section.id} sx={{ mb: 3, scrollMarginTop: 16 }}>
            {section.image && (
              <Box
                component="img"
                src={section.image}
                alt={section.title}
                sx={{ width: 120, height: 120, objectFit: "contain", mb: 1.5 }}
              />
            )}
            <Typography variant="h6" sx={{ mb: 1 }}>
              {section.title}
            </Typography>
            {section.body.map((paragraph) => (
              <Typography key={paragraph} variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {paragraph}
              </Typography>
            ))}
            <Divider sx={{ mt: 2 }} />
          </Box>
        ))}
      </Paper>
    </Box>
  );
}
