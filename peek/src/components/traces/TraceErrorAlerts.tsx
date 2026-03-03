import { useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";

import { summarizeError } from "./traceUtils";

/** Renders non-blocking, collapsible error alerts for trace queries. */
export default function TraceErrorAlerts({ errors }: { errors: (string | null)[] }) {
  const [expanded, setExpanded] = useState(false);
  const activeErrors = [...new Set(errors.filter((e): e is string => e != null))];
  const summaries = [...new Set(activeErrors.map((error) => summarizeError(error)))];
  if (activeErrors.length === 0) return null;

  return (
    <Alert
      severity="error"
      sx={{ position: "relative", zIndex: 0, pointerEvents: "auto" }}
      action={
        <Button
          color="inherit"
          size="small"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide details" : "Show details"}
        </Button>
      }
    >
      <AlertTitle>Query error</AlertTitle>
      {summaries.join(" ")}
      <Collapse in={expanded}>
        <Box
          component="pre"
          sx={{
            maxHeight: 200,
            overflow: "auto",
            mt: 1,
            p: 1,
            borderRadius: 1,
            bgcolor: "action.hover",
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
            fontSize: "0.75rem",
          }}
        >
          {activeErrors.join("\n\n")}
        </Box>
      </Collapse>
    </Alert>
  );
}
