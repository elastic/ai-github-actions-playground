// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";

import { useUIStore } from "../../src/store/useUIStore";
import { useThemeStore } from "../../src/store/useThemeStore";
import { useCommandPaletteStore } from "../../src/store/useCommandPaletteStore";

describe("useUIStore", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useUIStore.getState().resetUIState();
    useThemeStore.getState().resetThemeState();
    useCommandPaletteStore.getState().resetCommandPaletteState();
  });

  it("defaults to dark theme", () => {
    expect(useThemeStore.getState().themeMode).toBe("dark");
  });

  it("setThemeMode switches theme", () => {
    useThemeStore.getState().setThemeMode("light");
    expect(useThemeStore.getState().themeMode).toBe("light");

    useThemeStore.getState().setThemeMode("dark");
    expect(useThemeStore.getState().themeMode).toBe("dark");
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
    expect(useCommandPaletteStore.getState().commandPaletteOpen).toBe(false);

    useCommandPaletteStore.getState().setCommandPaletteOpen(true);
    expect(useCommandPaletteStore.getState().commandPaletteOpen).toBe(true);
  });

  it("resetUIState clears transient state and restores defaults", () => {
    useThemeStore.getState().setThemeMode("light");
    useUIStore.getState().setEditingPanelId("panel-x");
    useUIStore.getState().setConnectionDialogOpen(true);
    useCommandPaletteStore.getState().setCommandPaletteOpen(true);

    useUIStore.getState().resetUIState();
    useThemeStore.getState().resetThemeState();
    useCommandPaletteStore.getState().resetCommandPaletteState();

    expect(useThemeStore.getState().themeMode).toBe("dark");
    expect(useUIStore.getState().editingPanelId).toBeNull();
    expect(useUIStore.getState().connectionDialogOpen).toBe(false);
    expect(useCommandPaletteStore.getState().commandPaletteOpen).toBe(false);
  });
});
