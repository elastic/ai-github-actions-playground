import { useMemo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";

type DocSection = {
  id: string;
  title: string;
  body: string[];
};

const DOC_SECTIONS: DocSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    body: [
      "Install dependencies with make setup, then run make serve for the local app.",
      "To avoid CORS during development, run ES_URL=http://localhost:9200 make serve-proxy.",
      "Use Dashboard for panel-based visualization and Discover for ad-hoc query exploration.",
    ],
  },
  {
    id: "prerequisites",
    title: "Prerequisites",
    body: [
      "Use Node.js 18 or newer.",
      "Connect to an Elasticsearch cluster with either API key auth or username/password.",
      "If using direct browser mode, ensure Elasticsearch CORS allows your dashboard origin.",
    ],
  },
  {
    id: "connecting-to-elasticsearch",
    title: "Connecting to Elasticsearch",
    body: [
      "Open connection settings from the header and provide the Elasticsearch URL.",
      "Choose API Key or Username/Password authentication.",
      "Credentials are kept in session storage while URL and dashboard state are persisted locally.",
    ],
  },
  {
    id: "proxy-mode",
    title: "Running with a Proxy",
    body: [
      "Proxy mode avoids CORS by routing /_query through the local dev server or Docker nginx.",
      "When serving locally with proxy enabled, use http://localhost:3000 as the Elasticsearch URL in the app.",
      "For Docker runs, open http://localhost:8080 and connect to that same URL.",
    ],
  },
  {
    id: "dashboard-workflow",
    title: "Dashboard Workflow",
    body: [
      "Add, resize, and arrange panels in the grid layout.",
      "Use panel editor to write ES|QL, choose a visualization type, and configure chart options.",
      "Export dashboards as JSON and import them later from the overflow menu.",
    ],
  },
  {
    id: "discover-workflow",
    title: "Discover Workflow",
    body: [
      "Run ES|QL queries and inspect tabular results.",
      "Use field filters and column selectors to focus the result set.",
      "Create a dashboard panel directly from a Discover query.",
    ],
  },
  {
    id: "testing-and-quality",
    title: "Testing and Quality",
    body: [
      "Run make lint for formatting, eslint, and type-check validation.",
      "Run make test for integration tests against a temporary Elasticsearch container.",
      "Run make build to validate a production bundle before shipping.",
    ],
  },
];

function normalizeText(text: string): string {
  return text.toLowerCase();
}

export default function DocsPage() {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<string>(DOC_SECTIONS[0]?.id ?? "");

  const filteredSections = useMemo(() => {
    const query = normalizeText(search.trim());
    if (!query) return DOC_SECTIONS;
    return DOC_SECTIONS.filter((section) =>
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
