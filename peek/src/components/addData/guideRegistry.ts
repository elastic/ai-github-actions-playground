import type { AddDataGuideType } from "../../services/addData/catalog";

/**
 * Metadata for each guide type. Used by AddDataStepSetup to display
 * appropriate section labels for the configure and install sections.
 *
 * Adding a new guide type:
 *  1. Add the type literal to AddDataGuideType in catalog.ts
 *  2. Add an entry here
 *  3. Create Configure + Install components under guides/
 *  4. Wire them into AddDataStepSetup's switch statements
 */
export interface GuideTypeDefinition {
  /** Label for the Configure section (e.g. "Select your environment"). */
  configureLabel: string;
  /** Label for the Install section (e.g. "Install and configure"). */
  installLabel: string;
}

export const GUIDE_TYPE_DEFINITIONS: Record<AddDataGuideType, GuideTypeDefinition> = {
  edot_collector: {
    configureLabel: "Select your environment",
    installLabel: "Install and configure",
  },
  aws_cloud_deploy: {
    configureLabel: "Select AWS services",
    installLabel: "Deploy stack",
  },
  otel_receiver: {
    configureLabel: "Configure receiver",
    installLabel: "Install and configure",
  },
  fluent_bit: {
    configureLabel: "Configure output",
    installLabel: "Install Fluent Bit",
  },
  apm: {
    configureLabel: "Select language",
    installLabel: "Instrument your app",
  },
};
