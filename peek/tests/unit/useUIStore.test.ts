import { describe, it, expect, beforeEach, vi } from "vitest";

import { useUIStore } from "../../src/store/useUIStore";
import { makeStorageMock } from "../fixtures/test-utils";

const localStorageMock = makeStorageMock();
const sessionStorageMock = makeStorageMock();

vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("sessionStorage", sessionStorageMock);

describe("useUIStore", () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    useUIStore.getState().resetUIState();
  });

  it("defaults to dark theme", () => {
    expect(useUIStore.getState().themeMode).toBe("dark");
  });

  it("setThemeMode switches theme", () => {
    useUIStore.getState().setThemeMode("light");
    expect(useUIStore.getState().themeMode).toBe("light");

    useUIStore.getState().setThemeMode("dark");
    expect(useUIStore.getState().themeMode).toBe("dark");
  });

  it("setEditingPanelId tracks the panel being edited", () => {
    expect(useUIStore.getState().editingPanelId).toBeNull();

    useUIStore.getState().setEditingPanelId("panel-1");
    expect(useUIStore.getState().editingPanelId).toBe("panel-1");

    useUIStore.getState().setEditingPanelId(null);
    expect(useUIStore.getState().editingPanelId).toBeNull();
  });

  it("setConnectionDialogOpen toggles dialog state", () => {
    expect(useUIStore.getState().connectionDialogOpen).toBe(false);

    useUIStore.getState().setConnectionDialogOpen(true);
    expect(useUIStore.getState().connectionDialogOpen).toBe(true);

    useUIStore.getState().setConnectionDialogOpen(false);
    expect(useUIStore.getState().connectionDialogOpen).toBe(false);
  });

  it("setCommandPaletteOpen toggles palette state", () => {
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);

    useUIStore.getState().setCommandPaletteOpen(true);
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
  });

  it("resetUIState clears transient state and restores defaults", () => {
    useUIStore.getState().setThemeMode("light");
    useUIStore.getState().setEditingPanelId("panel-x");
    useUIStore.getState().setConnectionDialogOpen(true);
    useUIStore.getState().setCommandPaletteOpen(true);

    useUIStore.getState().resetUIState();

    const state = useUIStore.getState();
    expect(state.themeMode).toBe("dark");
    expect(state.editingPanelId).toBeNull();
    expect(state.connectionDialogOpen).toBe(false);
    expect(state.commandPaletteOpen).toBe(false);
  });
});
