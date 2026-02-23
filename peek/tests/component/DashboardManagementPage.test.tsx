import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DashboardManagementPage from "../../src/components/DashboardManagementPage";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

describe("DashboardManagementPage", () => {
  const originalCreateElement = document.createElement.bind(document);
  let mockFileReaderText = "";

  class MockFileReader {
    result: string | ArrayBuffer | null = null;
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

    readAsText() {
      this.result = mockFileReaderText;
      if (this.onload) {
        this.onload.call(this as unknown as FileReader, new ProgressEvent("load"));
      }
    }
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
    mockFileReaderText = "";
    vi.stubGlobal("FileReader", MockFileReader as unknown as typeof FileReader);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders dashboard management controls", () => {
    render(<DashboardManagementPage />);

    expect(screen.getByText("Dashboard Management")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load default dashboard/i })).toBeInTheDocument();
  });

  it("does not reset dashboard when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    useDashboardStore.getState().setDashboardTitle("Custom Dashboard");
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<DashboardManagementPage />);

    await user.click(screen.getByRole("button", { name: /load default dashboard/i }));

    expect(useDashboardStore.getState().dashboard.title).toBe("Custom Dashboard");
  });

  it("resets dashboard to default when confirmation is accepted", async () => {
    const user = userEvent.setup();
    useDashboardStore.getState().setDashboardTitle("Custom Dashboard");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<DashboardManagementPage />);

    await user.click(screen.getByRole("button", { name: /load default dashboard/i }));

    expect(useDashboardStore.getState().dashboard.title).toBe("Default");
  });

  it("exports dashboard JSON to a downloadable file", async () => {
    const user = userEvent.setup();
    const anchorClick = vi.fn();
    const anchorEl = { href: "", download: "", click: anchorClick } as unknown as HTMLAnchorElement;
    const createObjectURL = vi.fn().mockReturnValue("blob:dashboard");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true,
      writable: true,
    });
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "a") {
        return anchorEl;
      }
      return originalCreateElement(tagName);
    });
    render(<DashboardManagementPage />);

    await user.click(screen.getByRole("button", { name: /export dashboard/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(anchorEl.download).toBe("default.json");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:dashboard");
  });

  it("shows a success alert when dashboard import succeeds", async () => {
    const user = userEvent.setup();
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click() {
        this.onchange?.({
          target: {
            files: [new File(["dashboard"], "dashboard.json", { type: "application/json" })],
          },
        } as unknown as Event);
      },
    } as unknown as HTMLInputElement;
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "input") {
        return mockInput;
      }
      return originalCreateElement(tagName);
    });
    mockFileReaderText = useDashboardStore.getState().exportDashboard();
    render(<DashboardManagementPage />);

    await user.click(screen.getByRole("button", { name: /import dashboard/i }));

    expect(await screen.findByText("Dashboard imported successfully.")).toBeInTheDocument();
  });

  it("shows an error alert when dashboard import fails", async () => {
    const user = userEvent.setup();
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click() {
        this.onchange?.({
          target: {
            files: [new File(["bad"], "bad.json", { type: "application/json" })],
          },
        } as unknown as Event);
      },
    } as unknown as HTMLInputElement;
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "input") {
        return mockInput;
      }
      return originalCreateElement(tagName);
    });
    mockFileReaderText = "{bad-json";
    render(<DashboardManagementPage />);

    await user.click(screen.getByRole("button", { name: /import dashboard/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/json|expected|token/i);
  });
});
