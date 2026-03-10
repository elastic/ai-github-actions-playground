import { type ReactNode, useCallback, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import GitHubIcon from "@mui/icons-material/GitHub";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import { supportsDirectoryExport } from "../../services/packageBuilder/exportPackage";
import DataFetchAlert from "../DataFetchAlert";
import ImportPackageDialog from "./ImportPackageDialog";
import WorkspaceDialog from "./WorkspaceDialog";
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
        width: { xs: "100%", sm: 220 },
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
  const [workspaceAction, setWorkspaceAction] = useState<"new" | "open" | null>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const closeWorkspaceDialog = useCallback(() => setWorkspaceAction(null), []);
  const handlePickDirectory = useCallback(() => {
    const action = workspaceAction;
    setWorkspaceAction(null);
    if (action === "new") h.handleNew();
    else if (action === "open") h.handleOpenDisk();
  }, [workspaceAction, h]);

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
        Live OTel Input Package Editor
      </Typography>
      <Typography variant="body1" color="text.secondary" textAlign="center" maxWidth={500}>
        Create or edit Elastic integration packages for OpenTelemetry inputs.
        {supportsDirectoryExport() ? (
          <>
            {" Pick a folder to get started — changes save automatically."}
            <Tooltip
              title="When you pick a folder, the editor writes files directly to disk. Every change you make is auto‑saved to that folder in real time."
              placement="bottom"
              arrow
            >
              <InfoOutlinedIcon
                sx={{
                  fontSize: 16,
                  ml: 0.5,
                  verticalAlign: "text-bottom",
                  color: "text.secondary",
                  cursor: "help",
                }}
              />
            </Tooltip>
          </>
        ) : (
          " Upload a package to get started."
        )}
      </Typography>

      {h.starting && <LinearProgress sx={{ maxWidth: 300, width: "100%" }} />}
      <DataFetchAlert error={h.error} sx={{ maxWidth: 500 }} />

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center", mt: 1 }}>
        {supportsDirectoryExport() ? (
          <>
            <ActionCard
              icon={<AddIcon sx={iconSx} />}
              title="New Package"
              description="Create a new package in a folder"
              onClick={() => setWorkspaceAction("new")}
              disabled={h.starting}
            />
            <ActionCard
              icon={<FolderOpenIcon sx={iconSx} />}
              title="Open Folder"
              description="Edit an existing package on disk"
              onClick={() => setWorkspaceAction("open")}
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
      <WorkspaceDialog
        open={workspaceAction !== null}
        onClose={closeWorkspaceDialog}
        onPickDirectory={handlePickDirectory}
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
