import { useCallback, useState, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

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
          <Typography variant="body2" color="text.secondary">
            in {linkedDir?.name || "Local Memory"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {saveStatus === "saving" && <CircularProgress size={14} />}
          <Box
            role={saveStatus === "error" ? "alert" : "status"}
            aria-live={saveStatus === "error" ? "assertive" : "polite"}
            aria-atomic="true"
          >
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
          </Box>
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
