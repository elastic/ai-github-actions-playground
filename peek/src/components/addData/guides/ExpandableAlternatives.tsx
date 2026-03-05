import type { ReactNode } from "react";
import { useState } from "react";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Stack from "@mui/material/Stack";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

interface ExpandableAlternativesProps {
  idPrefix: string;
  /** Label when collapsed (e.g. "Other collector options", "Show other options"). */
  label: string;
  /** Label when expanded (e.g. "Hide other collector options"). */
  expandedLabel: string;
  /** Optional icon before the label. */
  startIcon?: ReactNode;
  children: ReactNode;
}

/**
 * Reusable expandable section for non-preferred alternatives.
 * Uses the same outlined-button pattern as "Other collector options" on Linux host.
 */
export default function ExpandableAlternatives({
  idPrefix,
  label,
  expandedLabel,
  startIcon,
  children,
}: ExpandableAlternativesProps) {
  const [open, setOpen] = useState(false);
  const contentId = `${idPrefix}-alternatives`;

  return (
    <Stack spacing={1}>
      <Button
        size="small"
        variant="outlined"
        color="primary"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={contentId}
        endIcon={
          <ExpandMoreIcon
            fontSize="small"
            sx={{
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
        }
        sx={{ alignSelf: "flex-start" }}
        startIcon={startIcon}
      >
        {open ? expandedLabel : label}
      </Button>
      <Collapse in={open}>
        <Stack id={contentId} spacing={1}>
          {children}
        </Stack>
      </Collapse>
    </Stack>
  );
}
