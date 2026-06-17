import { useMemo, useState, useCallback, useEffect, useRef } from "react";
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
    color: "text.primary",
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
    "&:focus-visible": {
      outline: "2px solid",
      outlineColor: "primary.main",
    },
    "& code": { p: 0, bgcolor: "transparent" },
  },
  "& table": { width: "100%", mb: 1, borderCollapse: "collapse" },
  "& th": { bgcolor: "action.selected", fontWeight: 600 },
  "& th,& td": { py: 0.5, px: 1, border: 1, borderColor: "divider", fontSize: "0.875rem" },
  "& ul,& ol": { mb: 1, pl: 2.5 },
} as const;

/** Custom ReactMarkdown components for accessible rendering. */
const markdownComponents = {
  pre: ({ children, ...props }: React.ComponentPropsWithoutRef<"pre">) => (
    <pre tabIndex={0} {...props}>
      {children}
    </pre>
  ),
};

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

  const contentRef = useRef<HTMLDivElement>(null);
  const isJumpingRef = useRef(false);
  // Tracks the set of currently-intersecting section IDs across observer callbacks
  const visibleSectionsRef = useRef<Set<string>>(new Set());

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
      isJumpingRef.current = true;
      void setSectionFromUrl(sectionId);
      const target = document.getElementById(sectionId);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      // Allow observer updates again after smooth scroll completes
      setTimeout(() => {
        isJumpingRef.current = false;
      }, 800);
    },
    [setSectionFromUrl],
  );

  // Scroll to the section specified by the URL param on initial mount only.
  // Observer-driven updates should NOT trigger scrolling (that would cause snapping).
  const initialSectionRef = useRef(sectionFromUrl);
  useEffect(() => {
    if (initialSectionRef.current) {
      const target = document.getElementById(initialSectionRef.current);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track which section is currently visible and update the active section
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const sectionIds = filteredSections.map((s) => s.id);
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    // Reset visible set when observer is (re-)created
    visibleSectionsRef.current = new Set();

    const observer = new IntersectionObserver(
      (entries) => {
        if (isJumpingRef.current) return;

        // Maintain a running set of all currently-intersecting section IDs
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSectionsRef.current.add(entry.target.id);
          } else {
            visibleSectionsRef.current.delete(entry.target.id);
          }
        }

        // Pick the topmost visible section by DOM order (sectionIds is in document order)
        const topVisibleId = sectionIds.find((id) => visibleSectionsRef.current.has(id));
        if (topVisibleId) {
          void setSectionFromUrl(topVisibleId);
        }
      },
      { root: container, rootMargin: "0px 0px -60% 0px", threshold: 0 },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [filteredSections, setSectionFromUrl]);

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
        ref={contentRef}
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
            <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
              {section.title}
            </Typography>
            <Box sx={{ ...docsMarkdownSx, typography: "body2" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {section.body.join("\n\n")}
              </ReactMarkdown>
            </Box>
            <Divider sx={{ mt: 2 }} />
          </Box>
        ))}
      </Paper>
    </Box>
  );
}
