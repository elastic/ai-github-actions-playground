# Dashboard Management

Dashboard Management centralizes import, export, and reset operations for the current dashboard.

Use Export Dashboard to save a JSON snapshot that can be shared, versioned, or loaded in another browser.

Use Import Dashboard to replace the current dashboard state from a compatible exported JSON file.

Use Load Default Dashboard to reset to the built-in starter layout when testing or recovering from unwanted changes.

If import fails, validate the file is valid JSON produced by Peek and includes required dashboard fields.

## Dashboard Library Experience

The dashboard index (`/dashboards`) is the primary management page for dashboards in a workspace.

Each dashboard row supports open, rename, duplicate, archive, and delete actions. Deletes are guarded by confirmation and an undo-style recovery window.

Import and export support two scopes: active dashboard JSON for sharing one view, and workspace JSON for backup/restore of all dashboards.

Reset behavior is also scoped: reset the active dashboard (safe local rollback) or reset the full workspace (explicit destructive action).

Connection profiles remain workspace-level by default. Dashboards can optionally store a preferred profile hint without forcing automatic profile switches.

The timezone lock setting is stored inside the dashboard definition and travels with export/import. When sharing a dashboard JSON, recipients see time-series charts in the same fixed timezone that was active when the dashboard was exported, regardless of their own browser locale. Reset the active dashboard or import a fresh copy to clear a locked timezone.
