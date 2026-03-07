import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import DownloadIcon from "@mui/icons-material/Download";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import FolderIcon from "@mui/icons-material/Folder";
import ImageIcon from "@mui/icons-material/Image";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { usePackageBuilderStore } from "../../store/usePackageBuilderStore";
import {
  generateManifest,
  generateChangelog,
} from "../../services/packageBuilder/generateManifest";
import { renderTemplate, findUndefinedVars } from "../../services/packageBuilder/renderTemplate";
import { exportPackageZip, downloadBlob } from "../../services/packageBuilder/exportPackage";
import { iconExtensionFromMimeType } from "../../services/packageBuilder/iconExtension";

interface ValidationItem {
  label: string;
  status: "pass" | "warn" | "fail";
  detail?: string;
}

function useValidation(): ValidationItem[] {
  const identity = usePackageBuilderStore((s) => s.identity);
  const policyTemplate = usePackageBuilderStore((s) => s.policyTemplate);
  const variables = usePackageBuilderStore((s) => s.variables);
  const templateContent = usePackageBuilderStore((s) => s.templateContent);
  const readmeContent = usePackageBuilderStore((s) => s.readmeContent);

  return useMemo(() => {
    const items: ValidationItem[] = [];

    // Name
    if (/^[a-z0-9_]+$/.test(identity.name)) {
      items.push({ label: "Package name valid", status: "pass" });
    } else {
      items.push({
        label: "Package name invalid",
        status: "fail",
        detail: "Must match ^[a-z0-9_]+$",
      });
    }

    // Version — full semver match (no trailing junk like "1.2.3foo")
    if (/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/.test(identity.version)) {
      items.push({ label: "Version is valid semver", status: "pass" });
    } else {
      items.push({ label: "Version is not valid semver", status: "fail" });
    }

    // Format version
    if (identity.formatVersion === "3.5.0" || identity.formatVersion === "3.6.0") {
      items.push({ label: `format_version >= 3.5.0`, status: "pass" });
    } else {
      items.push({ label: `format_version >= 3.5.0`, status: "fail" });
    }

    // Title
    if (identity.title) {
      items.push({ label: "Title provided", status: "pass" });
    } else {
      items.push({ label: "Title is empty", status: "fail" });
    }

    // Policy template
    if (policyTemplate.name) {
      items.push({ label: "Policy template name set", status: "pass" });
    } else {
      items.push({ label: "Policy template name missing", status: "fail" });
    }

    // Template
    if (templateContent.trim()) {
      items.push({ label: "Template content present", status: "pass" });
    } else {
      items.push({ label: "Template is empty", status: "fail" });
    }

    // Template renders valid YAML
    const result = renderTemplate(templateContent, variables, {});
    if (result.templateError) {
      items.push({
        label: "Template compilation failed",
        status: "fail",
        detail: result.templateError,
      });
    } else if (result.yamlValid) {
      items.push({ label: "Rendered template is valid YAML", status: "pass" });
    } else {
      items.push({
        label: "Rendered template is invalid YAML",
        status: "fail",
        detail: result.yamlError ?? undefined,
      });
    }

    // Undefined vars
    const undef = findUndefinedVars(templateContent, variables);
    if (undef.length > 0) {
      items.push({
        label: "Undefined template variables",
        status: "warn",
        detail: undef.join(", "),
      });
    } else {
      items.push({ label: "All template variables defined", status: "pass" });
    }

    // No exporters
    if (/\bexporters\s*:/i.test(templateContent)) {
      items.push({
        label: "Template defines exporters",
        status: "warn",
        detail: "Fleet adds exporters automatically",
      });
    }

    // README
    if (readmeContent.trim()) {
      items.push({ label: "README present", status: "pass" });
    } else {
      items.push({ label: "README is empty", status: "warn" });
    }

    // Icon
    if (identity.icon) {
      items.push({ label: "Icon provided", status: "pass" });
    } else {
      items.push({ label: "No icon uploaded", status: "warn" });
    }

    // Secret naming
    for (const v of variables) {
      if (
        !v.secret &&
        /(?:password|token|secret|_key$)/i.test(v.name) &&
        !/(?:_file$|_url$)/i.test(v.name)
      ) {
        items.push({ label: `Variable "${v.name}" should be secret`, status: "warn" });
      }
    }

    return items;
  }, [identity, policyTemplate, variables, templateContent, readmeContent]);
}

type PreviewFile = "manifest" | "changelog" | "template" | "readme";

export default function StepExport() {
  const identity = usePackageBuilderStore((s) => s.identity);
  const policyTemplate = usePackageBuilderStore((s) => s.policyTemplate);
  const variables = usePackageBuilderStore((s) => s.variables);
  const templateContent = usePackageBuilderStore((s) => s.templateContent);
  const readmeContent = usePackageBuilderStore((s) => s.readmeContent);

  const validation = useValidation();
  const iconExt = iconExtensionFromMimeType(identity.icon?.mimeType);
  const [selectedFile, setSelectedFile] = useState<PreviewFile>("manifest");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const fullName = identity.name.endsWith("_input_otel")
    ? identity.name
    : `${identity.name || "my_package"}_input_otel`;

  const data = useMemo(
    () => ({ identity, policyTemplate, variables, templateContent, readmeContent }),
    [identity, policyTemplate, variables, templateContent, readmeContent],
  );

  const fileContents: Record<PreviewFile, string> = useMemo(
    () => ({
      manifest: generateManifest(data),
      changelog: generateChangelog(data),
      template: data.templateContent,
      readme: data.readmeContent,
    }),
    [data],
  );

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await exportPackageZip(data);
      downloadBlob(blob, `${fullName}.zip`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Failed to export package.");
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fileContents[selectedFile]);
      setCopyError(null);
    } catch {
      setCopyError("Failed to copy preview content to clipboard.");
    }
  };

  const passes = validation.filter((v) => v.status === "pass").length;
  const warns = validation.filter((v) => v.status === "warn").length;
  const fails = validation.filter((v) => v.status === "fail").length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h6">Review &amp; Export</Typography>
          <Typography variant="body2" color="text.secondary">
            {fullName} v{identity.version}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
          disabled={exporting || fails > 0}
          size="large"
        >
          {exporting ? "Exporting..." : "Download .zip"}
        </Button>
      </Box>

      {/* Validation summary */}
      <Alert severity={fails > 0 ? "error" : warns > 0 ? "warning" : "success"} sx={{ py: 0.5 }}>
        {passes} passed, {warns} warnings, {fails} errors
      </Alert>
      {exportError && (
        <Alert severity="error" sx={{ py: 0.5 }}>
          {exportError}
        </Alert>
      )}
      {copyError && (
        <Alert severity="warning" sx={{ py: 0.5 }}>
          {copyError}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 2, minHeight: 400 }}>
        {/* Left: file tree + validation */}
        <Box sx={{ width: 300, display: "flex", flexDirection: "column", gap: 2 }}>
          {/* File tree */}
          <Paper variant="outlined">
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ px: 1.5, pt: 1, display: "block" }}
            >
              Package files
            </Typography>
            <List dense disablePadding>
              <ListItemButton
                selected={selectedFile === "manifest"}
                onClick={() => setSelectedFile("manifest")}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <InsertDriveFileIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="manifest.yml" />
              </ListItemButton>
              <ListItemButton
                selected={selectedFile === "changelog"}
                onClick={() => setSelectedFile("changelog")}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <InsertDriveFileIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="changelog.yml" />
              </ListItemButton>
              <ListItemButton
                selected={selectedFile === "template"}
                onClick={() => setSelectedFile("template")}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <FolderIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="agent/input/input.yml.hbs"
                  primaryTypographyProps={{ fontSize: 13 }}
                />
              </ListItemButton>
              <ListItemButton
                selected={selectedFile === "readme"}
                onClick={() => setSelectedFile("readme")}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <InsertDriveFileIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="docs/README.md" />
              </ListItemButton>
              {identity.icon && (
                <ListItemButton disabled>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <ImageIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={`img/logo_${identity.name}.${iconExt}`}
                    primaryTypographyProps={{ fontSize: 13 }}
                  />
                </ListItemButton>
              )}
            </List>
          </Paper>

          {/* Validation checklist */}
          <Paper variant="outlined" sx={{ flex: 1, overflow: "auto" }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ px: 1.5, pt: 1, display: "block" }}
            >
              Validation
            </Typography>
            <Stack spacing={0} sx={{ px: 1.5, py: 1 }}>
              {validation.map((item, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 1, py: 0.5 }}>
                  {item.status === "pass" && (
                    <CheckCircleIcon sx={{ fontSize: 16, color: "success.main", mt: 0.5 }} />
                  )}
                  {item.status === "warn" && (
                    <WarningIcon sx={{ fontSize: 16, color: "warning.main", mt: 0.5 }} />
                  )}
                  {item.status === "fail" && (
                    <ErrorIcon sx={{ fontSize: 16, color: "error.main", mt: 0.5 }} />
                  )}
                  <Box>
                    <Typography variant="body2" fontSize={13}>
                      {item.label}
                    </Typography>
                    {item.detail && (
                      <Typography variant="caption" color="text.secondary">
                        {item.detail}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Box>

        {/* Right: file preview */}
        <Paper
          variant="outlined"
          sx={{
            flex: 1,
            p: 2,
            overflow: "auto",
            fontFamily: "monospace",
            fontSize: 13,
            whiteSpace: "pre-wrap",
            bgcolor: "action.hover",
            position: "relative",
          }}
        >
          <Button
            size="small"
            startIcon={<ContentCopyIcon />}
            onClick={() => {
              void handleCopy();
            }}
            sx={{ position: "absolute", top: 8, right: 8 }}
          >
            Copy
          </Button>
          {fileContents[selectedFile] || "(empty)"}
        </Paper>
      </Box>
    </Box>
  );
}
