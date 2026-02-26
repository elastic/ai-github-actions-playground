# Building Dashboards

Click Add Panel to create a new visualization. Each panel has its own ES|QL query and chart type.

Drag panels to rearrange them and resize by pulling the bottom-right corner.

Click a panel title to open the editor where you can change the query, visualization type, and chart options.

Use Recent queries in the panel editor to re-apply a query that previously ran successfully.

Use the time picker and refresh interval controls in the header to control the query time range.

Use the timezone picker (globe icon) in the header to lock all time-series charts on the dashboard to a specific IANA timezone (for example, UTC or America/New_York).

When a timezone is locked, axis labels and tooltip timestamps in every time-series panel render in that timezone instead of the browser's local time.

The selected timezone is saved with the dashboard and travels with export/import, so collaborators see timestamps in the same timezone regardless of their browser locale.

To return to browser-local time, select **Browser local** from the timezone picker.

Export your dashboard as a JSON file from the overflow menu, and import it on another machine.

Use dashboard variables in panel queries to reuse one dashboard across environments and drill-down contexts without duplicating panels.

When a panel shows errors, re-run its query in Query Lab first to isolate query syntax issues from visualization configuration issues.

Table panels include an **Export CSV** button in the panel toolbar. It downloads the rows currently loaded in that panel as a `.csv` file named `{panel-title}-{timestamp}.csv`. Use this for a quick snapshot of one panel's data. For a full result set or iterative query work, use the **Download CSV** action in Query Lab instead.

## Multi-Dashboard UX

Peek supports a workspace library with `dashboards[]` and one active dashboard.

Use the Dashboards index page as the organizing surface: create dashboards, open one as active, and run row-level actions (rename, duplicate, archive, delete).

Keep `/` as the live canvas for the active dashboard so existing build/edit habits stay intact while switching context remains one click.

Each dashboard supports organization metadata (name, description, tags, last updated, archived flag) to make larger workspaces manageable.

Use sidebar and command palette navigation to move quickly between the active dashboard and dashboard management.

## Searching and Filtering Dashboards

The dashboard library includes a search bar and tag filters to quickly narrow large workspaces.

Use the search box to filter by title or description — results update as you type.

Click any tag chip in the filter bar to toggle it as an active filter. Multiple tags are combined with AND logic, so only dashboards that carry all selected tags are shown. Tag chips on individual cards also toggle the same filter when clicked.

Use the Sort control to order results by **Last updated** (default) or **Title**.

The Show/Hide archived toggle in the toolbar controls whether archived dashboards appear alongside active ones.

All active filters are reflected in the URL as query parameters (`?q=latency&tags=prod,api&sort=title`). Share or bookmark these links to open a pre-filtered view from a runbook or Slack message.

When no dashboards match the current filters, a contextual empty state is shown with a **Reset filters** button to clear all active criteria in one click.
