# Query Lab

Open Query Lab from the sidebar to run ad-hoc ES|QL queries and explore results in a table.

Start with `FROM <index-or-data-stream> | LIMIT 100` and then layer `WHERE`, `STATS`, and `SORT` clauses to iteratively shape results.

Use Recent queries to re-apply query text from successful runs.

Use the field list on the left to select which columns are shown.

Filter columns by name using the search box above the field list.

When you find a useful query, click Create Panel to promote it directly into a dashboard panel.

Click Export CSV to download the currently visible columns as a CSV file (discover-results.csv). Results are sanitized to prevent formula injection when opened in spreadsheet software.

Use pipeline step chips to execute and inspect intermediate query stages when debugging complex ES|QL pipelines.
