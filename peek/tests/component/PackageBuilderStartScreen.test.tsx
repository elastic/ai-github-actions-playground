import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PackageBuilderStartScreen from "../../src/components/packageBuilder/PackageBuilderStartScreen";

const { handlersMock, supportsDirectoryExportMock } = vi.hoisted(() => ({
  handlersMock: {
    error: null as string | null,
    starting: false,
    handleNew: vi.fn(),
    handleOpenDisk: vi.fn(),
    handleGitHubImportComplete: vi.fn(),
    handleZipUpload: vi.fn(),
    handleFolderUpload: vi.fn(),
  },
  supportsDirectoryExportMock: vi.fn(() => true),
}));

vi.mock("../../src/components/packageBuilder/useStartScreenHandlers", () => ({
  useStartScreenHandlers: () => handlersMock,
}));

vi.mock("../../src/services/packageBuilder/exportPackage", () => ({
  supportsDirectoryExport: supportsDirectoryExportMock,
}));

vi.mock("../../src/components/packageBuilder/ImportPackageDialog", () => ({
  default: () => null,
}));

describe("PackageBuilderStartScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supportsDirectoryExportMock.mockReturnValue(true);
  });

  it('dispatches "new" action to handleNew and closes the workspace dialog', async () => {
    const user = userEvent.setup();
    render(<PackageBuilderStartScreen />);

    await user.click(screen.getByRole("button", { name: /new package/i }));
    expect(screen.getByRole("dialog", { name: /pick a package workspace/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /choose directory/i }));

    expect(handlersMock.handleNew).toHaveBeenCalledTimes(1);
    expect(handlersMock.handleOpenDisk).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /pick a package workspace/i }),
      ).not.toBeInTheDocument();
    });
  });

  it('dispatches "open" action to handleOpenDisk and closes the workspace dialog', async () => {
    const user = userEvent.setup();
    render(<PackageBuilderStartScreen />);

    await user.click(screen.getByRole("button", { name: /open folder/i }));
    expect(screen.getByRole("dialog", { name: /pick a package workspace/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /choose directory/i }));

    expect(handlersMock.handleOpenDisk).toHaveBeenCalledTimes(1);
    expect(handlersMock.handleNew).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /pick a package workspace/i }),
      ).not.toBeInTheDocument();
    });
  });
});
