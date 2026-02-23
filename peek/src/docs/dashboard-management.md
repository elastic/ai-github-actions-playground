# Dashboard Management

Dashboard Management centralizes import, export, and reset operations for the current dashboard.

Use Export Dashboard to save a JSON snapshot that can be shared, versioned, or loaded in another browser.

Use Import Dashboard to replace the current dashboard state from a compatible exported JSON file.

Use Load Default Dashboard to reset to the built-in starter layout when testing or recovering from unwanted changes.

If import fails, validate the file is valid JSON produced by Peek and includes required dashboard fields.

## Planned Dashboard Library Experience

The dashboard index (`/dashboards`) will be the primary management page for all dashboards in a workspace.

Each dashboard row/card will support open, rename, duplicate, archive, and delete, with delete guarded by confirmation and an undo-style recovery window when possible.

Import and export will support two scopes: active dashboard JSON for sharing one view, and workspace JSON for backup/restore of all dashboards.

Reset behavior will also be scoped: reset active dashboard (safe local rollback) or reset full workspace (explicit destructive action).

Connection profiles remain workspace-level by default; dashboards can optionally store a preferred profile hint without forcing automatic profile switches.
