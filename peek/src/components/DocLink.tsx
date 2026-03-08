import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import MenuBookIcon from "@mui/icons-material/MenuBook";

interface DocLinkProps {
  /** The doc section ID to link to (e.g. "connecting", "dashboard-workflow"). */
  section: string;
  /** Tooltip text shown on hover. Defaults to "View docs". */
  tooltip?: string;
}

/**
 * A small icon button that navigates to the Docs page for a specific section.
 * Use this in page headers and toolbars to provide contextual help links.
 */
export default function DocLink({ section, tooltip = "View docs" }: DocLinkProps) {
  const navigate = useNavigate();

  const handleClick = useCallback(() => {
    void navigate(`/docs?section=${encodeURIComponent(section)}`);
  }, [navigate, section]);

  return (
    <Tooltip title={tooltip}>
      <IconButton size="small" onClick={handleClick} aria-label={tooltip}>
        <MenuBookIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
