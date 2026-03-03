import { useState } from "react";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

interface InvestigateQueryBarProps {
  query: string;
}

export default function InvestigateQueryBar({ query }: InvestigateQueryBarProps) {
  const [open, setOpen] = useState(true);

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: open ? 1 : 0,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          ES|QL Query
        </Typography>
        <IconButton
          size="small"
          aria-label={open ? "Collapse query" : "Expand query"}
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>
      <Collapse in={open}>
        <Box
          component="pre"
          sx={{
            maxHeight: 120,
            overflow: "auto",
            m: 0,
            p: 1,
            borderRadius: 1,
            bgcolor: "action.hover",
            wordBreak: "break-all",
            whiteSpace: "pre-wrap",
            fontSize: "0.75rem",
            fontFamily: "monospace",
          }}
        >
          {query}
        </Box>
      </Collapse>
    </Paper>
  );
}
