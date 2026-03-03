import type { AddDataGuideType } from "../../services/addData/catalog";

/**
 * Metadata for each guide type. Used by the step wrapper components to
 * display appropriate labels and descriptions.
 *
 * Adding a new guide type:
 *  1. Add the type literal to AddDataGuideType in catalog.ts
 *  2. Add an entry here
 *  3. Create Configure + Install components under guides/
 *  4. Wire them into AddDataStepConfigure and AddDataStepInstall switches
 */
export interface GuideTypeDefinition {
  /** Label shown in the Step 2 heading (e.g. "Select your environment"). */
  step2Label: string;
  /** Label shown in the Step 3 heading (e.g. "Install and configure"). */
  step3Label: string;
}

export const GUIDE_TYPE_DEFINITIONS: Record<AddDataGuideType, GuideTypeDefinition> = {
  edot_collector: {
    step2Label: "Select your environment",
    step3Label: "Install and configure",
  },
  aws_cloud_deploy: {
    step2Label: "Select AWS services",
    step3Label: "Deploy stack",
  },
  otel_receiver: {
    step2Label: "Configure receiver",
    step3Label: "Install and configure",
  },
  fluent_bit: {
    step2Label: "Configure output",
    step3Label: "Install Fluent Bit",
  },
  apm: {
    step2Label: "Select language",
    step3Label: "Instrument your app",
  },
};
