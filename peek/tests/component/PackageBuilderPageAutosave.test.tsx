import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes autosave success as a status message for screen readers", async () => {
    exportPackageToDirectoryMock.mockResolvedValue(undefined);

    render(<PackageBuilderPage />);

    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();

    const statusEl = screen.getByRole("status");
    expect(statusEl).toHaveTextContent("Saved");
    expect(statusEl).toHaveAttribute("aria-live", "polite");
    expect(statusEl).toHaveAttribute("aria-atomic", "true");
  });

  it("exposes autosave failure as an alert for screen readers", async () => {
    exportPackageToDirectoryMock.mockRejectedValue(new Error("disk full"));

    render(<PackageBuilderPage />);

    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();

    const alertEl = screen.getByRole("alert");
    expect(alertEl).toHaveTextContent("Save failed");
    expect(alertEl).toHaveAttribute("aria-live", "assertive");
    expect(alertEl).toHaveAttribute("aria-atomic", "true");
  });
});
