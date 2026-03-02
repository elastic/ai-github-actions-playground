# Query Lab

Open Query Lab from the sidebar to run ad-hoc ES|QL queries and explore results in a table.

Start with `FROM <index-or-data-stream> | LIMIT 100` and then layer `WHERE`, `STATS`, and `SORT` clauses to iteratively shape results.

Use Recent queries to re-apply query text from successful runs.

Use the field list on the left to select which columns are shown.

Filter columns by name using the search box above the field list.

When you find a useful query, click Create Panel to promote it directly into a dashboard panel.

Click Export CSV to download the currently visible columns as a CSV file (query-lab-results.csv). Results are sanitized to prevent formula injection when opened in spreadsheet software.

Use pipeline step chips to execute and inspect intermediate query stages when debugging complex ES|QL pipelines.

## Profiling queries

Enable the **Profile query** toggle (next to the Run button) to send `profile: true` with the query. This is useful when investigating slow queries or diagnosing unexpected performance characteristics.

When profile data is returned, a **Query Profile** panel appears below the results table. The panel lists each execution driver and, within each driver, the individual operators sorted by elapsed time — showing elapsed time, CPU time, rows processed, and pages processed. Click a driver row to expand or collapse its operator list. Use the copy icon in the panel header to copy the raw profile JSON to the clipboard for deeper analysis or sharing.

> **Note:** The ES|QL profile response shape is marked as unstable in the Elasticsearch API spec and may change between versions. If the structure differs from the expected format, the panel falls back to displaying the raw JSON.
