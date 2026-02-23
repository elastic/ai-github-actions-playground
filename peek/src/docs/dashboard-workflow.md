# Building Dashboards

Click Add Panel to create a new visualization. Each panel has its own ES|QL query and chart type.

Drag panels to rearrange them and resize by pulling the bottom-right corner.

Click a panel title to open the editor where you can change the query, visualization type, and chart options.

Use Recent queries in the panel editor to re-apply a query that previously ran successfully.

Use the time picker and refresh interval controls in the header to control the query time range.

Export your dashboard as a JSON file from the overflow menu, and import it on another machine.

Use dashboard variables in panel queries to reuse one dashboard across environments and drill-down contexts without duplicating panels.

When a panel shows errors, re-run its query in Query Lab first to isolate query syntax issues from visualization configuration issues.

## Multi-Dashboard UX

Peek supports a workspace library with `dashboards[]` and one active dashboard.

Use the Dashboards index page as the organizing surface: create dashboards, open one as active, and run row-level actions (rename, duplicate, archive, delete).

Keep `/` as the live canvas for the active dashboard so existing build/edit habits stay intact while switching context remains one click.

Each dashboard supports organization metadata (name, description, tags, last updated, archived flag) to make larger workspaces manageable.

Use sidebar and command palette navigation to move quickly between the active dashboard and dashboard management.
