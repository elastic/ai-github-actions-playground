import { useState } from "react";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";

import { CELL_TRUNCATE_LENGTH } from "./dataTableUtils";

export default function TruncatedCell({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = value.length > CELL_TRUNCATE_LENGTH;
  if (!needsTruncation) return <>{value}</>;
  return (
    <span>
      <Tooltip title={expanded ? "" : value}>
        <span>{expanded ? value : value.slice(0, CELL_TRUNCATE_LENGTH) + "…"}</span>
      </Tooltip>
      <Button
        size="small"
        variant="text"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
          }
        }}
        aria-label={expanded ? "Collapse cell value" : "Expand cell value"}
        sx={{ verticalAlign: "baseline", minWidth: 0, ml: 0.5, p: 0, fontSize: "0.7rem" }}
      >
        {expanded ? "less" : "more"}
      </Button>
    </span>
  );
}
