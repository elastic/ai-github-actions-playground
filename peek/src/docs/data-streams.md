# Data Streams

Open Data Streams from the sidebar to inspect stream metadata and field capabilities without writing API calls manually.

Search streams by name, optionally include hidden system streams, and select a stream to view status, generation, backing indices, and ILM policy.

Use the field search box to quickly locate dimensions and metrics before building queries in Query Lab or Metrics.

Click any field row to open the **Field Stats** panel for that field. The panel shows:

- **Total docs** — total document count in the stream.
- **Non-null** — number of documents where the field has a value.
- **Null %** — percentage of documents where the field is absent or null.
- **Cardinality** — approximate number of distinct values.
- **Top values** — the most frequent values and their counts (shown for keyword and other text-like field types).
- **Min / Max** — the smallest and largest observed values (shown for numeric and date field types).

Click **Open stats query in Query Lab** inside the Field Stats panel to pivot directly to Query Lab with a pre-built query for that field. The query type depends on the field type:

- **Keyword-like fields** (keyword, constant_keyword, etc.) — generates a top-values aggregation query.
- **Numeric and date fields** — generates a min/max stats query.

Click **Open in Query Lab** at the stream level to seed a starter query for the selected stream and continue analysis with full ES|QL control.

If fields fail to load, refresh the page and verify that your role can access `_field_caps` and data stream metadata APIs.
