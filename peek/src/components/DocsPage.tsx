import { useMemo, useState, useCallback, useEffect } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseAsString, useQueryState } from "nuqs";

import sections from "../docs/sections";

import AskAiButton from "./AskAiButton";
import DocsNavSidebar from "./DocsNavSidebar";
import { useEasterEggStore } from "../store/useEasterEggStore";

function normalizeText(text: string): string {
  return text.toLowerCase();
}

/** Markdown styles consistent with ChatMessageContent and MarkdownPanel. */
const docsMarkdownSx = {
  "& a": { color: "primary.main" },
  "& blockquote": {
    ml: 0,
    pl: 2,
    borderLeft: 3,
    borderColor: "divider",
    color: "text.secondary",
  },
  "& code": {
    px: 0.5,
    borderRadius: 0.5,
    bgcolor: "action.selected",
    fontSize: "0.85em",
    fontFamily: "monospace",
  },
  "& h2": { mt: 2, mb: 1 },
  "& h3": { mt: 1.5, mb: 0.5 },
  "& hr": { my: 1, borderColor: "divider" },
  "& li": { mb: 0.5 },
  "& p": { mt: 0, mb: 1, color: "text.secondary" },
  "& p:last-child": { mb: 0 },
  "& pre": {
    overflow: "auto",
    p: 1,
    borderRadius: 1,
    bgcolor: "action.selected",
    "& code": { p: 0, bgcolor: "transparent" },
  },
  "& table": { width: "100%", mb: 1, borderCollapse: "collapse" },
  "& th": { bgcolor: "action.selected", fontWeight: 600 },
  "& th,& td": { py: 0.5, px: 1, border: 1, borderColor: "divider", fontSize: "0.875rem" },
  "& ul,& ol": { mb: 1, pl: 2.5 },
} as const;

export default function DocsPage() {
  const [search, setSearch] = useState("");
  const easterEggMode = useEasterEggStore((s) => s.easterEggMode);
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

  const isSearching = search.trim().length > 0;

  return (
    <Box sx={{ display: "flex", flex: 1, gap: 1.5, minHeight: 0 }}>
      <Paper
        variant="outlined"
        sx={{ display: "flex", flexShrink: 0, flexDirection: "column", gap: 1, width: 320, p: 1.5 }}
      >
        <Typography variant="h5" component="h1">
          Docs
        </Typography>
        {easterEggMode && (
          <Alert severity="info">
            Easter Egg mode is enabled. Open the "Easter Egg Mode" docs section for quest flow and
            narrative guide.
          </Alert>
        )}
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
          <DocsNavSidebar
            filteredSections={filteredSections}
            activeSection={activeSection}
            isSearching={isSearching}
            onJumpToSection={jumpToSection}
          />
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
            <Box sx={{ ...docsMarkdownSx, typography: "body2" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.body.join("\n\n")}</ReactMarkdown>
            </Box>
            <Divider sx={{ mt: 2 }} />
          </Box>
        ))}
      </Paper>
    </Box>
  );
}
