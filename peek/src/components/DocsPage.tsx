import { useMemo, useState, useCallback, useEffect } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import { parseAsString, useQueryState } from "nuqs";

import sections from "../docs/sections";

import EmptyState from "./EmptyState";
import AskAiButton from "./AskAiButton";

function normalizeText(text: string): string {
  return text.toLowerCase();
}

export default function DocsPage() {
  const [search, setSearch] = useState("");
  const [question, setQuestion] = useState("");
  const [sectionFromUrl, setSectionFromUrl] = useQueryState(
    "section",
    parseAsString.withOptions({ history: "replace" }),
  );

  // Active section is always URL-driven so sidebar and URL stay in sync
  const activeSection = sectionFromUrl ?? sections[0]?.id ?? "";

  const filteredSections = useMemo(() => {
    const query = normalizeText(search.trim());
    if (!query) return sections;
    return sections.filter((section) =>
      normalizeText(`${section.title} ${section.body.join(" ")}`).includes(query),
    );
  }, [search]);
  const docsContextSnippet = useMemo(
    () =>
      filteredSections
        .slice(0, 8)
        .map((section) => `${section.title}: ${section.body.join(" ").slice(0, 400)}`)
        .join("\n\n"),
    [filteredSections],
  );

  const jumpToSection = useCallback(
    (sectionId: string) => {
      void setSectionFromUrl(sectionId);
      const target = document.getElementById(sectionId);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [setSectionFromUrl],
  );

  // Scroll to the section specified by the URL param (DOM-only side-effect, no setState)
  useEffect(() => {
    if (sectionFromUrl) {
      const target = document.getElementById(sectionFromUrl);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [sectionFromUrl]);

  return (
    <Box sx={{ display: "flex", flex: 1, gap: 1.5, minHeight: 0 }}>
      <Paper
        variant="outlined"
        sx={{ display: "flex", flexShrink: 0, flexDirection: "column", gap: 1, width: 320, p: 1.5 }}
      >
        <Typography variant="h5" component="h1">
          Docs
        </Typography>
        <TextField
          size="small"
          label="Search docs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by topic or keyword"
        />
        <TextField
          size="small"
          label="Ask a question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="How do I..."
        />
        {question.trim() && (
          <AskAiButton
            label="Answer from docs"
            prompt={`Answer this question using Elastic Peek docs and cite relevant section titles: "${question.trim()}".\n\nCandidate sections:\n${docsContextSnippet}`}
          />
        )}
        <Divider />
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, overflowY: "auto" }}>
          {filteredSections.length === 0 ? (
            <EmptyState size="small" heading="No results" description="Try a different keyword" />
          ) : (
            filteredSections.map((section) => (
              <Button
                key={section.id}
                size="small"
                variant={activeSection === section.id ? "contained" : "text"}
                onClick={() => jumpToSection(section.id)}
                sx={{
                  justifyContent: "flex-start",
                  color: activeSection === section.id ? undefined : "text.secondary",
                  textTransform: "none",
                  fontWeight: activeSection === section.id ? 600 : 400,
                }}
              >
                {section.title}
              </Button>
            ))
          )}
        </Box>
      </Paper>

      <Paper
        variant="outlined"
        role="region"
        aria-label="Documentation content"
        tabIndex={0}
        sx={{ flex: 1, overflowY: "auto", p: 2 }}
      >
        {filteredSections.map((section) => (
          <Box key={section.id} id={section.id} sx={{ mb: 3, scrollMarginTop: 16 }}>
            {section.image && (
              <Box
                component="img"
                src={section.image}
                alt={section.title}
                sx={{ width: 120, height: 120, mb: 1.5, objectFit: "contain" }}
              />
            )}
            <Typography variant="h6" sx={{ mb: 1 }}>
              {section.title}
            </Typography>
            {section.body.map((paragraph) => {
              const h3Match = paragraph.match(/^### (.+)$/);
              if (h3Match) {
                return (
                  <Typography
                    key={paragraph}
                    variant="body2"
                    fontWeight={600}
                    sx={{ mt: 1.5, mb: 0.5 }}
                  >
                    {h3Match[1]}
                  </Typography>
                );
              }
              const h2Match = paragraph.match(/^## (.+)$/);
              if (h2Match) {
                return (
                  <Typography
                    key={paragraph}
                    variant="subtitle1"
                    fontWeight={600}
                    sx={{ mt: 2, mb: 1 }}
                  >
                    {h2Match[1]}
                  </Typography>
                );
              }
              return (
                <Typography key={paragraph} variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {paragraph}
                </Typography>
              );
            })}
            <Divider sx={{ mt: 2 }} />
          </Box>
        ))}
      </Paper>
    </Box>
  );
}
