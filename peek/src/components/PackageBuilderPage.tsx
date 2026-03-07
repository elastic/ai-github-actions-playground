import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";

import { usePackageBuilderStore } from "../store/usePackageBuilderStore";
import type { WizardStep } from "../types/packageBuilder";
import PackageBuilderStepper from "./packageBuilder/PackageBuilderStepper";
import ImportPackageDialog from "./packageBuilder/ImportPackageDialog";
import StepIdentity from "./packageBuilder/StepIdentity";
import StepSignals from "./packageBuilder/StepSignals";
import StepVariables from "./packageBuilder/StepVariables";
import StepTemplate from "./packageBuilder/StepTemplate";
import StepDocs from "./packageBuilder/StepDocs";
import StepExport from "./packageBuilder/StepExport";

export default function PackageBuilderPage() {
  const currentStep = usePackageBuilderStore((s) => s.currentStep);
  const setStep = usePackageBuilderStore((s) => s.setStep);
  const reset = usePackageBuilderStore((s) => s.reset);
  const [importOpen, setImportOpen] = useState(false);

  const canGoBack = currentStep > 1;
  const canGoForward = currentStep < 6;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h5" fontWeight={600}>
          OTel Input Package Builder
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button size="small" startIcon={<FolderOpenIcon />} onClick={() => setImportOpen(true)}>
            Open Package
          </Button>
          <Button size="small" startIcon={<RestartAltIcon />} onClick={reset} color="warning">
            Reset
          </Button>
        </Box>
      </Box>

      <ImportPackageDialog open={importOpen} onClose={() => setImportOpen(false)} />

      {/* Stepper */}
      <PackageBuilderStepper currentStep={currentStep} onStepClick={(step) => setStep(step)} />

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
      <Box sx={{ display: "flex", justifyContent: "space-between", pt: 2, borderTop: 1, borderColor: "divider" }}>
        <Button
          variant="outlined"
          disabled={!canGoBack}
          onClick={() => setStep((currentStep - 1) as WizardStep)}
        >
          Back
        </Button>
        <Button
          variant="contained"
          disabled={!canGoForward}
          onClick={() => setStep((currentStep + 1) as WizardStep)}
        >
          {currentStep === 5 ? "Review & Export" : "Continue"}
        </Button>
      </Box>
    </Box>
  );
}
