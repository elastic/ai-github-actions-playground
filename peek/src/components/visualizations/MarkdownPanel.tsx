import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { DashboardParameter, ElasticsearchConnection, TimeRange } from "../../types";
import { useMarkdownEsql } from "../../hooks/useMarkdownEsql";

interface Props {
  content: string;
  /** Elasticsearch connection — needed only when content has `${esql}` blocks. */
  connection?: ElasticsearchConnection | null;
  /** Dashboard time range — forwarded to embedded ES|QL queries. */
  timeRange?: TimeRange;
  /** Dashboard parameters — used for `{{param}}` interpolation and ES|QL params. */
  parameters?: DashboardParameter[];
}

export default function MarkdownPanel({ content, connection, timeRange, parameters }: Props) {
  const resolved = useMarkdownEsql({
    content,
    connection: connection ?? null,
    timeRange,
    parameters,
  });

  if (!resolved.trim()) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          No content
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: "100%",
        overflow: "auto",
        p: 1,
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
          bgcolor: "action.hover",
          fontSize: "0.85em",
          fontFamily: "monospace",
        },
        "& h1,& h2,& h3,& h4,& h5,& h6": { mt: 1, mb: 0.5 },
        "& hr": { my: 1, borderColor: "divider" },
        "& li": { mb: 0.25 },
        "& p": { mt: 0, mb: 1 },
        "& pre": {
          overflow: "auto",
          p: 1,
          borderRadius: 1,
          bgcolor: "action.hover",
          "& code": { p: 0, bgcolor: "transparent" },
        },
        "& table": { width: "100%", mb: 1, borderCollapse: "collapse" },
        "& th": { bgcolor: "action.hover", fontWeight: 600 },
        "& th,& td": { py: 0.5, px: 1, border: 1, borderColor: "divider" },
        "& ul,& ol": { mb: 1, pl: 2.5 },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{resolved}</ReactMarkdown>
    </Box>
  );
}
