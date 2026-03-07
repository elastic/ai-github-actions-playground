import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type {
  FormatVersion,
  OwnerType,
  PackageBuilderData,
  PackageIcon,
  PackageVariable,
  PolicyTemplate,
  SignalType,
  SubscriptionLevel,
  WizardStep,
} from "../types/packageBuilder";
import {
  createDefaultVariable,
  shouldAutoSecret,
  STARTER_TEMPLATES,
} from "../types/packageBuilder";
import { generateReadmeScaffold } from "../services/packageBuilder/generateManifest";

interface PackageBuilderState extends PackageBuilderData {
  currentStep: WizardStep;
  mockValues: Record<string, string>;
  readmeGenerated: boolean;

  // Navigation
  setStep: (step: WizardStep) => void;

  // Identity
  setName: (name: string) => void;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setVersion: (version: string) => void;
  setFormatVersion: (v: FormatVersion) => void;
  setOwnerGithub: (v: string) => void;
  setOwnerType: (v: OwnerType) => void;
  setCategories: (v: string[]) => void;
  setKibanaVersion: (v: string) => void;
  setSubscription: (v: SubscriptionLevel) => void;
  setIcon: (icon: PackageIcon | null) => void;

  // Policy template
  setPolicyTemplate: (updates: Partial<PolicyTemplate>) => void;

  // Variables
  addVariable: () => void;
  removeVariable: (index: number) => void;
  updateVariable: (index: number, updates: Partial<PackageVariable>) => void;
  moveVariable: (from: number, to: number) => void;

  // Template
  setTemplateContent: (content: string) => void;
  loadStarterTemplate: (key: string) => void;
  setMockValue: (name: string, value: string) => void;

  // Readme
  setReadmeContent: (content: string) => void;
  regenerateReadme: () => void;

  // Import
  loadPackage: (data: PackageBuilderData) => void;

  // Reset
  reset: () => void;
}

const DEFAULT_IDENTITY = {
  name: "",
  title: "",
  description: "",
  version: "0.1.0",
  formatVersion: "3.5.0" as FormatVersion,
  ownerGithub: "elastic/ecosystem",
  ownerType: "elastic" as OwnerType,
  categories: ["opentelemetry"],
  kibanaVersion: "^9.2.0",
  subscription: "basic" as SubscriptionLevel,
  icon: null as PackageIcon | null,
};

const DEFAULT_POLICY_TEMPLATE: PolicyTemplate = {
  name: "",
  title: "",
  description: "",
  signalTypes: ["metrics"] as SignalType[],
  dynamicSignalTypes: false,
};

const DEFAULT_STATE: Pick<
  PackageBuilderState,
  | "currentStep"
  | "identity"
  | "policyTemplate"
  | "variables"
  | "templateContent"
  | "readmeContent"
  | "mockValues"
  | "readmeGenerated"
> = {
  currentStep: 1,
  identity: { ...DEFAULT_IDENTITY },
  policyTemplate: { ...DEFAULT_POLICY_TEMPLATE },
  variables: [],
  templateContent: STARTER_TEMPLATES.blank ?? "",
  readmeContent: "",
  mockValues: {},
  readmeGenerated: false,
};

function stripIconRawBytes(
  identity: PackageBuilderState["identity"],
): PackageBuilderState["identity"] {
  if (!identity.icon) return identity;
  return {
    ...identity,
    icon: {
      name: identity.icon.name,
      dataUrl: identity.icon.dataUrl,
      rawBytes: new Uint8Array(),
      mimeType: identity.icon.mimeType,
    },
  };
}

function decodeDataUrl(dataUrl: string): Uint8Array {
  const match = dataUrl.match(/^data:.*?;base64,(.+)$/);
  if (!match?.[1]) return new Uint8Array();
  try {
    const binary = atob(match[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    console.warn("Failed to decode persisted icon data", err);
    return new Uint8Array();
  }
}

function restoreIconRawBytes(
  identity: PackageBuilderState["identity"],
): PackageBuilderState["identity"] {
  if (!identity.icon) return identity;
  if (identity.icon.rawBytes instanceof Uint8Array && identity.icon.rawBytes.byteLength > 0) {
    return identity;
  }
  return {
    ...identity,
    icon: {
      ...identity.icon,
      rawBytes: decodeDataUrl(identity.icon.dataUrl),
    },
  };
}

export const usePackageBuilderStore = create<PackageBuilderState>()(
  devtools(
    persist(
      (set, get) => ({
        ...DEFAULT_STATE,

        setStep: (step) => {
          // Auto-generate README on first visit to step 5 if not yet generated
          if (step === 5 && !get().readmeGenerated) {
            const data = get();
            set({
              currentStep: step,
              readmeContent: generateReadmeScaffold(data),
              readmeGenerated: true,
            });
          } else {
            set({ currentStep: step });
          }
        },

        // Identity setters
        setName: (name) =>
          set((s) => ({
            identity: { ...s.identity, name: name.toLowerCase().replace(/[^a-z0-9_]/g, "_") },
          })),
        setTitle: (title) => set((s) => ({ identity: { ...s.identity, title } })),
        setDescription: (description) => set((s) => ({ identity: { ...s.identity, description } })),
        setVersion: (version) => set((s) => ({ identity: { ...s.identity, version } })),
        setFormatVersion: (v) => set((s) => ({ identity: { ...s.identity, formatVersion: v } })),
        setOwnerGithub: (v) => set((s) => ({ identity: { ...s.identity, ownerGithub: v } })),
        setOwnerType: (v) => set((s) => ({ identity: { ...s.identity, ownerType: v } })),
        setCategories: (v) => set((s) => ({ identity: { ...s.identity, categories: v } })),
        setKibanaVersion: (v) => set((s) => ({ identity: { ...s.identity, kibanaVersion: v } })),
        setSubscription: (v) => set((s) => ({ identity: { ...s.identity, subscription: v } })),
        setIcon: (icon) => set((s) => ({ identity: { ...s.identity, icon } })),

        // Policy template
        setPolicyTemplate: (updates) =>
          set((s) => ({ policyTemplate: { ...s.policyTemplate, ...updates } })),

        // Variables
        addVariable: () => set((s) => ({ variables: [...s.variables, createDefaultVariable()] })),
        removeVariable: (index) =>
          set((s) => ({ variables: s.variables.filter((_, i) => i !== index) })),
        updateVariable: (index, updates) =>
          set((s) => {
            const variables = [...s.variables];
            const prev = variables[index];
            if (!prev) return {};
            const current: PackageVariable = { ...prev, ...updates };
            // Auto-detect secret from name
            if (updates.name !== undefined) {
              current.secret = shouldAutoSecret(current.name);
            }
            variables[index] = current;
            return { variables };
          }),
        moveVariable: (from, to) =>
          set((s) => {
            const variables = [...s.variables];
            if (from < 0 || from >= variables.length || to < 0 || to >= variables.length) return {};
            const moved = variables[from];
            if (!moved) return {};
            variables.splice(from, 1);
            variables.splice(to, 0, moved);
            return { variables };
          }),

        // Template
        setTemplateContent: (content) => set({ templateContent: content }),
        loadStarterTemplate: (key) => {
          const t = STARTER_TEMPLATES[key];
          if (t) set({ templateContent: t });
        },
        setMockValue: (name, value) =>
          set((s) => ({ mockValues: { ...s.mockValues, [name]: value } })),

        // Readme
        setReadmeContent: (content) => set({ readmeContent: content }),
        regenerateReadme: () => {
          const data = get();
          set({ readmeContent: generateReadmeScaffold(data), readmeGenerated: true });
        },

        // Import
        loadPackage: (data) =>
          set({
            identity: data.identity,
            policyTemplate: data.policyTemplate,
            variables: data.variables,
            templateContent: data.templateContent,
            readmeContent: data.readmeContent,
            currentStep: 1,
            mockValues: {},
            readmeGenerated: Boolean(data.readmeContent),
          }),

        // Reset
        reset: () => set({ ...DEFAULT_STATE, readmeGenerated: false }),
      }),
      {
        name: "package-builder",
        partialize: (state) => ({
          identity: stripIconRawBytes(state.identity),
          policyTemplate: state.policyTemplate,
          variables: state.variables,
          templateContent: state.templateContent,
          readmeContent: state.readmeContent,
          currentStep: state.currentStep,
          mockValues: state.mockValues,
          readmeGenerated: state.readmeGenerated,
        }),
        merge: (persisted, current) => {
          const merged = {
            ...current,
            ...(persisted as Partial<PackageBuilderState>),
          };
          return {
            ...merged,
            identity: restoreIconRawBytes(merged.identity),
          };
        },
      },
    ),
    { name: "PackageBuilderStore", enabled: import.meta.env.DEV },
  ),
);
