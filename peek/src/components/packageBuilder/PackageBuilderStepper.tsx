import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepButton from "@mui/material/StepButton";
import type { WizardStep } from "../../types/packageBuilder";

const STEPS = [
  { label: "Identity", step: 1 },
  { label: "Signals", step: 2 },
  { label: "Variables", step: 3 },
  { label: "Template", step: 4 },
  { label: "Docs", step: 5 },
  { label: "Review", step: 6 },
] as const;

interface Props {
  currentStep: WizardStep;
  onStepClick: (step: WizardStep) => void;
}

export default function PackageBuilderStepper({ currentStep, onStepClick }: Props) {
  return (
    <Stepper nonLinear activeStep={currentStep - 1} sx={{ pb: 2 }}>
      {STEPS.map(({ label, step }) => (
        <Step key={step} completed={currentStep > step}>
          <StepButton onClick={() => onStepClick(step)}>{label}</StepButton>
        </Step>
      ))}
    </Stepper>
  );
}
