import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ReactMarkdown from "react-markdown";

interface Props {
  content: string;
}

export default function MarkdownPanel({ content }: Props) {
  if (!content.trim()) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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
        p: 1,
        overflow: "auto",
        height: "100%",
        "& h1,& h2,& h3,& h4,& h5,& h6": { mt: 1, mb: 0.5 },
        "& p": { mt: 0, mb: 1 },
        "& ul,& ol": { pl: 2.5, mb: 1 },
        "& li": { mb: 0.25 },
        "& a": { color: "primary.main" },
        "& code": {
          fontFamily: "monospace",
          fontSize: "0.85em",
          bgcolor: "action.hover",
          px: 0.5,
          borderRadius: 0.5,
        },
        "& pre": {
          bgcolor: "action.hover",
          p: 1,
          borderRadius: 1,
          overflow: "auto",
          "& code": { bgcolor: "transparent", p: 0 },
        },
        "& blockquote": {
          borderLeft: 3,
          borderColor: "divider",
          pl: 2,
          ml: 0,
          color: "text.secondary",
        },
        "& hr": { borderColor: "divider", my: 1 },
        "& table": { borderCollapse: "collapse", width: "100%", mb: 1 },
        "& th,& td": { border: 1, borderColor: "divider", px: 1, py: 0.5 },
        "& th": { bgcolor: "action.hover", fontWeight: 600 },
      }}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </Box>
  );
}
