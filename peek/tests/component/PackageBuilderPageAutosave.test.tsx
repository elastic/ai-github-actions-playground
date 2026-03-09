import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import PackageBuilderPage from "../../src/components/PackageBuilderPage";

const { exportPackageToDirectoryMock, mockStoreState } = vi.hoisted(() => ({
  exportPackageToDirectoryMock: vi.fn(),
  mockStoreState: {
    currentStep: 1 as const,
    setStep: vi.fn(),
    reset: vi.fn(),
    linkedDir: { name: "fixtures-dir" } as unknown as FileSystemDirectoryHandle,
    isLoaded: true,
    identity: { name: "demo_package" },
    policyTemplate: {},
    variables: [],
    templateContent: "",
    readmeContent: "",
  },
}));

vi.mock("../../src/services/packageBuilder/exportPackage", () => ({
  exportPackageToDirectory: exportPackageToDirectoryMock,
}));

vi.mock("../../src/store/usePackageBuilderStore", () => ({
  usePackageBuilderStore: (selector: (state: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

vi.mock("../../src/components/packageBuilder/PackageBuilderStepper", () => ({
  default: () => <div data-testid="stepper" />,
}));
vi.mock("../../src/components/packageBuilder/PackageBuilderStartScreen", () => ({
  default: () => <div data-testid="start-screen" />,
}));
vi.mock("../../src/components/packageBuilder/StepIdentity", () => ({
  default: () => <div>Identity</div>,
}));
vi.mock("../../src/components/packageBuilder/StepSignals", () => ({
  default: () => <div>Signals</div>,
}));
vi.mock("../../src/components/packageBuilder/StepVariables", () => ({
  default: () => <div>Variables</div>,
}));
vi.mock("../../src/components/packageBuilder/StepTemplate", () => ({
  default: () => <div>Template</div>,
}));
vi.mock("../../src/components/packageBuilder/StepDocs", () => ({
  default: () => <div>Docs</div>,
}));
vi.mock("../../src/components/packageBuilder/StepExport", () => ({
  default: () => <div>Export</div>,
}));

describe("PackageBuilder autosave accessibility", () => {
  beforeEach(() => {
    exportPackageToDirectoryMock.mockReset();
  });

  it("exposes autosave success as a status message for screen readers", async () => {
    exportPackageToDirectoryMock.mockResolvedValue(undefined);

    render(<PackageBuilderPage />);

    // Wait for debounce (500ms) + async save to complete
    await waitFor(() => {
      expect(screen.getByText("Saved")).toBeInTheDocument();
    });

    const statusEl = screen.getByRole("status");
    expect(statusEl).toHaveTextContent("Saved");
  });

  it("exposes autosave failure as an alert for screen readers", async () => {
    exportPackageToDirectoryMock.mockRejectedValue(new Error("disk full"));

    render(<PackageBuilderPage />);

    // Wait for debounce (500ms) + async save to fail
    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeInTheDocument();
    });

    const alertEl = screen.getByRole("alert");
    expect(alertEl).toHaveTextContent("Save failed");
  });
});
