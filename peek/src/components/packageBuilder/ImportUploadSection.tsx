import { useRef } from "react";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import UploadFileIcon from "@mui/icons-material/UploadFile";

const DASHED_BUTTON_SX = {
  border: "2px dashed",
  borderColor: "divider",
  borderRadius: 2,
  p: 3,
  textAlign: "center",
  "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
  textTransform: "none",
} as const;

interface Props {
  onZipUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFolderUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ImportUploadSection({ onZipUpload, onFolderUpload }: Props) {
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        or upload from disk
      </Typography>

      <Button
        variant="outlined"
        fullWidth
        sx={DASHED_BUTTON_SX}
        onClick={() => zipInputRef.current?.click()}
      >
        <UploadFileIcon sx={{ fontSize: 40, color: "action.active", mb: 1 }} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Upload .zip file
        </Typography>
        <Typography variant="caption" color="text.secondary">
          A zip archive containing the package directory
        </Typography>
      </Button>

      <Typography variant="body2" color="text.secondary" textAlign="center">
        or
      </Typography>

      <Button
        variant="outlined"
        fullWidth
        sx={DASHED_BUTTON_SX}
        onClick={() => folderInputRef.current?.click()}
      >
        <FolderOpenIcon sx={{ fontSize: 40, color: "action.active", mb: 1 }} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Select package folder
        </Typography>
        <Typography variant="caption" color="text.secondary">
          The folder containing manifest.yml
        </Typography>
      </Button>

      <input ref={zipInputRef} type="file" accept=".zip" hidden onChange={onZipUpload} />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error -- webkitdirectory is non-standard but widely supported
        webkitdirectory=""
        hidden
        onChange={onFolderUpload}
      />
    </>
  );
}
