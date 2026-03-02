import type { DashboardDefinition } from "../types";
import { toPersesDashboard } from "../services/perses/dashboardAdapters";

export function exportDashboardJson(dashboard: DashboardDefinition): void {
  const json = JSON.stringify(toPersesDashboard(dashboard), null, 2);
  const safeTitle = dashboard.title
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeTitle}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportWorkspaceJson(exportWorkspace: () => string): void {
  const json = exportWorkspace();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "peek-workspace.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function triggerFileImport(
  scope: "dashboard" | "workspace",
  importDashboard: (text: string) => { success: boolean; error?: string },
  importWorkspace: (text: string) => { success: boolean; error?: string },
  callbacks: {
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
  },
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const result = scope === "workspace" ? importWorkspace(text) : importDashboard(text);
        if (result.success) {
          callbacks.onSuccess(
            scope === "workspace"
              ? "Workspace imported successfully."
              : "Dashboard imported successfully.",
          );
        } else {
          callbacks.onError(result.error ?? "Import failed.");
        }
      } catch {
        callbacks.onError("Failed to process import file.");
      }
    };
    reader.onerror = () => {
      callbacks.onError("Failed to read import file.");
    };
    reader.readAsText(file);
  };
  input.click();
}
