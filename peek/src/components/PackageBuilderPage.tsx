import { useCallback, useState, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SyncIcon from "@mui/icons-material/Sync";

import { usePackageBuilderStore } from "../store/usePackageBuilderStore";
import type { WizardStep } from "../types/packageBuilder";
import { exportPackageToDirectory } from "../services/packageBuilder/exportPackage";
import PackageBuilderStepper from "./packageBuilder/PackageBuilderStepper";
import PackageBuilderStartScreen from "./packageBuilder/PackageBuilderStartScreen";
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
  const isLoaded = usePackageBuilderStore((s) => s.isLoaded);
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

  // Auto-save on any change to packageData when linkedDir is present
  useEffect(() => {
    if (!linkedDir) return;
    const timeoutId = setTimeout(() => {
      void autoSave();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [linkedDir, packageData, autoSave]);

  const handleStepChange = useCallback(
    (step: WizardStep) => {
      setStep(step);
    },
    [setStep],
  );

  const handleReset = () => {
    if (
      !window.confirm(
        "Close current package and return to start screen? Unsaved changes will be lost.",
      )
    )
      return;
    reset();
  };

  if (!isLoaded) {
    return <PackageBuilderStartScreen />;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="h5" fontWeight={600}>
            {packageData.identity.name || "Unnamed Package"}
          </Typography>
          {linkedDir ? (
            <Tooltip
              title={`All changes are automatically saved to the "${linkedDir.name}" folder on disk.`}
              arrow
            >
              <Chip
                icon={<FolderOpenIcon />}
                label={linkedDir.name}
                size="small"
                variant="outlined"
                color="success"
              />
            </Tooltip>
          ) : (
            <Tooltip
              title="This package is stored in browser memory only. Use the Export step to save it."
              arrow
            >
              <Chip label="In-memory only" size="small" variant="outlined" color="warning" />
            </Tooltip>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {saveStatus === "saving" && (
            <Chip icon={<SyncIcon />} label="Saving…" size="small" variant="outlined" />
          )}
          {saveStatus === "saved" && (
            <Chip label="Saved" size="small" variant="outlined" color="success" />
          )}
          {saveStatus === "error" && (
            <Chip label="Save failed" size="small" variant="outlined" color="error" />
          )}
          <Button size="small" startIcon={<RestartAltIcon />} onClick={handleReset} color="warning">
            Close Package
          </Button>
        </Box>
      </Box>

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
