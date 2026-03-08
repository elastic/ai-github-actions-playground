import { type ReactNode, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import GitHubIcon from "@mui/icons-material/GitHub";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import { supportsDirectoryExport } from "../../services/packageBuilder/exportPackage";
import ImportPackageDialog from "./ImportPackageDialog";
import { useStartScreenHandlers } from "./useStartScreenHandlers";

function ActionCard(props: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        width: 220,
        "&:hover": { borderColor: "primary.main" },
        transition: "border-color 0.15s",
      }}
    >
      <CardActionArea
        onClick={props.onClick}
        disabled={props.disabled}
        sx={{ p: 3, textAlign: "center" }}
      >
        {props.icon}
        <Typography variant="subtitle1" fontWeight={600}>
          {props.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {props.description}
        </Typography>
      </CardActionArea>
    </Card>
  );
}

export default function PackageBuilderStartScreen() {
  const h = useStartScreenHandlers();
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const iconSx = { fontSize: 40, color: "primary.main", mb: 1 };
  const ghIconSx = { fontSize: 40, color: "text.secondary", mb: 1 };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        gap: 3,
        py: 6,
      }}
    >
      <Typography variant="h5" fontWeight={700}>
        OTel Input Package Builder
      </Typography>
      <Typography variant="body1" color="text.secondary" textAlign="center" maxWidth={500}>
        Create or edit Elastic integration packages for OpenTelemetry inputs.
        {supportsDirectoryExport()
          ? " Pick a folder to get started — changes save automatically."
          : " Upload a package to get started."}
      </Typography>

      {h.starting && <LinearProgress sx={{ maxWidth: 300, width: "100%" }} />}
      {h.error && (
        <Alert severity="error" sx={{ maxWidth: 500 }}>
          {h.error}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center", mt: 1 }}>
        {supportsDirectoryExport() ? (
          <>
            <ActionCard
              icon={<AddIcon sx={iconSx} />}
              title="New Package"
              description="Create a new package in a folder"
              onClick={h.handleNew}
              disabled={h.starting}
            />
            <ActionCard
              icon={<FolderOpenIcon sx={iconSx} />}
              title="Open Folder"
              description="Edit an existing package on disk"
              onClick={h.handleOpenDisk}
              disabled={h.starting}
            />
          </>
        ) : (
          <>
            <ActionCard
              icon={<UploadFileIcon sx={iconSx} />}
              title="Upload .zip"
              description="Import from a zip archive"
              onClick={() => zipInputRef.current?.click()}
              disabled={h.starting}
            />
            <ActionCard
              icon={<FolderOpenIcon sx={iconSx} />}
              title="Upload Folder"
              description="Select a package folder"
              onClick={() => folderInputRef.current?.click()}
              disabled={h.starting}
            />
          </>
        )}
        <ActionCard
          icon={<GitHubIcon sx={ghIconSx} />}
          title="From GitHub"
          description="Clone from elastic/integrations"
          onClick={() => setGithubDialogOpen(true)}
          disabled={h.starting}
        />
      </Box>

      <ImportPackageDialog
        open={githubDialogOpen}
        onClose={() => setGithubDialogOpen(false)}
        onImportComplete={h.handleGitHubImportComplete}
      />
      <input ref={zipInputRef} type="file" accept=".zip" hidden onChange={h.handleZipUpload} />
      {/* eslint-disable-next-line react/no-unknown-property -- webkitdirectory is a non-standard but widely supported attribute */}
      <input
        ref={folderInputRef}
        type="file"
        {...{ webkitdirectory: "" }}
        hidden
        onChange={h.handleFolderUpload}
      />
    </Box>
  );
}
