import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import EditIcon from "@mui/icons-material/Edit";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import DeleteIcon from "@mui/icons-material/Delete";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

import type { DashboardDefinition } from "../types";

interface DashboardCardMenuProps {
  anchorEl: HTMLElement | null;
  dashboard: DashboardDefinition | null;
  confirmDeleteId: string | null;
  disableDelete: boolean;
  onClose: () => void;
  onRename: () => void;
  onEditDetails: () => void;
  onDuplicate: () => void;
  onArchiveToggle: () => void;
  onExport: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
}

export default function DashboardCardMenu({
  anchorEl,
  dashboard,
  confirmDeleteId,
  disableDelete,
  onClose,
  onRename,
  onEditDetails,
  onDuplicate,
  onArchiveToggle,
  onExport,
  onDelete,
  onCancelDelete,
}: DashboardCardMenuProps) {
  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
      <MenuItem onClick={onRename}>
        <ListItemIcon>
          <EditIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Rename</ListItemText>
      </MenuItem>
      <MenuItem onClick={onEditDetails}>
        <ListItemIcon>
          <InfoOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Edit details</ListItemText>
      </MenuItem>
      <MenuItem onClick={onDuplicate}>
        <ListItemIcon>
          <ContentCopyIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Duplicate</ListItemText>
      </MenuItem>
      <MenuItem onClick={onArchiveToggle}>
        <ListItemIcon>
          {dashboard?.archived ? (
            <UnarchiveIcon fontSize="small" />
          ) : (
            <ArchiveIcon fontSize="small" />
          )}
        </ListItemIcon>
        <ListItemText>{dashboard?.archived ? "Unarchive" : "Archive"}</ListItemText>
      </MenuItem>
      <MenuItem onClick={onExport}>
        <ListItemIcon>
          <FileDownloadIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Export</ListItemText>
      </MenuItem>
      <Divider />
      {confirmDeleteId === dashboard?.id ? (
        <Box sx={{ display: "flex", gap: 1, py: 1, px: 2 }}>
          <Button size="small" color="error" variant="contained" onClick={onDelete}>
            Confirm Delete
          </Button>
          <Button size="small" onClick={onCancelDelete}>
            Cancel
          </Button>
        </Box>
      ) : (
        <MenuItem onClick={onDelete} disabled={disableDelete} sx={{ color: "error.main" }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      )}
    </Menu>
  );
}
