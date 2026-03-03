/** Shared MUI `sx` styles for rendering markdown inside insight Alert banners. */
const insightMarkdownSx = {
  "& .MuiAlert-message": {
    fontStyle: "italic",
    "& p": { mt: 0, mb: 1 },
    "& p:last-child": { mb: 0 },
    "& ul,& ol": { mb: 1, pl: 2.5 },
    "& li": { mb: 0.5 },
    "& h1,& h2,& h3,& h4,& h5,& h6": { mt: 1, mb: 0.5 },
    "& code": {
      px: 0.5,
      borderRadius: 0.5,
      bgcolor: "action.selected",
      fontSize: "0.85em",
      fontFamily: "monospace",
    },
    "& pre": {
      overflow: "auto",
      p: 1,
      borderRadius: 1,
      bgcolor: "action.selected",
      "& code": { p: 0, bgcolor: "transparent" },
    },
  },
} as const;

export default insightMarkdownSx;
