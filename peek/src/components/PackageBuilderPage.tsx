import { useCallback, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";

import { usePackageBuilderStore } from "../store/usePackageBuilderStore";
import type { WizardStep } from "../types/packageBuilder";
import {
  exportPackageToDirectory,
  supportsDirectoryExport,
} from "../services/packageBuilder/exportPackage";
import PackageBuilderStepper from "./packageBuilder/PackageBuilderStepper";
import ImportPackageDialog from "./packageBuilder/ImportPackageDialog";
import StepIdentity from "./packageBuilder/StepIdentity";
import StepSignals from "./packageBuilder/StepSignals";
import StepVariables from "./packageBuilder/StepVariables";
import StepTemplate from "./packageBuilder/StepTemplate";
import StepDocs from "./packageBuilder/StepDocs";
import StepExport from "./packageBuilder/StepExport";

const FIRST_STEP: WizardStep = 1;
const LAST_STEP: WizardStep = 6;

export default function PackageBuilderPage() {
  const currentStep = usePackageBuilderStore((s) => s.currentStep);
  const setStep = usePackageBuilderStore((s) => s.setStep);
  const reset = usePackageBuilderStore((s) => s.reset);
  const linkedDir = usePackageBuilderStore((s) => s.linkedDir);
  const linkDir = usePackageBuilderStore((s) => s.linkDir);
  const unlinkDir = usePackageBuilderStore((s) => s.unlinkDir);
  const [importOpen, setImportOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const packageData = usePackageBuilderStore(
    useShallow((s) => ({
      identity: s.identity,
      policyTemplate: s.policyTemplate,
      variables: s.variables,
      templateContent: s.templateContent,
      readmeContent: s.readmeContent,
    })),
  );

  const canGoBack = currentStep > FIRST_STEP;
  const canGoForward = currentStep < LAST_STEP;

  const autoSave = useCallback(
    async (dir?: FileSystemDirectoryHandle) => {
      const handle = dir ?? linkedDir;
      if (!handle) return;
      setSaveStatus("saving");
      try {
        await exportPackageToDirectory(packageData, handle);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    },
    [linkedDir, packageData],
  );

  const handleStepChange = useCallback(
    (step: WizardStep) => {
      void autoSave();
      setStep(step);
    },
    [autoSave, setStep],
  );

  const handleLinkFolder = async () => {
    try {
      const handle = await (
        window as unknown as {
          showDirectoryPicker: (opts: { mode: string }) => Promise<FileSystemDirectoryHandle>;
        }
      ).showDirectoryPicker({ mode: "readwrite" });
      linkDir(handle);
      // Do an initial save immediately
      await autoSave(handle);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Failed to link folder:", err);
    }
  };

  const handleReset = () => {
    if (!window.confirm("Reset all package builder fields? This cannot be undone.")) return;
    reset();
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h5" fontWeight={600}>
          OTel Input Package Builder
        </Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {linkedDir && (
            <Chip
              icon={<FolderOpenIcon />}
              label={linkedDir.name}
              onDelete={unlinkDir}
              color="primary"
              variant="outlined"
              size="small"
            />
          )}
          {saveStatus === "saving" && <CircularProgress size={14} />}
          {saveStatus === "saved" && (
            <Typography variant="caption" color="success.main">
              Saved
            </Typography>
          )}
          {saveStatus === "error" && (
            <Typography variant="caption" color="error.main">
              Save failed
            </Typography>
          )}
          {supportsDirectoryExport() && !linkedDir && (
            <Button size="small" startIcon={<FolderOpenIcon />} onClick={handleLinkFolder}>
              Link Folder
            </Button>
          )}
          <Button size="small" startIcon={<FolderOpenIcon />} onClick={() => setImportOpen(true)}>
            Open Package
          </Button>
          <Button size="small" startIcon={<RestartAltIcon />} onClick={handleReset} color="warning">
            Reset
          </Button>
        </Box>
      </Box>

      <ImportPackageDialog open={importOpen} onClose={() => setImportOpen(false)} />

      {/* Stepper */}
      <PackageBuilderStepper
        currentStep={currentStep}
        onStepClick={(step) => handleStepChange(step)}
      />

      {/* Step content */}
      <Box sx={{ flex: 1, overflow: "auto", py: 1 }}>
        {currentStep === 1 && <StepIdentity />}
        {currentStep === 2 && <StepSignals />}
        {currentStep === 3 && <StepVariables />}
        {currentStep === 4 && <StepTemplate />}
        {currentStep === 5 && <StepDocs />}
        {currentStep === 6 && <StepExport />}
      </Box>

      {/* Navigation */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          pt: 2,
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        <Button
          variant="outlined"
          disabled={!canGoBack}
          onClick={() => handleStepChange((currentStep - 1) as WizardStep)}
        >
          Back
        </Button>
        {canGoForward && (
          <Button
            variant="contained"
            onClick={() => handleStepChange((currentStep + 1) as WizardStep)}
          >
            {currentStep === LAST_STEP - 1 ? "Review & Validate" : "Continue"}
          </Button>
        )}
      </Box>
    </Box>
  );
}
